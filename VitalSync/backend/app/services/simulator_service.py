"""
VitalSync Real-Time WebSocket Telemetry Simulator
Manages active WebSocket connections per patient, simulates realistic bedside telemetry
every 2-5 seconds, persists readings to SQLite, evaluates alerts, and broadcasts payloads.
"""

import asyncio
import json
import random
from datetime import datetime
from typing import Dict, Set, Optional
from fastapi import WebSocket
from sqlalchemy.orm import Session
from backend.app.core.database import SessionLocal
from backend.app.models.patient import Patient
from backend.app.models.vitals import Vitals
from backend.app.services.alert_engine import evaluate_vitals_thresholds


class ConnectionManager:
    """Manages active WebSocket channels categorized by patient_id."""
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, patient_id: int, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            if patient_id not in self.active_connections:
                self.active_connections[patient_id] = set()
            self.active_connections[patient_id].add(websocket)

    async def disconnect(self, patient_id: int, websocket: WebSocket):
        async with self._lock:
            if patient_id in self.active_connections:
                self.active_connections[patient_id].discard(websocket)
                if not self.active_connections[patient_id]:
                    del self.active_connections[patient_id]

    async def broadcast_patient(self, patient_id: int, message: dict):
        async with self._lock:
            sockets = list(self.active_connections.get(patient_id, []))
        
        for ws in sockets:
            try:
                await ws.send_json(message)
            except Exception:
                await self.disconnect(patient_id, ws)


ws_manager = ConnectionManager()


async def simulate_next_reading(patient_id: int, db: Session) -> dict:
    """
    Simulates the next realistic vital sign point based on historical baseline
    or physiological random walk, saves it to the database, and checks alerts.
    """
    last_reading = (
        db.query(Vitals)
        .filter(Vitals.patient_id == patient_id)
        .order_by(Vitals.timestamp.desc())
        .first()
    )

    if last_reading:
        base_hr = last_reading.hr
        base_sbp = last_reading.sbp
        base_dbp = last_reading.dbp
    else:
        base_hr, base_sbp, base_dbp = 74.0, 118.0, 78.0

    # Slight physiological jitter + occasional trend drift
    delta_hr = random.gauss(0, 1.2)
    delta_sbp = random.gauss(0, 1.8)
    delta_dbp = random.gauss(0, 1.0)

    # 3% chance of anomalous perturbation to exercise alert engine
    if random.random() < 0.03:
        perturbation_type = random.choice(["tachy", "hypo", "hyper"])
        if perturbation_type == "tachy":
            delta_hr += random.uniform(30, 50)
        elif perturbation_type == "hypo":
            delta_sbp -= random.uniform(25, 35)
        elif perturbation_type == "hyper":
            delta_sbp += random.uniform(25, 45)

    new_hr = round(float(min(max(base_hr + delta_hr, 40.0), 220.0)), 1)
    new_sbp = round(float(min(max(base_sbp + delta_sbp, 65.0), 220.0)), 1)
    new_dbp = round(float(min(max(base_dbp + delta_dbp, 35.0), new_sbp - 15.0)), 1)
    now = datetime.utcnow()

    # Save to SQLite
    vitals_entry = Vitals(
        patient_id=patient_id,
        timestamp=now,
        hr=new_hr,
        sbp=new_sbp,
        dbp=new_dbp,
    )
    db.add(vitals_entry)
    db.commit()
    db.refresh(vitals_entry)

    # Evaluate real-time threshold breaches
    new_alerts = evaluate_vitals_thresholds(
        db=db,
        patient_id=patient_id,
        hr=new_hr,
        sbp=new_sbp,
        dbp=new_dbp,
        timestamp=now,
    )

    payload = {
        "event": "vital_update",
        "patient_id": patient_id,
        "timestamp": now.isoformat(),
        "heart_rate": new_hr,
        "systolic_bp": new_sbp,
        "diastolic_bp": new_dbp,
        "alerts_triggered": [
            {"id": a.id, "type": a.type, "severity": a.severity, "message": a.message}
            for a in new_alerts
        ],
    }

    return payload
