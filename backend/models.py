from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    username: str
    password: str
    active_start_hour: int = 8
    active_end_hour: int = 22
    notification_radius: int = 500  # in meters

class LoginRequest(BaseModel):
    username: str
    password: str

class TaskItem(BaseModel):
    id: Optional[str] = None
    title: str
    category: str
    user_id: str
    is_completed: bool = False

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    user_id: str