import json
import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from uuid import uuid4
from pydantic import BaseModel 

from models import TaskItem, LocationUpdate, User, LoginRequest, UserSettingsUpdate, ReminderConfig
from store_logic import find_nearby_deals, haversine_distance

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
GEOFENCE_STATE_FILE = "geofence_state.json"  # Track when users were inside geofences

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
geofence_state = load_data(GEOFENCE_STATE_FILE, {})  # {user_id: {task_id: {inside: bool, location_type: str}}}

class ItemSearch(BaseModel):
    latitude: float
    longitude: float
    item_name: str
    radius: Optional[int] = 5000

class DeleteRequest(BaseModel):
    username: str
    password: str

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    reminder: Optional[ReminderConfig] = None

@app.get("/")
def read_root():
    return {"status": "NextToYou Server is Online - Advanced Task System"}

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
    global tasks_db, geofence_state
    
    if req.username not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    if users_db[req.username]["password"] != req.password:
        raise HTTPException(status_code=401, detail="Wrong password")

    # Delete user
    del users_db[req.username]
    save_data(USERS_FILE, users_db)

    # Delete tasks
    tasks_db = [t for t in tasks_db if t.get('user_id') != req.username]
    save_data(TASKS_FILE, tasks_db)
    
    # Delete geofence state
    if req.username in geofence_state:
        del geofence_state[req.username]
        save_data(GEOFENCE_STATE_FILE, geofence_state)

    return {"message": "Account deleted"}

# --- USER SETTINGS ---
@app.get("/user/{username}/settings")
def get_user_settings(username: str):
    user = users_db.get(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.put("/user/{username}/settings")
def update_user_settings(username: str, settings: UserSettingsUpdate):
    global users_db
    
    if username not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = users_db[username]
    
    # Update only provided fields
    update_dict = settings.dict(exclude_unset=True)
    for key, value in update_dict.items():
        if value is not None:
            user[key] = value
    
    users_db[username] = user
    save_data(USERS_FILE, users_db)
    
    print(f"[DEBUG] Updated settings for {username}: {update_dict}")
    
    return {"message": "Settings updated", "user": user}

# --- TASK ENDPOINTS ---
@app.get("/tasks/{user_id}")
def get_tasks(user_id: str):
    user_tasks = [t for t in tasks_db if t.get('user_id') == user_id]
    print(f"[DEBUG] Retrieved {len(user_tasks)} tasks for user {user_id}")
    return user_tasks

@app.post("/tasks")
def create_task(task: TaskItem):
    global tasks_db
    
    task.id = str(uuid4())
    task.created_at = datetime.now().isoformat()
    task_dict = task.dict()
    
    print(f"[DEBUG] Creating task: {task_dict}")
    
    tasks_db.append(task_dict)
    save_data(TASKS_FILE, tasks_db)
    
    print(f"[DEBUG] Task created successfully. Total tasks: {len(tasks_db)}")
    
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
            if update.reminder:
                task['reminder'] = update.reminder.dict()
            
            save_data(TASKS_FILE, tasks_db)
            print(f"[DEBUG] Updated task {task_id}")
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

# --- PROXIMITY & REMINDERS ---
@app.post("/check-proximity")
def check_proximity(loc: LocationUpdate):
    try:
        print(f"[DEBUG] Check proximity for user: {loc.user_id} at ({loc.latitude}, {loc.longitude})")
        
        user = users_db.get(loc.user_id)
        if not user:
            return {"message": "User not found", "nearby": [], "location_reminders": []}
        
        radius = user.get('notification_radius', 500)
        
        # Get active tasks
        user_tasks = [t for t in tasks_db if t.get('user_id') == loc.user_id and not t.get('is_completed', False)]
        
        # Split tasks by reminder type
        shopping_tasks = [t['title'] for t in user_tasks if not t.get('reminder') or t.get('reminder', {}).get('type') == 'none']
        location_reminder_tasks = [t for t in user_tasks if t.get('reminder') and t.get('reminder', {}).get('type') in ['leaving_home', 'leaving_work', 'custom_location']]
        
        # Check for nearby deals (shopping tasks)
        deals = []
        if shopping_tasks:
            deals = find_nearby_deals(loc.latitude, loc.longitude, shopping_tasks, radius=radius)
        
        # Check for location-based reminders (geofencing)
        location_reminders = check_location_reminders(loc.user_id, loc.latitude, loc.longitude, location_reminder_tasks, user)
        
        print(f"[DEBUG] Found {len(deals)} deals and {len(location_reminders)} location reminders")
        
        return {
            "nearby": deals,
            "location_reminders": location_reminders
        }
        
    except Exception as e:
        print(f"[ERROR] Proximity check error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error checking proximity: {str(e)}")

def check_location_reminders(user_id: str, lat: float, lon: float, tasks: list, user: dict) -> list:
    """
    Check if user is leaving a geofenced area and should be reminded about tasks.
    Returns list of tasks to remind about.
    """
    global geofence_state
    
    reminders = []
    
    if user_id not in geofence_state:
        geofence_state[user_id] = {}
    
    for task in tasks:
        task_id = task['id']
        reminder = task.get('reminder', {})
        reminder_type = reminder.get('type')
        
        # Get the location to check based on reminder type
        check_lat, check_lon = None, None
        location_name = ""
        
        if reminder_type == 'leaving_home':
            check_lat = user.get('home_latitude')
            check_lon = user.get('home_longitude')
            location_name = "home"
        elif reminder_type == 'leaving_work':
            check_lat = user.get('work_latitude')
            check_lon = user.get('work_longitude')
            location_name = "work"
        elif reminder_type == 'custom_location':
            check_lat = reminder.get('custom_latitude')
            check_lon = reminder.get('custom_longitude')
            location_name = reminder.get('custom_address', 'custom location')
        
        if check_lat is None or check_lon is None:
            continue  # Location not set
        
        # Calculate distance
        distance = haversine_distance(lat, lon, check_lat, check_lon)
        leaving_radius = reminder.get('leaving_radius', 200)  # meters
        
        # Check if inside the geofence
        is_inside = distance <= leaving_radius
        
        # Get previous state
        prev_state = geofence_state[user_id].get(task_id, {})
        was_inside = prev_state.get('inside', False)
        
        # Update state
        geofence_state[user_id][task_id] = {
            'inside': is_inside,
            'location_type': location_name
        }
        
        # Trigger reminder if transitioning from inside to outside
        if was_inside and not is_inside:
            print(f"[DEBUG] User {user_id} leaving {location_name} - remind about task: {task['title']}")
            reminders.append({
                'task_id': task_id,
                'task_title': task['title'],
                'location_type': location_name,
                'trigger': 'leaving',
                'distance': int(distance)
            })
        
        print(f"[DEBUG] Task '{task['title']}': distance={int(distance)}m, inside={is_inside}, was_inside={was_inside}")
    
    save_data(GEOFENCE_STATE_FILE, geofence_state)
    return reminders

@app.post("/search-item")
def search_item(search: ItemSearch):
    try:
        print(f"[DEBUG] Search for '{search.item_name}' at ({search.latitude}, {search.longitude}) within {search.radius}m")
        
        deals = find_nearby_deals(search.latitude, search.longitude, [search.item_name], radius=search.radius)
        
        print(f"[DEBUG] Search found {len(deals)} results")
        
        return {"results": deals}
    except Exception as e:
        print(f"[ERROR] Search item error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error searching item: {str(e)}")

# --- TIME-BASED REMINDERS ---
@app.get("/check-time-reminders/{user_id}")
def check_time_reminders(user_id: str):
    """
    Check if any time-based reminders should trigger.
    Call this periodically from the frontend.
    """
    try:
        now = datetime.now()
        current_time = now.strftime("%H:%M")
        current_day = now.strftime("%a").lower()[:3]  # mon, tue, wed, etc.
        
        user_tasks = [t for t in tasks_db if t.get('user_id') == user_id and not t.get('is_completed', False)]
        
        due_reminders = []
        
        for task in user_tasks:
            reminder = task.get('reminder')
            if not reminder or reminder.get('type') != 'specific_time':
                continue
            
            reminder_time = reminder.get('time')
            reminder_days = reminder.get('days', ['everyday'])
            
            if not reminder_time:
                continue
            
            # Check if time matches (within 1 minute window)
            if reminder_time == current_time or abs(time_diff_minutes(reminder_time, current_time)) <= 1:
                # Check if day matches
                if 'everyday' in reminder_days or current_day in reminder_days:
                    due_reminders.append({
                        'task_id': task['id'],
                        'task_title': task['title'],
                        'time': reminder_time
                    })
        
        print(f"[DEBUG] Time reminders for {user_id} at {current_time}: {len(due_reminders)} due")
        
        return {"reminders": due_reminders}
        
    except Exception as e:
        print(f"[ERROR] Time reminder check error: {e}")
        return {"reminders": []}

def time_diff_minutes(time1: str, time2: str) -> int:
    """Calculate difference in minutes between two HH:MM times"""
    h1, m1 = map(int, time1.split(':'))
    h2, m2 = map(int, time2.split(':'))
    return abs((h1 * 60 + m1) - (h2 * 60 + m2))