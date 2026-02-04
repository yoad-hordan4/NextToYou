import math

# --- Mock Database ---
STORES_DB = [
    {
        "name": "Super-Pharm Center",
        "category": "Pharmacy",
        "lat": 32.0860, "lon": 34.7820,
        "inventory": { "materna": 45.0, "diapers": 60.0, "pacifier": 15.0 }
    },
    {
        "name": "Mega City",
        "category": "Supermarket",
        "lat": 32.0870, "lon": 34.7830, # עדכן לקואורדינטות שלך לבדיקה
        "inventory": { "milk": 5.90, "bread": 7.50, "eggs": 12.00 }
    },
    {
        "name": "Shufersal Deal",
        "category": "Supermarket",
        "lat": 32.0853, "lon": 34.7818, # עדכן לקואורדינטות שלך לבדיקה
        "inventory": { "milk": 6.50, "bread": 6.90 }
    },
    {
        "name": "Moshiko Hardware",
        "category": "Hardware",
        "lat": 32.0855, "lon": 34.7815,
        "inventory": { "paint": 80.0, "hammer": 45.0 }
    }
]

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371000 # רדיוס כדור הארץ במטרים
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def find_nearby_deals(user_lat, user_lon, needed_items, radius=200):
    nearby_deals = []
    
    for store in STORES_DB:
        dist = calculate_distance(user_lat, user_lon, store["lat"], store["lon"])
        
        if dist <= radius:
            found_items = []
            for item in needed_items:
                # חיפוש רגיש (Case Insensitive)
                for store_item, price in store["inventory"].items():
                    if item.lower() in store_item.lower(): 
                        found_items.append({"item": store_item, "price": price})
            
            if found_items:
                nearby_deals.append({
                    "store": store["name"],
                    "category": store["category"],
                    "distance": int(dist),
                    "found_items": found_items
                })

    # מיון לפי המחיר הזול ביותר של הפריט הראשון שנמצא
    if nearby_deals:
        nearby_deals.sort(key=lambda x: x["found_items"][0]["price"])
        
    return nearby_deals