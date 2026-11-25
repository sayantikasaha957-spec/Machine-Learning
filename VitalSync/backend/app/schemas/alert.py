from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class AlertBase(BaseModel):
    patient_id: int
    type: str = Field(..., description="tachycardia, bradycardia, hypertension, hypotension, etc.")
    severity: str = Field(default="medium", description="low, medium, high, critical")
    message: str
    predicted: bool = Field(default=False, description="True if predicted ahead of time by LSTM")


class AlertCreate(AlertBase):
    pass


class AlertOut(AlertBase):
    id: int
    created_at: datetime
    acknowledged_by: Optional[int] = None
    resolved: bool
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertListOut(BaseModel):
    total: int
    unresolved_count: int
    critical_count: int
    alerts: List[AlertOut]
