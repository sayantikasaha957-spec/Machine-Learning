from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ForecastTrajectory(BaseModel):
    heart_rate: List[float]
    systolic_bp: List[float]
    diastolic_bp: List[float]


class ForecastResponse(BaseModel):
    patient_id: int
    horizon_minutes: int
    confidence_level: float = 0.90
    forecast_timestamps: List[str]
    features: List[str]
    mean: ForecastTrajectory
    lower_90: ForecastTrajectory
    upper_90: ForecastTrajectory
    alert_predicted: bool = False
    predicted_alerts: List[str] = []
