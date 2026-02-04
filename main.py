from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from uuid import uuid4

app = FastAPI()

# מודל הנתונים (דומה למה שהגדרנו קודם, אבל ב-Python)
class TaskItem(BaseModel):
    id: Optional[str] = None
    title: str
    category: str  # למשל: "Supermarket", "Pharmacy", "Hardware"
    is_completed: bool = False

# "מסד נתונים" זמני בזיכרון
tasks = []

@app.get("/")
def read_root():
    return {"message": "NextToYou API is running"}

# קבלת כל המשימות
@app.get("/tasks")
def get_tasks():
    return tasks

# הוספת משימה חדשה
@app.post("/tasks")
def create_task(task: TaskItem):
    task.id = str(uuid4())
    tasks.append(task)
    return task