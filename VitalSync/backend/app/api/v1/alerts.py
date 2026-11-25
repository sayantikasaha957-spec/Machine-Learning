from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.app.core.database import get_db
from backend.app.core.deps import get_current_active_user, require_roles
from backend.app.models.alert import Alert
from backend.app.models.user import User
from backend.app.schemas.alert import AlertListOut, AlertOut

router = APIRouter(prefix="/alerts", tags=["Clinical Alerts"])


@router.get("", response_model=AlertListOut)
def list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    patient_id: Optional[int] = Query(None, description="Filter by patient ID"),
    severity: Optional[str] = Query(None, description="Filter by severity: low, medium, high, critical"),
    resolved: Optional[bool] = Query(None, description="Filter by resolved status"),
    predicted: Optional[bool] = Query(None, description="Filter by predicted flag"),
    limit: int = Query(50, ge=1, le=500, description="Max alerts to retrieve"),
):
    """Lists clinical alerts with filtering by severity, patient, and prediction type."""
    query = db.query(Alert)

    if patient_id is not None:
        query = query.filter(Alert.patient_id == patient_id)
    if severity is not None:
        query = query.filter(Alert.severity == severity.lower())
    if resolved is not None:
        query = query.filter(Alert.resolved == resolved)
    if predicted is not None:
        query = query.filter(Alert.predicted == predicted)

    total = query.count()
    unresolved_count = db.query(Alert).filter(Alert.resolved == False).count()
    critical_count = db.query(Alert).filter(Alert.severity == "critical", Alert.resolved == False).count()

    alerts = query.order_by(desc(Alert.created_at)).limit(limit).all()

    return AlertListOut(
        total=total,
        unresolved_count=unresolved_count,
        critical_count=critical_count,
        alerts=alerts,
    )


@router.post("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "doctor", "nurse")),
):
    """Marks an alert as acknowledged by the current healthcare provider."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found.")

    alert.acknowledged_by = current_user.id
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/{alert_id}/resolve", response_model=AlertOut)
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "doctor", "nurse")),
):
    """Resolves an alert after clinical intervention."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found.")

    alert.resolved = True
    alert.resolved_at = datetime.utcnow()
    if not alert.acknowledged_by:
        alert.acknowledged_by = current_user.id

    db.commit()
    db.refresh(alert)
    return alert
