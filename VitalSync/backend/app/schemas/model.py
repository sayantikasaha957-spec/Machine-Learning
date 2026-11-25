from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class ModelInfoResponse(BaseModel):
    version: str
    architecture: str
    lookback_minutes: int
    horizon_steps: int
    features: list
    trained_at: Optional[str] = None
    active: bool = True
    metrics: Dict[str, Any]


class RetrainRequest(BaseModel):
    epochs: int = 20
    batch_size: int = 128
    data_path: Optional[str] = None


class RetrainStatusResponse(BaseModel):
    task_id: str
    status: str  # idle, running, completed, failed
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    version: Optional[str] = None
    error: Optional[str] = None
    metrics_summary: Optional[Dict[str, Any]] = None
