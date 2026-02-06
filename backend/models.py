from pydantic import BaseModel
from typing import Optional, List, Dict

class TaskItem(BaseModel):
    id: Optional[str] = None
    title: str
    category: str
    is_completed: bool = False
    # Link task to a specific user
    user_id: str 

class User(BaseModel):
    username: str
    password: str # In a real app, hash this!
    active_start_hour: int = 8   # e.g., 8 AM
    active_end_hour: int = 22    # e.g., 10 PM
    notification_radius: int = 50 # Meters

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    user_id: str # We need to know WHO is asking

class LoginRequest(BaseModel):
    username: str
    password: str