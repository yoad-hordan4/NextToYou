from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from uuid import uuid4

app = FastAPI()

# --- CORS Configuration ---
# This allows your React Native app to communicate with this server.
origins = [
    "http://localhost:19000",  # Common Expo port
    "http://localhost:8081",   # Common React Native port
    "*",                       # For development, allow all origins (restrict this in production!)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Models ---
# Based on your README requirements for Smart Lists
class TaskItem(BaseModel):
    id: Optional[str] = None
    title: str
    category: str  # e.g., "Hardware Store", "Pharmacy"
    is_completed: bool = False

# In-memory storage (acts as a database for the MVP)
tasks_db = []

# --- API Endpoints ---

@app.get("/")
def read_root():
    return {"status": "NextToYou Server is running"}

# Get all tasks
@app.get("/tasks", response_model=List[TaskItem])
def get_tasks():
    return tasks_db

# Add a new task
@app.post("/tasks", response_model=TaskItem)
def create_task(task: TaskItem):
    task.id = str(uuid4())  # Generate a unique ID
    tasks_db.append(task)
    return task

# Delete a task (Useful for the "Completed" feature)
@app.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    global tasks_db
    tasks_db = [task for task in tasks_db if task.id != task_id]
    return {"status": "deleted"}