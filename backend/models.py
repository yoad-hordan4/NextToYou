from pydantic import BaseModel
from typing import Optional, List, Dict

class TaskItem(BaseModel):
    id: Optional[str] = None
    title: str
    category: str
    is_completed: bool = False

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

class StoreDeal(BaseModel):
    store: str
    distance: int
    found_items: List[Dict[str, float]]