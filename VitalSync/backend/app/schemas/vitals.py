from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class VitalsBase(BaseModel):
    hr: float = Field(..., description="Heart Rate (bpm)")
    sbp: float = Field(..., description="Systolic Blood Pressure (mmHg)")
    dbp: float = Field(..., description="Diastolic Blood Pressure (mmHg)")


class VitalsCreate(VitalsBase):
    patient_id: int
    timestamp: Optional[datetime] = None


class VitalsOut(VitalsBase):
    id: int
    patient_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class VitalsSeriesOut(BaseModel):
    patient_id: int
    count: int
    data: List[VitalsOut]
