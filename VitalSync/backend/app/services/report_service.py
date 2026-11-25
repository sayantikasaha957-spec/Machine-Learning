"""
VitalSync Clinical Report Export Service
Generates patient telemetry summaries and alert audit trails in CSV and PDF formats.
"""

import io
import csv
from datetime import datetime
from typing import List
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from backend.app.models.patient import Patient
from backend.app.models.vitals import Vitals
from backend.app.models.alert import Alert


def export_patient_csv(patient: Patient, vitals: List[Vitals], alerts: List[Alert]) -> str:
    """Exports patient demographics, readings, and alerts into CSV format."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header / Demographics
    writer.writerow(["VitalSync Clinical Patient Export"])
    writer.writerow(["Exported At", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")])
    writer.writerow(["Patient ID", patient.id, "UID", patient.patient_uid or "N/A"])
    writer.writerow(["Name", patient.name, "Age", patient.age, "Gender", patient.gender])
    writer.writerow(["Room", patient.room or "Unassigned", "Conditions", patient.conditions or "None"])
    writer.writerow(["Clinical Status", patient.status])
    writer.writerow([])

    # Alerts Section
    writer.writerow(["--- Clinical Alerts History ---"])
    writer.writerow(["Alert ID", "Timestamp", "Type", "Severity", "Predicted Ahead", "Resolved", "Message"])
    for a in alerts:
        writer.writerow([
            a.id,
            a.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            a.type,
            a.severity,
            "Yes" if a.predicted else "No",
            "Yes" if a.resolved else "No",
            a.message,
        ])
    writer.writerow([])

    # Vitals Section
    writer.writerow(["--- Physiological Telemetry Stream ---"])
    writer.writerow(["Reading ID", "Timestamp", "Heart Rate (bpm)", "Systolic BP (mmHg)", "Diastolic BP (mmHg)"])
    for v in vitals:
        writer.writerow([
            v.id,
            v.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            v.hr,
            v.sbp,
            v.dbp,
        ])

    return output.getvalue()


def export_patient_pdf(patient: Patient, vitals: List[Vitals], alerts: List[Alert]) -> bytes:
    """Renders a clinical telemetry and forecasting report in PDF format."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1FA89A"),
    )
    section_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#4A7BD0"),
        spaceBefore=10,
        spaceAfter=6,
    )
    meta_style = ParagraphStyle(
        "MetaText",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748B"),
    )

    elements = []

    # Title
    elements.append(Paragraph("VitalSync Clinical Health & Telemetry Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} | Platform: VitalSync v0.1.0", meta_style))
    elements.append(Spacer(1, 14))

    # Patient Demographic Table
    demo_data = [
        ["Patient Name", patient.name, "Patient UID", patient.patient_uid or f"P-{patient.id:04d}"],
        ["Age / Gender", f"{patient.age} yrs / {patient.gender}", "Room / Bed", patient.room or "Unassigned"],
        ["Clinical Status", patient.status.upper(), "Known Conditions", patient.conditions or "None documented"],
    ]
    demo_table = Table(demo_data, colWidths=[110, 160, 110, 160])
    demo_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#1E293B")),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(demo_table)
    elements.append(Spacer(1, 14))

    # Recent Alerts Summary
    elements.append(Paragraph("Recent Clinical Alerts & Predictive Warnings", section_style))
    if alerts:
        alert_rows = [["Timestamp", "Type", "Severity", "Source", "Message"]]
        for a in alerts[:8]:  # Up to 8 most recent
            alert_rows.append([
                a.created_at.strftime("%m-%d %H:%M"),
                a.type,
                a.severity.upper(),
                "LSTM Predicted" if a.predicted else "Threshold",
                Paragraph(a.message, styles["Normal"]),
            ])
        alert_table = Table(alert_rows, colWidths=[70, 95, 60, 85, 230])
        alert_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1FA89A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(alert_table)
    else:
        elements.append(Paragraph("No critical alerts triggered for this patient.", styles["Normal"]))

    elements.append(Spacer(1, 14))

    # Recent Vitals Readings
    elements.append(Paragraph("Recent Physiological Vitals (Last 10 Observations)", section_style))
    if vitals:
        vitals_rows = [["Time (UTC)", "Heart Rate (bpm)", "Systolic BP (mmHg)", "Diastolic BP (mmHg)", "Pulse Pressure"]]
        recent_subset = list(reversed(vitals[-10:]))
        for v in recent_subset:
            vitals_rows.append([
                v.timestamp.strftime("%Y-%m-%d %H:%M"),
                f"{v.hr:.1f}",
                f"{v.sbp:.1f}",
                f"{v.dbp:.1f}",
                f"{v.sbp - v.dbp:.1f}",
            ])
        v_table = Table(vitals_rows, colWidths=[120, 105, 105, 105, 105])
        v_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4A7BD0")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("PADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(v_table)

    doc.build(elements)
    return buffer.getvalue()
