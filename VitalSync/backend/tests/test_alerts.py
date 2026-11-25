from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_auth_header():
    resp = client.post("/api/v1/auth/login", data={"username": "nurse@vitalsync.com", "password": "Nurse123!"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_list_alerts():
    headers = get_auth_header()
    resp = client.get("/api/v1/alerts", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert len(data["alerts"]) > 0


def test_filter_alerts():
    headers = get_auth_header()
    # Filter by predicted
    resp = client.get("/api/v1/alerts?predicted=true", headers=headers)
    assert resp.status_code == 200
    for a in resp.json()["alerts"]:
        assert a["predicted"] is True


def test_acknowledge_and_resolve_alert():
    headers = get_auth_header()
    alerts_resp = client.get("/api/v1/alerts?resolved=false", headers=headers)
    assert alerts_resp.status_code == 200
    unresolved = alerts_resp.json()["alerts"]
    if unresolved:
        alert_id = unresolved[0]["id"]
        # Acknowledge
        ack_resp = client.post(f"/api/v1/alerts/{alert_id}/acknowledge", headers=headers)
        assert ack_resp.status_code == 200
        assert ack_resp.json()["acknowledged_by"] is not None

        # Resolve
        res_resp = client.post(f"/api/v1/alerts/{alert_id}/resolve", headers=headers)
        assert res_resp.status_code == 200
        assert res_resp.json()["resolved"] is True
