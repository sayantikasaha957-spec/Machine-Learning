import uuid
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_auth_header(email: str = "doctor@vitalsync.com", password: str = "Doctor123!"):
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_list_patients_pagination():
    headers = get_auth_header()
    resp = client.get("/api/v1/patients?page=1&page_size=5", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 20
    assert len(data["patients"]) == 5
    assert data["page"] == 1
    assert data["page_size"] == 5


def test_search_and_filter_patients():
    headers = get_auth_header()
    # Search by name
    resp = client.get("/api/v1/patients?search=Eleanor", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["patients"]) >= 1
    assert "Eleanor" in data["patients"][0]["name"]

    # Filter by status
    resp_warn = client.get("/api/v1/patients?status=warning", headers=headers)
    assert resp_warn.status_code == 200
    for p in resp_warn.json()["patients"]:
        assert p["status"] == "warning"


def test_create_and_get_patient():
    headers = get_auth_header("admin@vitalsync.com", "Admin123!")
    uid = f"TEST-PT-{uuid.uuid4().hex[:8]}"
    new_p = {
        "patient_uid": uid,
        "name": "Jonathan Pine",
        "age": 45,
        "gender": "Male",
        "conditions": "Post-Op Hernia Repair",
        "room": "ICU-99",
        "status": "stable",
    }
    create_resp = client.post("/api/v1/patients", json=new_p, headers=headers)
    assert create_resp.status_code == 201
    created = create_resp.json()
    patient_id = created["id"]
    assert created["name"] == "Jonathan Pine"

    try:
        # Get single patient
        get_resp = client.get(f"/api/v1/patients/{patient_id}", headers=headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == patient_id
    finally:
        client.delete(f"/api/v1/patients/{patient_id}", headers=headers)


def test_update_and_notes():
    headers = get_auth_header("doctor@vitalsync.com", "Doctor123!")
    # Update patient 1
    up_resp = client.put("/api/v1/patients/1", json={"room": "ICU-01B"}, headers=headers)
    assert up_resp.status_code == 200
    assert up_resp.json()["room"] == "ICU-01B"

    # Post clinical note
    note_resp = client.post("/api/v1/patients/1/notes", json={"content": "Patient vitals stable. Ambulated in hallway."}, headers=headers)
    assert note_resp.status_code == 201
    assert "Ambulated" in note_resp.json()["content"]

    # Get clinical notes
    notes_resp = client.get("/api/v1/patients/1/notes", headers=headers)
    assert notes_resp.status_code == 200
    assert len(notes_resp.json()) >= 1
