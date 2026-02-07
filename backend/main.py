import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
from uuid import uuid4
from pydantic import BaseModel # Ensure this is imported

# Import models and logic
from models import TaskItem, LocationUpdate, User, LoginRequest
from store_logic import find_nearby_deals

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- FILE BASED DATABASE ---
USERS_FILE = "users_db.json"
TASKS_FILE = "tasks_db.json"

def load_data(filename, default):
    if not os.path.exists(filename):
        return default
    with open(filename, 'r') as f:
        return json.load(f)

def save_data(filename, data):
    with open(filename, 'w') as f:
        json.dump(data, f, indent=4)

# Load DBs on startup
users_db = load_data(USERS_FILE, {}) 
tasks_db = load_data(TASKS_FILE, []) 

# --- NEW MODEL FOR SEARCH (Add this!) ---
class ItemSearch(BaseModel):
    latitude: float
    longitude: float
    item_name: str

@app.get("/")
def read_root():
    return {"status": "NextToYou Server is Online"}

# --- AUTH ENDPOINTS ---
@app.post("/register")
def register(user: User):
    if user.username in users_db:
        raise HTTPException(status_code=400, detail="User already exists")
    
    users_db[user.username] = user.dict()
    save_data(USERS_FILE, users_db)
    return {"message": "User registered", "user": user}

@app.post("/login")
def login(req: LoginRequest):
    user = users_db.get(req.username)
    if not user or user['password'] != req.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"message": "Login successful", "user": user}

# --- TASK ENDPOINTS ---
@app.get("/tasks/{user_id}")
def get_tasks(user_id: str):
    return [t for t in tasks_db if t.get('user_id') == user_id]

@app.post("/tasks")
def create_task(task: TaskItem):
    task.id = str(uuid4())
    tasks_db.append(task.dict())
    save_data(TASKS_FILE, tasks_db)
    return task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    global tasks_db
    tasks_db = [t for t in tasks_db if t['id'] != task_id]
    save_data(TASKS_FILE, tasks_db)
    return {"status": "deleted"}

# --- PROXIMITY ---
@app.post("/check-proximity")
def check_proximity(loc: LocationUpdate):
    user = users_db.get(loc.user_id)
    radius = user['notification_radius'] if user else 50

    user_tasks = [t['title'] for t in tasks_db if t.get('user_id') == loc.user_id and not t['is_completed']]
    
    if not user_tasks:
        return {"message": "No active tasks."}

    deals = find_nearby_deals(loc.latitude, loc.longitude, user_tasks, radius=radius)
    return {"nearby": deals}

@app.post("/search-item")
def search_item(search: ItemSearch):
    # This is what the map calls to get pins
    deals = find_nearby_deals(search.latitude, search.longitude, [search.item_name])
    return {"results": deals}