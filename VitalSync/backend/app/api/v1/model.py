import os
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.deps import get_current_active_user, require_roles
from backend.app.models.user import User
from backend.app.schemas.model import ModelInfoResponse, RetrainRequest, RetrainStatusResponse
from backend.app.services.retrain_service import trigger_retrain_task, get_latest_job, get_job_by_id

router = APIRouter(prefix="/model", tags=["ML Model"])

METRICS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "ml", "reports", "metrics.json"))


@router.get("/info", response_model=ModelInfoResponse)
def get_model_info():
    """Returns active LSTM model metadata, architecture description, and training horizon."""
    metrics_data = {}
    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH, "r", encoding="utf-8") as f:
                metrics_data = json.load(f)
        except Exception:
            pass

    return ModelInfoResponse(
        version="v1.0.0",
        architecture="Stacked LSTM (128 -> Dropout(0.2) -> 64 -> Dropout(0.2) -> Dense(36))",
        lookback_minutes=60,
        horizon_steps=12,
        features=["heart_rate", "systolic_bp", "diastolic_bp"],
        trained_at=metrics_data.get("timestamp", "2026-11-23T18:28:48Z"),
        active=True,
        metrics=metrics_data,
    )


@router.get("/metrics")
def get_model_metrics():
    """Returns the comprehensive benchmark evaluation metrics comparing LSTM vs clinical baselines."""
    if not os.path.exists(METRICS_PATH):
        raise HTTPException(status_code=404, detail="Model metrics report not found.")

    with open(METRICS_PATH, "r", encoding="utf-8") as f:
        metrics_data = json.load(f)
    return metrics_data


@router.post("/retrain", response_model=RetrainStatusResponse, status_code=status.HTTP_202_ACCEPTED)
def trigger_retraining(
    request: RetrainRequest,
    current_user: User = Depends(require_roles("admin")),
):
    """Triggers an asynchronous model retraining job (Admin only)."""
    task_id = trigger_retrain_task(
        epochs=request.epochs,
        batch_size=request.batch_size,
        data_path=request.data_path,
    )
    job = get_job_by_id(task_id)
    return RetrainStatusResponse(**job)


@router.get("/retrain/status", response_model=RetrainStatusResponse)
def get_retraining_status(
    task_id: str = None,
    current_user: User = Depends(require_roles("admin", "doctor")),
):
    """Polls the status of the current or specified model retraining task."""
    job = get_job_by_id(task_id) if task_id else get_latest_job()
    if not job:
        return RetrainStatusResponse(
            task_id="none",
            status="idle",
            started_at=None,
            completed_at=None,
            version=None,
            error=None,
            metrics_summary=None,
        )
    return RetrainStatusResponse(**job)
