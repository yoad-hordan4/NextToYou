from pydantic import BaseModel
from typing import Optional, Dict

class TaskItem(BaseModel):
    id: Optional[str] = None
    title: str       # שם המוצר (למשל "Milk")
    category: str    # קטגוריה (למשל "Supermarket")
    is_completed: bool = False

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

class StoreDeal(BaseModel):
    store: str
    distance: int
    found_items: list