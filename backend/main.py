import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
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
    try:
        with open(filename, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filename}: {e}")
        return default

def save_data(filename, data):
    try:
        with open(filename, 'w') as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Error saving {filename}: {e}")

# Load DBs on startup
users_db = load_data(USERS_FILE, {}) 
tasks_db = load_data(TASKS_FILE, []) 

class ItemSearch(BaseModel):
    latitude: float
    longitude: float
    item_name: str
    radius: Optional[int] = 5000  # Default 5km radius

class DeleteRequest(BaseModel):
    username: str
    password: str

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None

@app.get("/")
def read_root():
    return {"status": "NextToYou Server is Online (JSON Mode)"}

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

@app.post("/delete-account")
def delete_account(req: DeleteRequest):
    global tasks_db
    
    if req.username not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    if users_db[req.username]["password"] != req.password:
        raise HTTPException(status_code=401, detail="Wrong password")

    # 1. Delete the user
    del users_db[req.username]
    save_data(USERS_FILE, users_db)

    # 2. Delete all their tasks
    tasks_db = [t for t in tasks_db if t.get('user_id') != req.username]
    save_data(TASKS_FILE, tasks_db)

    return {"message": "Account deleted"}

# --- TASK ENDPOINTS ---
@app.get("/tasks/{user_id}")
def get_tasks(user_id: str):
    # Filter tasks by user_id
    return [t for t in tasks_db if t.get('user_id') == user_id]

@app.post("/tasks")
def create_task(task: TaskItem):
    global tasks_db
    
    task.id = str(uuid4())
    tasks_db.append(task.dict())
    save_data(TASKS_FILE, tasks_db)
    return task

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
    
    original_len = len(tasks_db)
    tasks_db = [t for t in tasks_db if t['id'] != task_id]
    
    if len(tasks_db) == original_len:
        raise HTTPException(status_code=404, detail="Task not found")
        
    save_data(TASKS_FILE, tasks_db)
    return {"status": "deleted"}

# --- PROXIMITY ---
@app.post("/check-proximity")
def check_proximity(loc: LocationUpdate):
    try:
        user = users_db.get(loc.user_id)
        radius = user.get('notification_radius', 50) if user else 50

        user_tasks = [t['title'] for t in tasks_db if t.get('user_id') == loc.user_id and not t.get('is_completed', False)]
        
        if not user_tasks:
            return {"message": "No active tasks.", "nearby": []}

        deals = find_nearby_deals(loc.latitude, loc.longitude, user_tasks, radius=radius)
        return {"nearby": deals}
    except Exception as e:
        print(f"Proximity check error: {e}")
        raise HTTPException(status_code=500, detail=f"Error checking proximity: {str(e)}")

@app.post("/search-item")
def search_item(search: ItemSearch):
    try:
        deals = find_nearby_deals(search.latitude, search.longitude, [search.item_name], radius=search.radius)
        return {"results": deals}
    except Exception as e:
        print(f"Search item error: {e}")
        raise HTTPException(status_code=500, detail=f"Error searching item: {str(e)}")