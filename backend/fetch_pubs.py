"""Fetch the latest pub list from the bristol.pub API and write data.json.

Replaces the raw.data -> parse.py pipeline: the public API already returns
clean JSON, so no obfuscated-field parsing is needed.
"""

import json
import os
import shutil
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

load_dotenv()

DEFAULT_PUBS_API_URL = "https://bristol.pub/api/pubs"

# The API is behind Cloudflare; a browser-ish UA avoids being challenged.
DEFAULT_HEADERS = {
    "accept": "*/*",
    "referer": "https://bristol.pub/pubs",
    "user-agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
    ),
}

# Sanity bounds for Bristol so a bad upstream response can't poison the data.
BRISTOL_BBOX = (-3.0, 51.2, -2.2, 51.7)  # min_lon, min_lat, max_lon, max_lat
MIN_EXPECTED_PUBS = 100
MAX_SHRINK_RATIO = 0.7  # new list must keep at least 70% of the previous count


class PubFetchError(Exception):
    """Raised when the upstream pub list is missing or fails validation"""


def fetch_raw_pubs(url: Optional[str] = None, timeout: int = 30) -> List[Dict[str, Any]]:
    """Fetch the pub list from the upstream API

    Args:
        url: API endpoint (defaults to PUBS_API_URL env var or bristol.pub)
        timeout: Request timeout in seconds

    Returns:
        Raw list of pub dicts as returned by the API
    """
    url = url or os.getenv("PUBS_API_URL", DEFAULT_PUBS_API_URL)

    response = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
    response.raise_for_status()

    data = response.json()
    if not isinstance(data, list):
        raise PubFetchError(f"Expected a JSON array from {url}, got {type(data).__name__}")

    return data


def normalize_pubs(raw_pubs: List[Any]) -> List[Dict[str, Any]]:
    """Convert API pubs into the data.json schema

    Keeps only the fields the planner needs and normalizes the address shape
    (the API uses 'postcode', data.json has always used 'postalCode').

    Args:
        raw_pubs: Pub dicts from the API

    Returns:
        List of pubs in data.json format, skipping any without usable coordinates
    """
    pubs = []

    for item in raw_pubs:
        if not isinstance(item, dict):
            continue

        pub_id = item.get("id")
        name = item.get("name")
        longitude = item.get("longitude")
        latitude = item.get("latitude")

        if not pub_id or not name:
            continue
        if not isinstance(longitude, (int, float)) or not isinstance(latitude, (int, float)):
            continue

        address = item.get("address") or {}
        pubs.append(
            {
                "id": str(pub_id),
                "name": str(name),
                "address": {
                    "street": address.get("street"),
                    "postalCode": address.get("postcode") or address.get("postalCode"),
                },
                "latitude": float(latitude),
                "longitude": float(longitude),
            }
        )

    return pubs


def validate_pubs(pubs: List[Dict[str, Any]], previous_count: int = 0) -> None:
    """Check a fetched pub list before it overwrites the existing data

    Args:
        pubs: Normalized pub list
        previous_count: Number of pubs currently in data.json (0 if none)

    Raises:
        PubFetchError: If the list is implausibly small or out of area
    """
    if len(pubs) < MIN_EXPECTED_PUBS:
        raise PubFetchError(
            f"Only {len(pubs)} pubs fetched, expected at least {MIN_EXPECTED_PUBS}"
        )

    if previous_count and len(pubs) < previous_count * MAX_SHRINK_RATIO:
        raise PubFetchError(
            f"Pub count dropped from {previous_count} to {len(pubs)}; refusing to overwrite"
        )

    ids = {pub["id"] for pub in pubs}
    if len(ids) != len(pubs):
        raise PubFetchError(f"Duplicate pub IDs: {len(pubs)} pubs, {len(ids)} unique IDs")

    min_lon, min_lat, max_lon, max_lat = BRISTOL_BBOX
    out_of_area = [
        pub["name"]
        for pub in pubs
        if not (min_lon <= pub["longitude"] <= max_lon and min_lat <= pub["latitude"] <= max_lat)
    ]
    if out_of_area:
        raise PubFetchError(
            f"{len(out_of_area)} pubs outside the Bristol bounding box: {out_of_area[:5]}"
        )


def load_existing_pubs(data_file: str) -> List[Dict[str, Any]]:
    """Load the current data.json, returning [] if it does not exist or is unreadable"""
    if not os.path.exists(data_file):
        return []
    try:
        with open(data_file, "r", encoding="utf-8") as f:
            existing = json.load(f)
        return existing if isinstance(existing, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def diff_pubs(
    old_pubs: List[Dict[str, Any]], new_pubs: List[Dict[str, Any]]
) -> Tuple[List[str], List[str], List[str]]:
    """Compare two pub lists

    Returns:
        (added names, removed names, names whose coordinates moved)
    """
    old_by_id = {pub["id"]: pub for pub in old_pubs}
    new_by_id = {pub["id"]: pub for pub in new_pubs}

    added = [new_by_id[pub_id]["name"] for pub_id in new_by_id.keys() - old_by_id.keys()]
    removed = [old_by_id[pub_id]["name"] for pub_id in old_by_id.keys() - new_by_id.keys()]
    moved = [
        new_by_id[pub_id]["name"]
        for pub_id in new_by_id.keys() & old_by_id.keys()
        if (new_by_id[pub_id]["longitude"], new_by_id[pub_id]["latitude"])
        != (old_by_id[pub_id]["longitude"], old_by_id[pub_id]["latitude"])
    ]

    return sorted(added), sorted(removed), sorted(moved)


def write_pubs(pubs: List[Dict[str, Any]], data_file: str) -> None:
    """Write pubs to data_file atomically, keeping a .bak of the previous version"""
    directory = os.path.dirname(data_file) or "."
    os.makedirs(directory, exist_ok=True)

    if os.path.exists(data_file):
        shutil.copy2(data_file, f"{data_file}.bak")

    tmp_file = f"{data_file}.tmp"
    with open(tmp_file, "w", encoding="utf-8") as f:
        json.dump(pubs, f, indent=2)
    os.replace(tmp_file, data_file)


def refresh_pub_data(
    data_file: Optional[str] = None, url: Optional[str] = None
) -> Dict[str, Any]:
    """Fetch, validate and write the latest pub list

    Args:
        data_file: Destination path (defaults to DATA_FILE env var or data/data.json)
        url: API endpoint override

    Returns:
        Summary dict with counts and the added/removed/moved pub names

    Raises:
        PubFetchError: If the fetched data fails validation (data.json is left untouched)
        requests.RequestException: If the upstream request fails
    """
    data_file = data_file or os.getenv("DATA_FILE", "data/data.json")

    old_pubs = load_existing_pubs(data_file)
    new_pubs = normalize_pubs(fetch_raw_pubs(url))
    validate_pubs(new_pubs, previous_count=len(old_pubs))

    added, removed, moved = diff_pubs(old_pubs, new_pubs)
    changed = bool(added or removed or moved)

    if changed or not old_pubs:
        write_pubs(new_pubs, data_file)

    return {
        "pubs_count": len(new_pubs),
        "previous_count": len(old_pubs),
        "changed": changed,
        "added": added,
        "removed": removed,
        "moved": moved,
        "data_file": data_file,
    }


if __name__ == "__main__":
    result = refresh_pub_data()

    print(f"Fetched {result['pubs_count']} pubs (was {result['previous_count']})")
    if result["changed"]:
        print(f"Added ({len(result['added'])}): {', '.join(result['added']) or '-'}")
        print(f"Removed ({len(result['removed'])}): {', '.join(result['removed']) or '-'}")
        print(f"Moved ({len(result['moved'])}): {', '.join(result['moved']) or '-'}")
        print(f"Wrote {result['data_file']}")
        print("Distance matrix is now stale - run precompute_distances.py")
    else:
        print("No changes; data.json left as-is")
