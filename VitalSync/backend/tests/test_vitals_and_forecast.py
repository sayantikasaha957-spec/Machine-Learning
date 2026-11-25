from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_auth_header():
    resp = client.post("/api/v1/auth/login", data={"username": "nurse@vitalsync.com", "password": "Nurse123!"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_get_patient_vitals():
    headers = get_auth_header()
    resp = client.get("/api/v1/patients/1/vitals?limit=50", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["patient_id"] == 1
    assert data["count"] > 0
    first = data["data"][0]
    assert "hr" in first
    assert "sbp" in first
    assert "dbp" in first
    assert "timestamp" in first


def test_get_patient_forecast():
    headers = get_auth_header()
    resp = client.get("/api/v1/patients/1/forecast?horizon=12", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["patient_id"] == 1
    assert data["horizon_minutes"] == 12
    assert len(data["forecast_timestamps"]) == 12
    assert len(data["mean"]["heart_rate"]) == 12
    assert len(data["lower_90"]["heart_rate"]) == 12
    assert len(data["upper_90"]["heart_rate"]) == 12
    # Check that upper bound is >= lower bound
    for step in range(12):
        assert data["upper_90"]["heart_rate"][step] >= data["lower_90"]["heart_rate"][step]
        assert data["upper_90"]["systolic_bp"][step] >= data["lower_90"]["systolic_bp"][step]
