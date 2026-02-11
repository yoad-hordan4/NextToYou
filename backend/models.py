from pydantic import BaseModel
from typing import Optional
from enum import Enum

# --- Categories ---
class Category(str, Enum):
    SUPERMARKET = "Supermarket"
    PHARMACY = "Pharmacy"
    HARDWARE = "Hardware"
    PET_SHOP = "Pet Shop"
    POST_OFFICE = "Post Office"
    PHONE_REPAIR = "Phone Repair"
    GENERAL = "General"

class TaskItem(BaseModel):
    id: Optional[str] = None
    title: str
    category: str = Category.SUPERMARKET
    is_completed: bool = False
    user_id: str 

class User(BaseModel):
    username: str
    password: str
    active_start_hour: int = 8
    active_end_hour: int = 22
    notification_radius: int = 50

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    user_id: str

class LoginRequest(BaseModel):
    username: str
    password: str

# --- NEW: Update Request Model ---
class UserUpdate(BaseModel):
    current_username: str
    current_password: str
    new_username: Optional[str] = None
    new_password: Optional[str] = None
    active_start_hour: Optional[int] = None
    active_end_hour: Optional[int] = None
    notification_radius: Optional[int] = None