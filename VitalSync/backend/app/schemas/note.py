from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NoteCreate(BaseModel):
    content: str


class NoteOut(BaseModel):
    id: int
    patient_id: int
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
