from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.core.database import get_db
from backend.app.core.deps import get_current_active_user
from backend.app.models.patient import Patient
from backend.app.models.vitals import Vitals
from backend.app.models.alert import Alert
from backend.app.models.user import User
from backend.app.schemas.analytics import AnalyticsSummaryResponse, VitalsStat, DailyAlertCount

router = APIRouter(prefix="/analytics", tags=["Clinical Analytics"])


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Computes clinical summary analytics: daily averages, alerts breakdown, and trends."""
    now = datetime.utcnow()
    past_24h = now - timedelta(hours=24)
    past_7d = now - timedelta(days=7)

    total_patients = db.query(Patient).count()
    active_patients = db.query(Patient).filter(Patient.status.in_(["stable", "warning", "critical"])).count()

    total_alerts_24h = db.query(Alert).filter(Alert.created_at >= past_24h).count()
    critical_unresolved = db.query(Alert).filter(Alert.severity == "critical", Alert.resolved == False).count()

    # Vitals stats across last 24h
    stats_query = db.query(
        func.avg(Vitals.hr).label("avg_hr"),
        func.min(Vitals.hr).label("min_hr"),
        func.max(Vitals.hr).label("max_hr"),
        func.avg(Vitals.sbp).label("avg_sbp"),
        func.min(Vitals.sbp).label("min_sbp"),
        func.max(Vitals.sbp).label("max_sbp"),
        func.avg(Vitals.dbp).label("avg_dbp"),
        func.min(Vitals.dbp).label("min_dbp"),
        func.max(Vitals.dbp).label("max_dbp"),
    ).filter(Vitals.timestamp >= past_24h).first()

    def _val(v, fallback=0.0):
        return round(float(v), 1) if v is not None else fallback

    # If no 24h data, fallback to all-time averages
    if not stats_query or stats_query.avg_hr is None:
        stats_query = db.query(
            func.avg(Vitals.hr).label("avg_hr"),
            func.min(Vitals.hr).label("min_hr"),
            func.max(Vitals.hr).label("max_hr"),
            func.avg(Vitals.sbp).label("avg_sbp"),
            func.min(Vitals.sbp).label("min_sbp"),
            func.max(Vitals.sbp).label("max_sbp"),
            func.avg(Vitals.dbp).label("avg_dbp"),
            func.min(Vitals.dbp).label("min_dbp"),
            func.max(Vitals.dbp).label("max_dbp"),
        ).first()

    averages = {
        "heart_rate": VitalsStat(mean=_val(stats_query.avg_hr, 74.0), min=_val(stats_query.min_hr, 45.0), max=_val(stats_query.max_hr, 160.0)),
        "systolic_bp": VitalsStat(mean=_val(stats_query.avg_sbp, 118.0), min=_val(stats_query.min_sbp, 80.0), max=_val(stats_query.max_sbp, 190.0)),
        "diastolic_bp": VitalsStat(mean=_val(stats_query.avg_dbp, 78.0), min=_val(stats_query.min_dbp, 40.0), max=_val(stats_query.max_dbp, 110.0)),
    }

    # Daily alerts over last 7 days
    daily_alerts = []
    for d in range(7):
        day_start = (now - timedelta(days=6 - d)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        cnt = db.query(Alert).filter(Alert.created_at >= day_start, Alert.created_at < day_end).count()
        crit = db.query(Alert).filter(Alert.created_at >= day_start, Alert.created_at < day_end, Alert.severity == "critical").count()
        daily_alerts.append(DailyAlertCount(
            date=day_start.strftime("%Y-%m-%d"),
            count=cnt,
            critical=crit,
        ))

    return AnalyticsSummaryResponse(
        total_patients=total_patients,
        active_monitoring_patients=active_patients,
        total_alerts_24h=total_alerts_24h,
        critical_alerts_unresolved=critical_unresolved,
        averages_24h=averages,
        alerts_over_time=daily_alerts,
    )
