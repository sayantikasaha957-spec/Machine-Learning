"""
VitalSync Asynchronous Retraining Service
Handles background neural network retraining jobs with thread-safe status polling.
"""

import threading
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

_RETRAIN_JOBS: Dict[str, Dict[str, Any]] = {}
_LOCK = threading.Lock()


def get_latest_job() -> Optional[Dict[str, Any]]:
    """Returns the most recent retraining task state."""
    with _LOCK:
        if not _RETRAIN_JOBS:
            return None
        latest_id = list(_RETRAIN_JOBS.keys())[-1]
        return _RETRAIN_JOBS[latest_id]


def get_job_by_id(task_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        return _RETRAIN_JOBS.get(task_id)


def trigger_retrain_task(epochs: int = 15, batch_size: int = 128, data_path: Optional[str] = None) -> str:
    """Launches a background training job and registers its task_id."""
    task_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()

    job_state = {
        "task_id": task_id,
        "status": "running",
        "started_at": now,
        "completed_at": None,
        "version": None,
        "error": None,
        "metrics_summary": None,
    }

    with _LOCK:
        _RETRAIN_JOBS[task_id] = job_state

    def _worker():
        try:
            from ml.retrain import retrain_pipeline
            target_data = data_path or "ml/data/processed/vitals.parquet"
            new_version = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            res = retrain_pipeline(
                data_path=target_data,
                version=new_version,
                epochs=epochs,
                batch_size=batch_size,
            )
            with _LOCK:
                _RETRAIN_JOBS[task_id]["status"] = "completed"
                _RETRAIN_JOBS[task_id]["completed_at"] = datetime.utcnow().isoformat()
                _RETRAIN_JOBS[task_id]["version"] = new_version
                _RETRAIN_JOBS[task_id]["metrics_summary"] = {
                    "overall_mae": res.get("metrics", {}).get("overall_mae"),
                    "overall_rmse": res.get("metrics", {}).get("overall_rmse"),
                }
        except Exception as e:
            with _LOCK:
                _RETRAIN_JOBS[task_id]["status"] = "failed"
                _RETRAIN_JOBS[task_id]["completed_at"] = datetime.utcnow().isoformat()
                _RETRAIN_JOBS[task_id]["error"] = str(e)

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
    return task_id
