from pydantic import BaseModel
from typing import Optional, List

class User(BaseModel):
    username: str
    password: str
    active_start_hour: int = 8
    active_end_hour: int = 22
    notification_radius: int = 50

class LoginRequest(BaseModel):
    username: str
    password: str

class Category(BaseModel):
    name: str
    color: str

class TaskItem(BaseModel):
    id: Optional[str] = None
    title: str
    category: str = "General"
    is_completed: bool = False
    user_id: str

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    user_id: str