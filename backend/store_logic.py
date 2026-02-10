import math
# IMPORT THE NEW DATA
from mock_data import STORES_DB

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371000 # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def find_nearby_deals(user_lat, user_lon, needed_items, radius=5000):
    nearby_deals = []
    
    for store in STORES_DB:
        dist = calculate_distance(user_lat, user_lon, store["lat"], store["lon"])
        
        # Only check stores within radius
        if dist <= radius:
            found_items = []
            for item in needed_items:
                # Search inside the store's inventory
                for store_item, price in store["inventory"].items():
                    # "milk" matches "Soy Milk" or "Milk 3%"
                    if item.lower() in store_item.lower(): 
                        found_items.append({"item": store_item, "price": price})
            
            if found_items:
                nearby_deals.append({
                    "store": store["name"],
                    "category": store["category"],
                    "lat": store["lat"], 
                    "lon": store["lon"],
                    "distance": int(dist),
                    "found_items": found_items
                })

    # Sort by Price (Cheapest first) -> Then by Distance
    if nearby_deals:
        nearby_deals.sort(key=lambda x: (x["found_items"][0]["price"], x["distance"]))
        
    return nearby_deals