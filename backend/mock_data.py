# This file serves as our "Mock Database"

STORES_DB = [
    {
        "name": "Herzliya Hills Market", 
        "category": "Supermarket",
        "lat": 32.167145928095465, 
        "lon": 34.80468192486658,
        "inventory": {
            "milk": 5.50,   # מחיר זול לבדיקה
            "bread": 7.00,
            "water": 4.00,
            "coffee": 15.00,
            "apple": 8.00
        }
    },
    {
        "name": "Dizengoff Center Shop",
        "category": "General Store",
        "lat": 32.07788036071752, 
        "lon": 34.77397435278002,
        "inventory": {
            "milk": 7.20,   # מחיר יקר יותר
            "batteries": 20.00,
            "notebook": 12.00,
            "charger": 45.00,
            "cola": 9.00
        }
    },

    # --- EXISTING STORES (From before) ---
    {
        "name": "Super Yuda",
        "category": "Supermarket",
        "lat": 32.0850, "lon": 34.7810,
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
            "milk": 8.50,
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
            "milk": 5.90,
            "bread": 6.50,
            "eggs": 11.90,
            "chicken": 35.00,
            "rice": 7.90
        }
    },
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
    }
]