from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_websocket_vitals_streaming():
    """Tests WebSocket endpoint connection and receiving streamed telemetry payloads."""
    with client.websocket_connect("/ws/vitals/1") as websocket:
        # First greeting message
        greeting = websocket.receive_json()
        assert greeting["event"] == "connected"
        assert greeting["patient_id"] == 1

        # Second streamed reading message
        update = websocket.receive_json()
        assert update["event"] == "vital_update"
        assert update["patient_id"] == 1
        assert "heart_rate" in update
        assert "systolic_bp" in update
        assert "diastolic_bp" in update
        assert "timestamp" in update
