# This file serves as our "Mock Database"
# In a real app, this data would come from PostgreSQL or MongoDB

STORES_DB = [
    # --- SUPERMARKETS ---
    {
        "name": "Super Yuda",
        "category": "Supermarket",
        "lat": 32.0850, "lon": 34.7810, # Near Tel Aviv Center
        "inventory": {
            "milk": 6.90,
            "bread": 8.50,
            "eggs": 14.90,
            "cheese": 22.00,
            "apple": 9.90
        }
    },
    {
        "name": "AM:PM",
        "category": "Supermarket",
        "lat": 32.0880, "lon": 34.7830, 
        "inventory": {
            "milk": 8.50, # Expensive!
            "bread": 9.90,
            "eggs": 16.90,
            "cola": 8.00,
            "chips": 12.00
        }
    },
    {
        "name": "Shufersal Deal",
        "category": "Supermarket",
        "lat": 32.0830, "lon": 34.7800,
        "inventory": {
            "milk": 5.90, # Cheap!
            "bread": 6.50,
            "eggs": 11.90,
            "chicken": 35.00,
            "rice": 7.90
        }
    },

    # --- PHARMACIES ---
    {
        "name": "Super-Pharm",
        "category": "Pharmacy",
        "lat": 32.0860, "lon": 34.7820,
        "inventory": {
            "advil": 35.00,
            "shampoo": 22.00,
            "toothpaste": 15.00,
            "diapers": 55.00,
            "vitamins": 80.00
        }
    },
    {
        "name": "Be Pharmacy",
        "category": "Pharmacy",
        "lat": 32.0875, "lon": 34.7840,
        "inventory": {
            "advil": 32.00,
            "shampoo": 19.90,
            "toothpaste": 12.00,
            "facemask": 10.00
        }
    },

    # --- HARDWARE ---
    {
        "name": "Tambour Hardware",
        "category": "Hardware",
        "lat": 32.0855, "lon": 34.7815,
        "inventory": {
            "hammer": 45.00,
            "paint": 85.00,
            "screws": 15.00,
            "drill": 250.00,
            "lightbulb": 12.00
        }
    },
    {
        "name": "Ace Hardware",
        "category": "Hardware",
        "lat": 32.0820, "lon": 34.7790,
        "inventory": {
            "hammer": 39.00,
            "paint": 90.00,
            "ladder": 150.00,
            "glue": 20.00
        }
    }
]