import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from uuid import uuid4
from pydantic import BaseModel

# Database Imports
from pymongo import MongoClient
from dotenv import load_dotenv

from models import TaskItem, LocationUpdate, User, LoginRequest, Category
from store_logic import find_nearby_deals

# 1. LOAD ENVIRONMENT VARIABLES
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. CONNECT TO MONGODB
# If no env var is found, it will try strictly local, but you should set the MONGO_URI
MONGO_URI = os.getenv("MONGO_URI") 
if not MONGO_URI:
    print("WARNING: MONGO_URI not set. Database features will fail.")

client = MongoClient(MONGO_URI)
db = client["nexttoyou_db"] # This creates the DB automatically
users_collection = db["users"]
tasks_collection = db["tasks"]

# --- HELPER: Fix MongoDB _id ---
def fix_mongo_id(doc):
    """Removes the internal MongoDB _id object so Pydantic doesn't complain"""
    if doc:
        doc.pop("_id", None)
    return doc

# --- MODELS ---
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
    try:
        # Test connection
        client.admin.command('ping')
        return {"status": "NextToYou Server is Online", "database": "Connected"}
    except Exception as e:
        return {"status": "NextToYou Server is Online", "database": "Disconnected", "error": str(e)}

# --- AUTH ENDPOINTS ---
@app.post("/register")
def register(user: User):
    # Check if user exists
    if users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Save to Mongo
    users_collection.insert_one(user.dict())
    return {"message": "User registered", "user": user}

@app.post("/login")
def login(req: LoginRequest):
    # Find user
    user = users_collection.find_one({"username": req.username})
    
    if not user or user['password'] != req.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {"message": "Login successful", "user": fix_mongo_id(user)}

@app.post("/delete-account")
def delete_account(req: DeleteRequest):
    user = users_collection.find_one({"username": req.username})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["password"] != req.password:
        raise HTTPException(status_code=401, detail="Wrong password")

    # Delete User
    users_collection.delete_one({"username": req.username})
    # Delete Tasks
    tasks_collection.delete_many({"user_id": req.username})

    return {"message": "Account deleted"}

# --- TASK ENDPOINTS ---
@app.get("/tasks/{user_id}")
def get_tasks(user_id: str):
    # Fetch all tasks for this user
    tasks_cursor = tasks_collection.find({"user_id": user_id})
    return [fix_mongo_id(task) for task in tasks_cursor]

@app.post("/tasks")
def create_task(task: TaskItem):
    task.id = str(uuid4()) # Generate ID here
    tasks_collection.insert_one(task.dict())
    return task

@app.put("/tasks/{task_id}")
def update_task(task_id: str, update: TaskUpdate):
    # Build update dictionary (only fields that are not None)
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    result = tasks_collection.update_one(
        {"id": task_id}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
        
    return {"status": "updated", "updated_fields": update_data}

@app.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    result = tasks_collection.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "deleted"}

# --- PROXIMITY & SEARCH ---
@app.post("/check-proximity")
def check_proximity(loc: LocationUpdate):
    user = users_collection.find_one({"username": loc.user_id})
    radius = user['notification_radius'] if user else 50

    # Get active tasks from DB
    active_tasks_cursor = tasks_collection.find({"user_id": loc.user_id, "is_completed": False})
    user_tasks = [t['title'] for t in active_tasks_cursor]
    
    if not user_tasks:
        return {"message": "No active tasks."}

    deals = find_nearby_deals(loc.latitude, loc.longitude, user_tasks, radius=radius)
    return {"nearby": deals}

@app.post("/search-item")
def search_item(search: ItemSearch):
    # Uses store_logic which is still mock-based (fine for now)
    deals = find_nearby_deals(search.latitude, search.longitude, [search.item_name], radius=20000)
    return {"results": deals}