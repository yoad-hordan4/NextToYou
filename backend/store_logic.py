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
    Finds the best match using Character N-Grams (Robust to typos and plurals).
    """
    if not inventory_names:
        return None

    try:
        # 1. Setup Corpus
        corpus = inventory_names + [user_query]
        
        # 2. Vectorize using 'char_wb' (Character Whole-Word Boundary)
        # This breaks words into chunks of 2-4 letters.
        # "apple" -> "ap", "pp", "pl", "le", "app", "ppl"...
        # This allows "apples" to match "apple" very highly.
        vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4), min_df=1)
        tfidf_matrix = vectorizer.fit_transform(corpus)

        # 3. Compute Similarity
        query_vec = tfidf_matrix[-1]
        inventory_vecs = tfidf_matrix[:-1]
        
        similarity_scores = cosine_similarity(query_vec, inventory_vecs).flatten()

        # 4. Find Best Match
        best_idx = np.argmax(similarity_scores)
        best_score = similarity_scores[best_idx]

        # Debugging: See what it's thinking
        # print(f"Query: '{user_query}' -> Match: '{inventory_names[best_idx]}' (Score: {best_score:.2f})")

        if best_score > threshold:
            return inventory_names[best_idx]
            
    except Exception as e:
        print(f"TF-IDF Error: {e}")

    # --- SMARTER FALLBACK ---
    # If AI fails, use logic.
    user_query_lower = user_query.lower()
    
    for name in inventory_names:
        name_lower = name.lower()
        
        # 1. Exact substring (e.g., user "soy milk" -> match "milk")
        if user_query_lower in name_lower:
            return name
            
        # 2. Reverse substring (e.g., user "red apples" -> match "apple")
        # We check if the store item is inside the user's longer search query
        if name_lower in user_query_lower:
            # Prevent tiny words matching (e.g. don't match "Tea" to "Steak")
            if len(name) > 3: 
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