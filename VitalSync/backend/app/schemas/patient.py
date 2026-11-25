from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class PatientBase(BaseModel):
    name: str
    age: int = Field(ge=0, le=130)
    gender: str = Field(description="Male, Female, Other")
    conditions: Optional[str] = None
    room: Optional[str] = None
    doctor_id: Optional[int] = None
    status: str = Field(default="stable", description="stable, warning, critical")


class PatientCreate(PatientBase):
    patient_uid: Optional[str] = None


class PatientUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=0, le=130)
    gender: Optional[str] = None
    conditions: Optional[str] = None
    room: Optional[str] = None
    doctor_id: Optional[int] = None
    status: Optional[str] = None


class PatientOut(PatientBase):
    id: int
    patient_uid: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PatientListOut(BaseModel):
    total: int
    page: int
    page_size: int
    patients: List[PatientOut]
