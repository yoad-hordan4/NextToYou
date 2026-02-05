from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from uuid import uuid4
from pydantic import BaseModel # <--- THIS WAS MISSING!

# Import from our new modules
from models import TaskItem, LocationUpdate
from store_logic import find_nearby_deals

app = FastAPI()

# Allow connections from anywhere
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-Memory Database
tasks_db = []

# --- NEW MODEL FOR SEARCH ---
class ItemSearch(BaseModel):
    latitude: float
    longitude: float
    item_name: str

@app.get("/")
def read_root():
    return {"status": "NextToYou Server is Online"}

@app.get("/tasks", response_model=List[TaskItem])
def get_tasks():
    return tasks_db

@app.post("/tasks", response_model=TaskItem)
def create_task(task: TaskItem):
    task.id = str(uuid4())
    tasks_db.append(task)
    return task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    global tasks_db
    tasks_db = [task for task in tasks_db if task.id != task_id]
    return {"status": "deleted"}

@app.post("/check-proximity")
def check_proximity(loc: LocationUpdate):
    needed_items = [t.title for t in tasks_db if not t.is_completed]
    
    if not needed_items:
        return {"message": "No active tasks."}

    deals = find_nearby_deals(loc.latitude, loc.longitude, needed_items)
    return {"nearby": deals}

# --- NEW ENDPOINT FOR SPECIFIC ITEM SEARCH ---
@app.post("/search-item")
def search_item(search: ItemSearch):
    # Reuse the logic but for a single item
    deals = find_nearby_deals(search.latitude, search.longitude, [search.item_name])
    return {"results": deals}