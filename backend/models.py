from pydantic import BaseModel
from typing import Optional, Literal

class User(BaseModel):
    username: str
    password: str
    active_start_hour: int = 8
    active_end_hour: int = 22
    notification_radius: int = 500  # in meters
    # Location settings
    home_latitude: Optional[float] = None
    home_longitude: Optional[float] = None
    home_address: Optional[str] = None
    work_latitude: Optional[float] = None
    work_longitude: Optional[float] = None
    work_address: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class ReminderConfig(BaseModel):
    type: Literal["none", "leaving_home", "leaving_work", "custom_location", "specific_time"]
    # For location-based
    custom_latitude: Optional[float] = None
    custom_longitude: Optional[float] = None
    custom_address: Optional[str] = None
    leaving_radius: Optional[int] = 200  # meters - triggers when leaving this radius
    # For time-based
    time: Optional[str] = None  # HH:MM format
    days: Optional[list[str]] = None  # ["mon", "tue", "wed", etc.] or ["everyday"]

class TaskItem(BaseModel):
    id: Optional[str] = None
    title: str
    category: str
    user_id: str
    is_completed: bool = False
    reminder: Optional[ReminderConfig] = None
    created_at: Optional[str] = None

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    user_id: str

class UserSettingsUpdate(BaseModel):
    home_latitude: Optional[float] = None
    home_longitude: Optional[float] = None
    home_address: Optional[str] = None
    work_latitude: Optional[float] = None
    work_longitude: Optional[float] = None
    work_address: Optional[str] = None
    active_start_hour: Optional[int] = None
    active_end_hour: Optional[int] = None
    notification_radius: Optional[int] = None