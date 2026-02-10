import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
from uuid import uuid4
from pydantic import BaseModel 

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

class ItemSearch(BaseModel):
    latitude: float
    longitude: float
    item_name: str

class DeleteRequest(BaseModel):
    username: str
    password: str

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None

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

# --- NEW: DELETE ACCOUNT ---
@app.post("/delete-account")
def delete_account(req: DeleteRequest):
    if req.username not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check password for security
    if users_db[req.username]["password"] != req.password:
        raise HTTPException(status_code=401, detail="Wrong password")

    # 1. Delete the user
    del users_db[req.username]
    save_data(USERS_FILE, users_db)

    # 2. Delete all their tasks
    global tasks_db
    tasks_db = [t for t in tasks_db if t.get('user_id') != req.username]
    save_data(TASKS_FILE, tasks_db)

    return {"message": "Account deleted"}

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
# ... (inside backend/main.py)

@app.put("/tasks/{task_id}")
def update_task(task_id: str, update: TaskUpdate):
    global tasks_db
    for task in tasks_db:
        if task['id'] == task_id:
            if update.title:
                task['title'] = update.title
            if update.category:
                task['category'] = update.category
            save_data(TASKS_FILE, tasks_db)
            return task
    raise HTTPException(status_code=404, detail="Task not found")

@app.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    global tasks_db
    tasks_db = [t for t in tasks_db if t['id'] != task_id]
    save_data(TASKS_FILE, tasks_db)
    return {"status": "deleted"}

# --- PROXIMITY (Small Radius - For Push Notifications) ---
@app.post("/check-proximity")
def check_proximity(loc: LocationUpdate):
    user = users_db.get(loc.user_id)
    # Use User's preferred radius (usually small, e.g., 50m)
    radius = user['notification_radius'] if user else 50

    user_tasks = [t['title'] for t in tasks_db if t.get('user_id') == loc.user_id and not t['is_completed']]
    
    if not user_tasks:
        return {"message": "No active tasks."}

    deals = find_nearby_deals(loc.latitude, loc.longitude, user_tasks, radius=radius)
    return {"nearby": deals}

# --- MAP SEARCH (Huge Radius - For Planning) ---
@app.post("/search-item")
def search_item(search: ItemSearch):
    # SEARCH RADIUS: 20,000 meters (20km) so you see EVERYTHING in the city
    deals = find_nearby_deals(search.latitude, search.longitude, [search.item_name], radius=20000)
    return {"results": deals}