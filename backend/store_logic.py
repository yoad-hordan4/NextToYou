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

# 2. Advanced Search (TF-IDF)
def find_nearby_deals(user_lat, user_lon, user_items, radius=50):
    nearby_deals = []
    
    for store in STORES_DB:
        dist = haversine_distance(user_lat, user_lon, store["lat"], store["lon"])
        
        if dist <= radius:
            # FIX: Parse inventory if it's a JSON string
            inventory = store["inventory"]
            if isinstance(inventory, str):
                try:
                    inventory = json.loads(inventory)
                except:
                    continue
            
            # Check if inventory is valid
            if not inventory or not isinstance(inventory, list):
                continue
            
            store_inventory = [item["item"] for item in inventory]
            if not store_inventory:
                continue

            # TF-IDF Matching
            vectorizer = TfidfVectorizer()
            all_text = user_items + store_inventory
            try:
                tfidf_matrix = vectorizer.fit_transform(all_text)
                cosine_sim = cosine_similarity(tfidf_matrix[:len(user_items)], tfidf_matrix[len(user_items):])

                found_items = []
                for i, user_item in enumerate(user_items):
                    # Check best match in this store
                    best_match_idx = cosine_sim[i].argmax()
                    score = cosine_sim[i][best_match_idx]

                    if score > 0.3:  # Threshold for "good enough" match
                        matched_product = inventory[best_match_idx]
                        found_items.append(matched_product)
                
                if found_items:
                    nearby_deals.append({
                        "store": store["name"],
                        "lat": store["lat"],
                        "lon": store["lon"],
                        "distance": int(dist),
                        "found_items": found_items
                    })
            except Exception as e:
                print(f"Error processing store {store.get('name', 'unknown')}: {str(e)}")
                continue

    return nearby_deals