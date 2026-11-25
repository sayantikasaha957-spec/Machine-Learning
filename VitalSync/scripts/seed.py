"""
VitalSync Database Seed Script
Populates SQLite database with:
- Demo healthcare users (admin, doctor, nurse)
- Clinical patients imported from /ml/data/processed/vitals.parquet
- The last 48 hours of 1-minute physiological telemetry readings
- Clinical threshold & predicted alerts
- Progress notes
- Initial model run metadata
"""

import os
import sys
import json
import random
from datetime import datetime, timedelta
import pandas as pd

# Add project root to path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

from backend.app.core.database import SessionLocal, Base, engine
from backend.app.core.security import get_password_hash
from backend.app.models.user import User
from backend.app.models.patient import Patient
from backend.app.models.vitals import Vitals
from backend.app.models.alert import Alert
from backend.app.models.note import Note
from backend.app.models.model_run import ModelRun

DATA_PARQUET = os.path.join(ROOT_DIR, "ml", "data", "processed", "vitals.parquet")
METRICS_JSON = os.path.join(ROOT_DIR, "ml", "reports", "metrics.json")

DEMO_USERS = [
    {
        "email": "admin@vitalsync.com",
        "password": "Admin123!",
        "full_name": "Dr. Sarah Chen (Chief Medical Admin)",
        "role": "admin",
    },
    {
        "email": "doctor@vitalsync.com",
        "password": "Doctor123!",
        "full_name": "Dr. Alex Rivers (Attending Intensivist)",
        "role": "doctor",
    },
    {
        "email": "nurse@vitalsync.com",
        "password": "Nurse123!",
        "full_name": "Nurse James Miller, BSN, RN",
        "role": "nurse",
    },
]

CLINICAL_CONDITIONS = [
    "Post-Coronary Artery Bypass (CABG)",
    "Acute Respiratory Distress (ARDS)",
    "Severe Sepsis Protocol",
    "Acute Decompensated Heart Failure",
    "Post-Operative Vascular Repair",
    "Hypertensive Urgency with Renal Impairment",
    "Post-Trauma ICU Monitoring",
    "COPD Exacerbation with Hypoxia",
    "Post-Valve Replacement Anticoagulation",
    "Diabetic Ketoacidosis Protocol",
]

PATIENT_NAMES = [
    ("Eleanor Vance", 68, "Female"),
    ("Robert Hayes", 74, "Male"),
    ("Marcus Sterling", 59, "Male"),
    ("Beatrice Lawson", 81, "Female"),
    ("David Kim", 63, "Male"),
    ("Clara Oswald", 52, "Female"),
    ("Arthur Pendelton", 79, "Male"),
    ("Miriam Webster", 66, "Female"),
    ("Franklin Morris", 71, "Male"),
    ("Julian Rossi", 47, "Male"),
    ("Grace Hopper", 84, "Female"),
    ("Thomas Shelby", 58, "Male"),
    ("Vivian Ward", 64, "Female"),
    ("Daniel Craig", 55, "Male"),
    ("Helena Bonham", 73, "Female"),
    ("Lucas Scott", 42, "Male"),
    ("Naomi Nagata", 61, "Female"),
    ("Victor Frankenstein", 77, "Male"),
    ("Diana Prince", 50, "Female"),
    ("James Holden", 67, "Male"),
]


def seed_database():
    print("=== VitalSync Database Seeder ===")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Demo Users
        print("Seeding demo healthcare users...")
        user_map = {}
        for u_data in DEMO_USERS:
            existing = db.query(User).filter(User.email == u_data["email"]).first()
            if not existing:
                user = User(
                    email=u_data["email"],
                    hashed_password=get_password_hash(u_data["password"]),
                    full_name=u_data["full_name"],
                    role=u_data["role"],
                    is_active=True,
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                user_map[u_data["role"]] = user
                print(f"  Created user: {u_data['email']} ({u_data['role']})")
            else:
                user_map[u_data["role"]] = existing
                print(f"  Existing user: {u_data['email']} ({u_data['role']})")

        doctor_user = user_map.get("doctor")

        # 2. Ingest Patients & Telemetry from processed parquet
        print(f"\nLoading vitals from {DATA_PARQUET}...")
        if not os.path.exists(DATA_PARQUET):
            raise FileNotFoundError(f"Parquet file {DATA_PARQUET} does not exist. Run Phase 1 first.")

        df_vitals = pd.read_parquet(DATA_PARQUET)
        available_pids = df_vitals["patient_id"].unique()
        print(f"Found {len(available_pids)} available patient sequences in dataset.")

        # Seed 20 patients with the last 48 hours of data
        num_seed_patients = min(len(PATIENT_NAMES), len(available_pids))
        print(f"Importing {num_seed_patients} patients and their last 48-hour readings...")

        total_readings_inserted = 0
        total_alerts_inserted = 0

        now = datetime.utcnow()

        for idx in range(num_seed_patients):
            orig_pid = available_pids[idx]
            name, age, gender = PATIENT_NAMES[idx]
            condition = CLINICAL_CONDITIONS[idx % len(CLINICAL_CONDITIONS)]
            room_no = f"ICU-{idx + 1:02d}"

            # Check if patient already seeded
            patient = db.query(Patient).filter(Patient.patient_uid == orig_pid).first()
            if not patient:
                patient = Patient(
                    patient_uid=orig_pid,
                    name=name,
                    age=age,
                    gender=gender,
                    conditions=condition,
                    room=room_no,
                    doctor_id=doctor_user.id if doctor_user else None,
                    status="stable",
                )
                db.add(patient)
                db.commit()
                db.refresh(patient)

            # Get patient's vitals segment
            sub = df_vitals[df_vitals["patient_id"] == orig_pid]
            # Take last 48 hours (up to 2880 rows)
            sub_48h = sub.iloc[-2880:] if len(sub) > 2880 else sub

            # Check if vitals already exist for this patient
            existing_count = db.query(Vitals).filter(Vitals.patient_id == patient.id).count()
            if existing_count == 0:
                vitals_batch = []
                n_rows = len(sub_48h)
                
                # Align timestamps to end at current time
                for row_idx, (_, r) in enumerate(sub_48h.iterrows()):
                    time_offset = timedelta(minutes=(n_rows - 1 - row_idx))
                    t_stamp = now - time_offset
                    vitals_batch.append(Vitals(
                        patient_id=patient.id,
                        timestamp=t_stamp,
                        hr=float(r["heart_rate"]),
                        sbp=float(r["systolic_bp"]),
                        dbp=float(r["diastolic_bp"]),
                    ))

                db.bulk_save_objects(vitals_batch)
                db.commit()
                total_readings_inserted += len(vitals_batch)

                # Seed sample alerts (real threshold breach + LSTM predicted warning)
                last_reading = vitals_batch[-1]
                # Check for any extreme readings in last 6 hours
                sample_alert_created = False
                for v in vitals_batch[-360:]:
                    if v.hr > 120 and not sample_alert_created:
                        db.add(Alert(
                            patient_id=patient.id,
                            type="Tachycardia",
                            severity="high",
                            message=f"Acute Tachycardia: Heart rate peaked at {v.hr:.1f} bpm",
                            predicted=False,
                            created_at=v.timestamp,
                            resolved=True,
                            resolved_at=v.timestamp + timedelta(minutes=25),
                            acknowledged_by=doctor_user.id if doctor_user else None,
                        ))
                        total_alerts_inserted += 1
                        sample_alert_created = True
                    elif v.sbp > 150 and not sample_alert_created:
                        db.add(Alert(
                            patient_id=patient.id,
                            type="Hypertension",
                            severity="medium",
                            message=f"Systolic Pressure Surge: {v.sbp:.1f} mmHg",
                            predicted=False,
                            created_at=v.timestamp,
                            resolved=False,
                        ))
                        total_alerts_inserted += 1
                        patient.status = "warning"
                        sample_alert_created = True

                # Inject an LSTM predicted alert for some patients
                if idx in [1, 4, 7]:
                    db.add(Alert(
                        patient_id=patient.id,
                        type="Predicted Hypotension",
                        severity="high",
                        message=f"LSTM Early Warning: Systolic BP predicted to trend below 88.0 mmHg in 12 minutes",
                        predicted=True,
                        created_at=now - timedelta(minutes=5),
                        resolved=False,
                    ))
                    patient.status = "warning"
                    total_alerts_inserted += 1

                # Seed sample clinical note
                db.add(Note(
                    patient_id=patient.id,
                    author_id=doctor_user.id if doctor_user else None,
                    content=f"Initial admission workup complete. Continuous vitals streaming configured. Primary condition: {condition}.",
                    created_at=now - timedelta(hours=24),
                ))
                db.add(Note(
                    patient_id=patient.id,
                    author_id=user_map.get("nurse", doctor_user).id,
                    content="Bedside telemetry verified. Transducer zeroed and line flushed. Patient resting comfortably.",
                    created_at=now - timedelta(hours=6),
                ))
                db.commit()

        # 3. Seed ModelRun metadata
        existing_model_run = db.query(ModelRun).filter(ModelRun.version == "v1.0.0").first()
        if not existing_model_run and os.path.exists(METRICS_JSON):
            with open(METRICS_JSON, "r", encoding="utf-8") as f:
                metrics_str = f.read()
            db.add(ModelRun(
                version="v1.0.0",
                metrics_json=metrics_str,
                trained_at=datetime.utcnow(),
                active=True,
            ))
            db.commit()
            print("  Seeded ModelRun (v1.0.0) from metrics.json.")

        print(f"\n=== Database Seeding Complete! ===")
        print(f"Total Patients: {db.query(Patient).count()}")
        print(f"Total Vitals Inserted: {total_readings_inserted:,}")
        print(f"Total Alerts: {db.query(Alert).count()}")
        print(f"Total Clinical Notes: {db.query(Note).count()}")

    except Exception as e:
        db.rollback()
        print(f"Seeding error: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
