import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def load_raw_data(raw_data_file: str = None):
    """Load raw data from raw.data file

    Args:
        raw_data_file: Path to raw data file (defaults to RAW_DATA_FILE env var or raw.data)

    Returns:
        Parsed raw data as list/dict
    """
    if raw_data_file is None:
        raw_data_file = os.getenv("RAW_DATA_FILE", "raw.data")

    with open(raw_data_file, "r", encoding="utf-8") as f:
        return json.load(f)


def get_from_index(data, index):
    """Safely get value from data at given index"""
    try:
        return data[index]
    except (KeyError, TypeError, IndexError):
        return None


def parse_data(data):
    """Parse raw data into structured pub data"""
    pubs = []

    for item in data:
        if isinstance(item, dict):
            # Check if required fields exist
            if "_18" not in item or "_20" not in item or "_28" not in item or "_30" not in item:
                continue

            # Get address data
            address = get_from_index(data, item["_22"]) or {}

            # Create pub object
            pub = {
                "id": get_from_index(data, item["_18"]),
                "name": get_from_index(data, item["_20"]),
                "address": {
                    "street": get_from_index(address, "_24"),
                    "postalCode": get_from_index(address, "_26"),
                },
                "latitude": get_from_index(data, item["_28"]),
                "longitude": get_from_index(data, item["_30"]),
            }
            pubs.append(pub)

    return pubs


if __name__ == "__main__":
    # Get paths from environment variables or use defaults
    raw_data_file = os.getenv("RAW_DATA_FILE", "raw.data")
    data_file = os.getenv("DATA_FILE", "data.json")

    # Load and parse data
    if not os.path.exists(raw_data_file):
        print(f"Error: Raw data file not found: {raw_data_file}")
        exit(1)

    raw_data = load_raw_data(raw_data_file)
    pubs = parse_data(raw_data)

    # Write results to file
    with open(data_file, "w", encoding="utf-8") as f:
        json.dump(pubs, f, indent=2)

    print(f"Data parsed and saved to {data_file}")
