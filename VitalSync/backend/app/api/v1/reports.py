from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.app.core.database import get_db
from backend.app.core.deps import get_current_active_user
from backend.app.models.patient import Patient
from backend.app.models.vitals import Vitals
from backend.app.models.alert import Alert
from backend.app.models.user import User
from backend.app.services.report_service import export_patient_csv, export_patient_pdf

router = APIRouter(prefix="/reports", tags=["Reports Export"])


@router.get("/patient/{patient_id}/export")
def export_patient_report(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    format_type: str = Query("csv", alias="format", description="Export format: csv or pdf"),
):
    """Exports patient clinical telemetry records and alert history in CSV or PDF format."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    vitals = (
        db.query(Vitals)
        .filter(Vitals.patient_id == patient_id)
        .order_by(Vitals.timestamp.asc())
        .limit(1000)
        .all()
    )
    alerts = (
        db.query(Alert)
        .filter(Alert.patient_id == patient_id)
        .order_by(desc(Alert.created_at))
        .limit(50)
        .all()
    )

    fmt = format_type.lower()
    if fmt == "csv":
        csv_content = export_patient_csv(patient, vitals, alerts)
        filename = f"vitalsync_patient_{patient_id}.csv"
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    elif fmt == "pdf":
        pdf_bytes = export_patient_pdf(patient, vitals, alerts)
        filename = f"vitalsync_patient_{patient_id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Choose 'csv' or 'pdf'.")
