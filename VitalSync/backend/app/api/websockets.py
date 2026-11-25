import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.app.core.database import SessionLocal
from backend.app.models.patient import Patient
from backend.app.services.simulator_service import ws_manager, simulate_next_reading

router = APIRouter(tags=["WebSockets"])


@router.websocket("/ws/vitals/{patient_id}")
async def websocket_vitals_stream(websocket: WebSocket, patient_id: int):
    """
    Real-time clinical telemetry streaming endpoint.
    Pushes continuous physiological readings and alert events every 2-5 seconds.
    """
    # Verify patient exists
    db = SessionLocal()
    try:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            await websocket.close(code=1008)
            return
    finally:
        db.close()

    await ws_manager.connect(patient_id, websocket)

    try:
        # Initial greeting payload
        await websocket.send_json({
            "event": "connected",
            "patient_id": patient_id,
            "message": f"Connected to live telemetry stream for patient {patient_id}",
        })

        while True:
            # Sleep 2 to 3 seconds between simulated updates
            await asyncio.sleep(2.5)

            # Generate new reading, persist to DB, evaluate alerts
            db_session = SessionLocal()
            try:
                payload = await simulate_next_reading(patient_id, db_session)
            finally:
                db_session.close()

            # Push to connected client
            await websocket.send_json(payload)

    except WebSocketDisconnect:
        await ws_manager.disconnect(patient_id, websocket)
    except Exception:
        await ws_manager.disconnect(patient_id, websocket)
