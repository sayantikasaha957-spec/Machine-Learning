from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import asc
from backend.app.core.database import get_db
from backend.app.core.deps import get_current_active_user
from backend.app.models.patient import Patient
from backend.app.models.vitals import Vitals
from backend.app.models.user import User
from backend.app.schemas.vitals import VitalsSeriesOut, VitalsOut
from backend.app.schemas.forecast import ForecastResponse
from backend.app.services.forecast_service import forecast_service

router = APIRouter(prefix="/patients", tags=["Vitals & Forecasting"])


@router.get("/{patient_id}/vitals", response_model=VitalsSeriesOut)
def get_patient_vitals(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    from_time: Optional[datetime] = Query(None, alias="from", description="Start timestamp filter (ISO format)"),
    to_time: Optional[datetime] = Query(None, alias="to", description="End timestamp filter (ISO format)"),
    limit: int = Query(500, ge=1, le=5000, description="Max readings to return"),
):
    """Retrieves physiological vitals time-series with optional time range filtering."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    query = db.query(Vitals).filter(Vitals.patient_id == patient_id)

    if from_time:
        query = query.filter(Vitals.timestamp >= from_time)
    if to_time:
        query = query.filter(Vitals.timestamp <= to_time)

    # Order ascending for time-series charts
    readings = query.order_by(asc(Vitals.timestamp)).limit(limit).all()

    return VitalsSeriesOut(
        patient_id=patient_id,
        count=len(readings),
        data=readings,
    )


@router.get("/{patient_id}/forecast", response_model=ForecastResponse)
def get_patient_forecast(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    horizon: int = Query(12, ge=1, le=60, description="Forecast horizon in 1-minute steps (default: 12)"),
):
    """
    Computes LSTM 12-minute physiological forecast with 90% confidence bands
    via Monte Carlo Dropout and checks for predictive deterioration alerts.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    try:
        forecast_result = forecast_service.get_patient_forecast(
            db=db,
            patient_id=patient_id,
            horizon_steps=horizon,
            n_passes=30,
        )
        return forecast_result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forecasting engine error: {str(e)}",
        )
