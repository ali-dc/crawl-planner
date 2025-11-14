import json

def load_raw_data():
    """Load raw data from raw.data file"""
    with open("raw.data", "r", encoding="utf-8") as f:
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
    # Load and parse data
    raw_data = load_raw_data()
    pubs = parse_data(raw_data)

    # Write results to file
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(pubs, f, indent=2)

    print("Data parsed and saved to data.json")
