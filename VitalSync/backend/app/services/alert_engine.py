"""
VitalSync Clinical Alert Engine
Monitors physiological thresholds and predicted LSTM forward anomalies,
generating prioritized clinical alerts while enforcing anti-spam cooldowns.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from backend.app.models.alert import Alert
from backend.app.models.patient import Patient

# In-memory cooldown tracking: (patient_id, alert_type, predicted_bool) -> last_alert_datetime
_COOLDOWN_REGISTRY: Dict[Tuple[int, str, bool], datetime] = {}
COOLDOWN_MINUTES = 5  # Anti-spam cooldown per patient & alert type


def evaluate_vitals_thresholds(
    db: Session,
    patient_id: int,
    hr: float,
    sbp: float,
    dbp: float,
    timestamp: Optional[datetime] = None,
) -> List[Alert]:
    """
    Evaluates real-time vital signs against ICU clinical alert thresholds:
    - HR > 120 bpm (Tachycardia: Critical if > 140, High if > 120)
    - HR < 50 bpm (Bradycardia: Critical if < 40, High if < 50)
    - SBP > 140 mmHg (Hypertension: Critical if > 180, High if > 140)
    - SBP < 90 mmHg (Hypotension: Critical if < 80, High if < 90)
    - DBP > 90 mmHg (Diastolic Hypertension: High)
    """
    if timestamp is None:
        timestamp = datetime.utcnow()

    alerts_to_create = []

    # 1. Heart Rate Checks
    if hr > 120:
        sev = "critical" if hr > 140 else "high"
        alerts_to_create.append({
            "type": "Tachycardia",
            "severity": sev,
            "message": f"Elevated Heart Rate detected: {hr:.1f} bpm (Threshold: > 120 bpm)",
            "predicted": False,
        })
    elif hr < 50:
        sev = "critical" if hr < 40 else "high"
        alerts_to_create.append({
            "type": "Bradycardia",
            "severity": sev,
            "message": f"Low Heart Rate detected: {hr:.1f} bpm (Threshold: < 50 bpm)",
            "predicted": False,
        })

    # 2. Systolic Blood Pressure Checks
    if sbp > 140:
        sev = "critical" if sbp > 180 else "high"
        alerts_to_create.append({
            "type": "Hypertension",
            "severity": sev,
            "message": f"Elevated Systolic Blood Pressure: {sbp:.1f} mmHg (Threshold: > 140 mmHg)",
            "predicted": False,
        })
    elif sbp < 90:
        sev = "critical" if sbp < 80 else "high"
        alerts_to_create.append({
            "type": "Hypotension",
            "severity": sev,
            "message": f"Low Systolic Blood Pressure: {sbp:.1f} mmHg (Threshold: < 90 mmHg)",
            "predicted": False,
        })

    # 3. Diastolic Blood Pressure Check
    if dbp > 90:
        sev = "critical" if dbp > 110 else "high"
        alerts_to_create.append({
            "type": "Diastolic Hypertension",
            "severity": sev,
            "message": f"Elevated Diastolic Blood Pressure: {dbp:.1f} mmHg (Threshold: > 90 mmHg)",
            "predicted": False,
        })

    return _persist_alerts(db, patient_id, alerts_to_create, timestamp)


def evaluate_predicted_trajectory(
    db: Session,
    patient_id: int,
    mean_forecast: Dict[str, List[float]],
    timestamps: List[str],
) -> List[Alert]:
    """
    Evaluates LSTM multi-step forecasted values over the upcoming horizon.
    If a threshold breach is predicted, generates an early-warning alert marked predicted=True.
    """
    alerts_to_create = []

    hr_forecast = mean_forecast.get("heart_rate", [])
    sbp_forecast = mean_forecast.get("systolic_bp", [])
    dbp_forecast = mean_forecast.get("diastolic_bp", [])

    # Check for predicted tachycardia/bradycardia
    max_hr = max(hr_forecast) if hr_forecast else 0
    min_hr = min(hr_forecast) if hr_forecast else 999

    if max_hr > 120:
        step_idx = hr_forecast.index(max_hr)
        alerts_to_create.append({
            "type": "Predicted Tachycardia",
            "severity": "high",
            "message": f"Predicted Tachycardia: HR expected to reach {max_hr:.1f} bpm at t+{step_idx + 1}m",
            "predicted": True,
        })
    elif min_hr < 50:
        step_idx = hr_forecast.index(min_hr)
        alerts_to_create.append({
            "type": "Predicted Bradycardia",
            "severity": "high",
            "message": f"Predicted Bradycardia: HR expected to drop to {min_hr:.1f} bpm at t+{step_idx + 1}m",
            "predicted": True,
        })

    # Check for predicted hypotension/hypertension
    max_sbp = max(sbp_forecast) if sbp_forecast else 0
    min_sbp = min(sbp_forecast) if sbp_forecast else 999

    if min_sbp < 90:
        step_idx = sbp_forecast.index(min_sbp)
        alerts_to_create.append({
            "type": "Predicted Hypotension",
            "severity": "high",
            "message": f"Impending Decompensation: SBP forecasted to drop to {min_sbp:.1f} mmHg at t+{step_idx + 1}m",
            "predicted": True,
        })
    elif max_sbp > 140:
        step_idx = sbp_forecast.index(max_sbp)
        alerts_to_create.append({
            "type": "Predicted Hypertension",
            "severity": "medium",
            "message": f"Predicted Hypertension: SBP expected to reach {max_sbp:.1f} mmHg at t+{step_idx + 1}m",
            "predicted": True,
        })

    return _persist_alerts(db, patient_id, alerts_to_create, datetime.utcnow())


def _persist_alerts(
    db: Session,
    patient_id: int,
    alert_defs: List[dict],
    now: datetime,
) -> List[Alert]:
    """Applies anti-spam cooldown and commits new alerts to SQLite."""
    created = []
    has_critical = False

    for ad in alert_defs:
        key = (patient_id, ad["type"], ad["predicted"])
        last_time = _COOLDOWN_REGISTRY.get(key)

        # Check cooldown
        if last_time and (now - last_time) < timedelta(minutes=COOLDOWN_MINUTES):
            continue  # Suppress duplicate alert within cooldown window

        _COOLDOWN_REGISTRY[key] = now
        alert = Alert(
            patient_id=patient_id,
            type=ad["type"],
            severity=ad["severity"],
            message=ad["message"],
            predicted=ad["predicted"],
            created_at=now,
            resolved=False,
        )
        db.add(alert)
        created.append(alert)
        if ad["severity"] == "critical":
            has_critical = True

    if created:
        # Update patient status if critical alert active
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if patient:
            if has_critical:
                patient.status = "critical"
            elif patient.status == "stable":
                patient.status = "warning"
        db.commit()
        for a in created:
            db.refresh(a)

    return created
