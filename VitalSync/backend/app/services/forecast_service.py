"""
VitalSync Forecast Service
Pre-loads the trained LSTM model and StandardScaler once at application startup,
manages patient lookback queries, executes multi-horizon inference, and triggers predicted alerts.
"""

import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

# Import inference utilities from ML module
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from ml.predict import get_model_and_scaler, forecast as run_ml_forecast, LOOKBACK, HORIZON, FEATURES
from backend.app.models.vitals import Vitals
from backend.app.models.patient import Patient
from backend.app.schemas.forecast import ForecastResponse, ForecastTrajectory
from backend.app.services.alert_engine import evaluate_predicted_trajectory


class ForecastService:
    def __init__(self):
        self._model = None
        self._scaler = None

    def warmup(self):
        """Pre-load model and scaler into memory on startup and warm up the computation graph."""
        try:
            self._model, self._scaler = get_model_and_scaler()
            dummy_df = pd.DataFrame(
                np.zeros((60, 3), dtype=np.float32) + [75.0, 120.0, 80.0],
                columns=FEATURES,
            )
            run_ml_forecast(dummy_df, n_passes=2)
            print("[VitalSync] ForecastService: LSTM model and StandardScaler pre-loaded and graph warmed up.")
        except Exception as e:
            print(f"[VitalSync] ForecastService warmup warning: {e}")

    def get_patient_forecast(
        self,
        db: Session,
        patient_id: int,
        horizon_steps: int = 12,
        n_passes: int = 30,
    ) -> ForecastResponse:
        """
        Retrieves the latest 60-minute window for the patient from the database,
        computes the 12-minute forward forecast with 90% confidence bands,
        and triggers predicted clinical alerts if breaches are anticipated.
        """
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise ValueError(f"Patient with id {patient_id} not found.")

        # Query recent 60 readings ordered by timestamp ascending
        recent_vitals = (
            db.query(Vitals)
            .filter(Vitals.patient_id == patient_id)
            .order_by(Vitals.timestamp.desc())
            .limit(LOOKBACK)
            .all()
        )

        if not recent_vitals:
            # Generate baseline readings based on patient's current status if no vitals yet
            now = datetime.utcnow()
            readings = [
                {"timestamp": now - timedelta(minutes=LOOKBACK - i), "heart_rate": 72.0, "systolic_bp": 120.0, "diastolic_bp": 80.0}
                for i in range(LOOKBACK)
            ]
            recent_df = pd.DataFrame(readings)
        elif len(recent_vitals) < LOOKBACK:
            # If fewer than 60 readings, pad front with first available reading
            sorted_vitals = list(reversed(recent_vitals))
            first = sorted_vitals[0]
            pad_count = LOOKBACK - len(sorted_vitals)
            padded = [
                {"timestamp": first.timestamp - timedelta(minutes=pad_count - i), "heart_rate": first.hr, "systolic_bp": first.sbp, "diastolic_bp": first.dbp}
                for i in range(pad_count)
            ]
            for v in sorted_vitals:
                padded.append({"timestamp": v.timestamp, "heart_rate": v.hr, "systolic_bp": v.sbp, "diastolic_bp": v.dbp})
            recent_df = pd.DataFrame(padded)
        else:
            sorted_vitals = list(reversed(recent_vitals))
            recent_df = pd.DataFrame([
                {"timestamp": v.timestamp, "heart_rate": v.hr, "systolic_bp": v.sbp, "diastolic_bp": v.dbp}
                for v in sorted_vitals
            ])

        # Run inference through ML module with Monte Carlo Dropout
        pred_dict = run_ml_forecast(recent_df, n_passes=n_passes, confidence=0.90)

        # Trigger predicted alert checks in alert engine
        predicted_alerts_raised = evaluate_predicted_trajectory(
            db=db,
            patient_id=patient_id,
            mean_forecast=pred_dict["mean"],
            timestamps=pred_dict["timestamps"],
        )

        alert_names = [a.message for a in predicted_alerts_raised]

        return ForecastResponse(
            patient_id=patient_id,
            horizon_minutes=horizon_steps,
            confidence_level=0.90,
            forecast_timestamps=pred_dict["timestamps"][:horizon_steps],
            features=FEATURES,
            mean=ForecastTrajectory(
                heart_rate=pred_dict["mean"]["heart_rate"][:horizon_steps],
                systolic_bp=pred_dict["mean"]["systolic_bp"][:horizon_steps],
                diastolic_bp=pred_dict["mean"]["diastolic_bp"][:horizon_steps],
            ),
            lower_90=ForecastTrajectory(
                heart_rate=pred_dict["lower"]["heart_rate"][:horizon_steps],
                systolic_bp=pred_dict["lower"]["systolic_bp"][:horizon_steps],
                diastolic_bp=pred_dict["lower"]["diastolic_bp"][:horizon_steps],
            ),
            upper_90=ForecastTrajectory(
                heart_rate=pred_dict["upper"]["heart_rate"][:horizon_steps],
                systolic_bp=pred_dict["upper"]["systolic_bp"][:horizon_steps],
                diastolic_bp=pred_dict["upper"]["diastolic_bp"][:horizon_steps],
            ),
            alert_predicted=len(alert_names) > 0,
            predicted_alerts=alert_names,
        )


forecast_service = ForecastService()
