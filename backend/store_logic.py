import math
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from mock_data import STORES_DB

# 1. Haversine Formula (Distance Calculation)
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # Radius of Earth in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# 2. Advanced Search (TF-IDF) with better fuzzy matching
def find_nearby_deals(user_lat, user_lon, user_items, radius=5000):
    nearby_deals = []
    
    print(f"[DEBUG] Searching for {user_items} near ({user_lat}, {user_lon}) within {radius}m")
    
    for store in STORES_DB:
        dist = haversine_distance(user_lat, user_lon, store["lat"], store["lon"])
        
        print(f"[DEBUG] Store: {store['name']}, Distance: {int(dist)}m")
        
        if dist <= radius:
            # FIX: Parse inventory if it's a JSON string
            inventory = store["inventory"]
            if isinstance(inventory, str):
                try:
                    inventory = json.loads(inventory)
                except:
                    print(f"[ERROR] Failed to parse inventory for {store['name']}")
                    continue
            
            # Check if inventory is valid
            if not inventory or not isinstance(inventory, list):
                print(f"[ERROR] Invalid inventory for {store['name']}")
                continue
            
            store_inventory = [item["item"] for item in inventory]
            if not store_inventory:
                continue

            # TF-IDF Matching with improved threshold
            vectorizer = TfidfVectorizer(ngram_range=(1, 2))  # Use bigrams for better matching
            all_text = user_items + store_inventory
            try:
                tfidf_matrix = vectorizer.fit_transform(all_text)
                cosine_sim = cosine_similarity(tfidf_matrix[:len(user_items)], tfidf_matrix[len(user_items):])

                found_items = []
                for i, user_item in enumerate(user_items):
                    # Check best match in this store
                    best_match_idx = cosine_sim[i].argmax()
                    score = cosine_sim[i][best_match_idx]

                    print(f"[DEBUG] '{user_item}' matched '{store_inventory[best_match_idx]}' with score {score:.2f}")

                    # Lower threshold for better fuzzy matching (milk matches 1% milk, etc)
                    if score > 0.2:  # Lowered from 0.3 for better matching
                        matched_product = inventory[best_match_idx]
                        found_items.append({
                            **matched_product,
                            "match_score": float(score),
                            "searched_for": user_item
                        })
                
                if found_items:
                    print(f"[DEBUG] Found {len(found_items)} items at {store['name']}")
                    nearby_deals.append({
                        "store": store["name"],
                        "store_id": store["id"],
                        "address": store.get("address", ""),
                        "lat": store["lat"],
                        "lon": store["lon"],
                        "distance": int(dist),
                        "found_items": found_items
                    })
            except Exception as e:
                print(f"[ERROR] Processing store {store.get('name', 'unknown')}: {str(e)}")
                continue

    # Sort by distance
    nearby_deals.sort(key=lambda x: x['distance'])
    print(f"[DEBUG] Total stores found: {len(nearby_deals)}")
    return nearby_deals