from typing import List, Dict, Any
from pydantic import BaseModel


class VitalsStat(BaseModel):
    mean: float
    min: float
    max: float


class DailyAlertCount(BaseModel):
    date: str
    count: int
    critical: int


class AnalyticsSummaryResponse(BaseModel):
    total_patients: int
    active_monitoring_patients: int
    total_alerts_24h: int
    critical_alerts_unresolved: int
    averages_24h: Dict[str, VitalsStat]
    alerts_over_time: List[DailyAlertCount]
