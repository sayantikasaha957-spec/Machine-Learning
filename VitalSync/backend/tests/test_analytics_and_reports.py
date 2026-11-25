from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_auth_header():
    resp = client.post("/api/v1/auth/login", data={"username": "doctor@vitalsync.com", "password": "Doctor123!"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_analytics_summary():
    headers = get_auth_header()
    resp = client.get("/api/v1/analytics/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_patients"] >= 20
    assert "heart_rate" in data["averages_24h"]
    assert "systolic_bp" in data["averages_24h"]
    assert "diastolic_bp" in data["averages_24h"]
    assert len(data["alerts_over_time"]) == 7


def test_report_export_csv():
    headers = get_auth_header()
    resp = client.get("/api/v1/reports/patient/1/export?format=csv", headers=headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment" in resp.headers["content-disposition"]
    text = resp.text
    assert "VitalSync Clinical Patient Export" in text
    assert "Heart Rate" in text


def test_report_export_pdf():
    headers = get_auth_header()
    resp = client.get("/api/v1/reports/patient/1/export?format=pdf", headers=headers)
    assert resp.status_code == 200
    assert "application/pdf" in resp.headers["content-type"]
    assert resp.content.startswith(b"%PDF")


def test_model_info_and_metrics():
    headers = get_auth_header()
    # Model info
    info_resp = client.get("/api/v1/model/info")
    assert info_resp.status_code == 200
    info_data = info_resp.json()
    assert info_data["version"] == "v1.0.0"
    assert "Stacked LSTM" in info_data["architecture"]

    # Model metrics
    metrics_resp = client.get("/api/v1/model/metrics")
    assert metrics_resp.status_code == 200
    metrics_data = metrics_resp.json()
    assert "models" in metrics_data
