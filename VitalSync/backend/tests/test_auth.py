import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_token(email: str = "admin@vitalsync.com", password: str = "Admin123!"):
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def test_login_success():
    resp = client.post("/api/v1/auth/login", data={"username": "admin@vitalsync.com", "password": "Admin123!"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "admin"
    assert data["email"] == "admin@vitalsync.com"


def test_login_invalid_password():
    resp = client.post("/api/v1/auth/login", data={"username": "admin@vitalsync.com", "password": "WrongPassword"})
    assert resp.status_code == 401
    assert "Incorrect email or password" in resp.json()["detail"]


def test_register_and_login_new_user():
    email = "new_doctor@vitalsync.com"
    reg_resp = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": "Dr. Newly Registered",
        "role": "doctor",
    })
    # If already exists from previous test run, allow 201 or 400
    if reg_resp.status_code == 201:
        assert reg_resp.json()["email"] == email
        assert reg_resp.json()["role"] == "doctor"

    login_resp = client.post("/api/v1/auth/login", data={"username": email, "password": "Password123!"})
    assert login_resp.status_code == 200
    assert login_resp.json()["role"] == "doctor"


def test_get_me():
    token = get_token("doctor@vitalsync.com", "Doctor123!")
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "doctor@vitalsync.com"
    assert data["role"] == "doctor"


def test_role_based_protection():
    nurse_token = get_token("nurse@vitalsync.com", "Nurse123!")
    admin_token = get_token("admin@vitalsync.com", "Admin123!")

    # Retrain route requires admin role
    # Nurse should be forbidden (403)
    nurse_resp = client.post("/api/v1/model/retrain", json={"epochs": 1}, headers={"Authorization": f"Bearer {nurse_token}"})
    assert nurse_resp.status_code == 403

    # Admin should be allowed (202 Accepted)
    admin_resp = client.post("/api/v1/model/retrain", json={"epochs": 1}, headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_resp.status_code == 202
    assert admin_resp.json()["status"] in ["running", "completed"]
