import math
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# IMPORT THE DATA
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

def get_best_match_tfidf(user_query, inventory_names, threshold=0.2):
    """
    Uses TF-IDF to find the best matching item in the inventory.
    Returns the matching inventory name or None if no good match is found.
    """
    if not inventory_names:
        return None

    try:
        # 1. Create the corpus (Inventory + User Query) to ensure vocabulary matches
        # We treat the user query as just another document for vectorization
        corpus = inventory_names + [user_query]
        
        # 2. Vectorize
        # ngram_range=(1, 2) allows matching phrases like "Peanut Butter" together
        vectorizer = TfidfVectorizer(analyzer='word', ngram_range=(1, 2), min_df=1)
        tfidf_matrix = vectorizer.fit_transform(corpus)

        # 3. Calculate Cosine Similarity
        # The user_query is the LAST item in the matrix
        query_vec = tfidf_matrix[-1]
        inventory_vecs = tfidf_matrix[:-1]
        
        # Compute similarity between query and all inventory items
        similarity_scores = cosine_similarity(query_vec, inventory_vecs).flatten()

        # 4. Find the best match
        best_idx = np.argmax(similarity_scores)
        best_score = similarity_scores[best_idx]

        # Debug print to help you see what's matching
        # print(f"Query: '{user_query}' matched '{inventory_names[best_idx]}' with score: {best_score}")

        if best_score > threshold:
            return inventory_names[best_idx]
            
    except Exception as e:
        print(f"TF-IDF Error: {e}")
        # Fallback to simple matching if ML fails
        for name in inventory_names:
            if user_query.lower() in name.lower():
                return name
                
    return None

def find_nearby_deals(user_lat, user_lon, needed_items, radius=5000):
    nearby_deals = []
    
    for store in STORES_DB:
        dist = calculate_distance(user_lat, user_lon, store["lat"], store["lon"])
        
        # Only check stores within radius
        if dist <= radius:
            found_items = []
            store_inventory_names = list(store["inventory"].keys())
            
            for user_item in needed_items:
                # --- NEW TF-IDF MATCHING LOGIC ---
                match_name = get_best_match_tfidf(user_item, store_inventory_names)
                
                if match_name:
                    price = store["inventory"][match_name]
                    found_items.append({"item": match_name, "price": price})
            
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