"""
VitalSync Live Endpoints Verification Script
Launches uvicorn in a subprocess, executes real HTTP & WebSocket requests
against all Phase 3 endpoints, verifies responses, and shuts down cleanly.
"""
import sys
import os
import time
import subprocess
import asyncio
import json
import httpx
import websockets

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000"

async def test_live_suite():
    print("=" * 60)
    print("VitalSync Live Server & Endpoint Verification")
    print("=" * 60)

    # 1. Start uvicorn server with output redirected to log file (prevent pipe buffer deadlock)
    log_file = open("server_live_test.log", "w", encoding="utf-8")
    python_exe = sys.executable
    server_process = subprocess.Popen(
        [python_exe, "-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        stdout=log_file,
        stderr=log_file,
        cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
    )

    try:
        # Wait for server to be responsive
        print("Waiting for server startup...")
        server_ready = False
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
            for _ in range(50):
                try:
                    res = await client.get("/health")
                    if res.status_code == 200:
                        server_ready = True
                        print("Server is UP and /health returned 200 OK")
                        break
                except Exception:
                    pass
                await asyncio.sleep(0.5)

        if not server_ready:
            print("ERROR: Server failed to start in time.")
            sys.exit(1)

        results = []

        # 2. Test Endpoints with httpx
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
            # A. Health
            res = await client.get("/health")
            results.append(("GET /health", res.status_code == 200, res.status_code, res.json()))

            # B. Auth Login
            res = await client.post("/api/v1/auth/login/json", json={
                "email": "doctor@vitalsync.com",
                "password": "Doctor123!"
            })
            token_data = res.json()
            token = token_data.get("access_token")
            results.append(("POST /api/v1/auth/login/json", res.status_code == 200 and token is not None, res.status_code, {"token_type": token_data.get("token_type"), "role": token_data.get("role")}))

            headers = {"Authorization": f"Bearer {token}"}

            # C. Auth Me
            res = await client.get("/api/v1/auth/me", headers=headers)
            user_data = res.json()
            results.append(("GET /api/v1/auth/me", res.status_code == 200 and user_data.get("email") == "doctor@vitalsync.com", res.status_code, {"user": user_data.get("email"), "role": user_data.get("role")}))

            # D. Patients List & Pagination
            res = await client.get("/api/v1/patients?page=1&page_size=5&search=Eleanor", headers=headers)
            patients_data = res.json()
            results.append(("GET /api/v1/patients", res.status_code == 200 and "patients" in patients_data, res.status_code, {"total": patients_data.get("total"), "returned": len(patients_data.get("patients", []))}))

            # E. Patient Details
            res = await client.get("/api/v1/patients/1", headers=headers)
            p1 = res.json()
            results.append(("GET /api/v1/patients/{id}", res.status_code == 200 and p1.get("id") == 1, res.status_code, {"name": p1.get("name"), "room": p1.get("room")}))

            # F. Patient Vitals
            res = await client.get("/api/v1/patients/1/vitals?limit=10", headers=headers)
            vitals_resp = res.json()
            vitals_list = vitals_resp.get("data", [])
            results.append(("GET /api/v1/patients/{id}/vitals", res.status_code == 200 and len(vitals_list) > 0, res.status_code, {"count": vitals_resp.get("count"), "sample_hr": vitals_list[0]["hr"] if vitals_list else None}))

            # G. Patient Forecast (LSTM Model Inference with MC Dropout)
            res = await client.get("/api/v1/patients/1/forecast?horizon=12", headers=headers)
            forecast = res.json()
            has_preds = "mean" in forecast and "heart_rate" in forecast.get("mean", {})
            results.append(("GET /api/v1/patients/{id}/forecast", res.status_code == 200 and has_preds, res.status_code, {
                "horizon": forecast.get("horizon_minutes"),
                "mean_hr_step1": forecast.get("mean", {}).get("heart_rate", [None])[0],
                "lower_hr_step1": forecast.get("lower_90", {}).get("heart_rate", [None])[0],
                "upper_hr_step1": forecast.get("upper_90", {}).get("heart_rate", [None])[0]
            }))

            # H. Alerts List
            res = await client.get("/api/v1/alerts", headers=headers)
            alerts_resp = res.json()
            alerts_list = alerts_resp.get("alerts", [])
            first_alert_id = alerts_list[0]["id"] if alerts_list else None
            results.append(("GET /api/v1/alerts", res.status_code == 200 and "alerts" in alerts_resp, res.status_code, {"total": alerts_resp.get("total"), "unresolved": alerts_resp.get("unresolved_count")}))

            # I. Acknowledge Alert
            if first_alert_id:
                res = await client.post(f"/api/v1/alerts/{first_alert_id}/acknowledge", headers=headers)
                ack_data = res.json()
                results.append((f"POST /api/v1/alerts/{first_alert_id}/acknowledge", res.status_code == 200, res.status_code, {"ack_by": ack_data.get("acknowledged_by")}))

                # J. Resolve Alert
                res = await client.post(f"/api/v1/alerts/{first_alert_id}/resolve", headers=headers)
                res_data = res.json()
                results.append((f"POST /api/v1/alerts/{first_alert_id}/resolve", res.status_code == 200 and res_data.get("resolved") is True, res.status_code, {"resolved": res_data.get("resolved")}))

            # K. Analytics Summary
            res = await client.get("/api/v1/analytics/summary", headers=headers)
            summary = res.json()
            results.append(("GET /api/v1/analytics/summary", res.status_code == 200 and "total_patients" in summary, res.status_code, {
                "total_patients": summary.get("total_patients"),
                "active_monitoring": summary.get("active_monitoring_patients"),
                "hr_mean_24h": summary.get("averages_24h", {}).get("heart_rate", {}).get("mean")
            }))

            # L. Patient Report Export (CSV)
            res = await client.get("/api/v1/reports/patient/1/export?format=csv", headers=headers)
            is_csv = res.status_code == 200 and "text/csv" in res.headers.get("content-type", "")
            results.append(("GET /api/v1/reports/patient/{id}/export?format=csv", is_csv, res.status_code, {"bytes": len(res.content), "content_type": res.headers.get("content-type")}))

            # M. Patient Report Export (PDF)
            res = await client.get("/api/v1/reports/patient/1/export?format=pdf", headers=headers)
            is_pdf = res.status_code == 200 and "application/pdf" in res.headers.get("content-type", "") and res.content.startswith(b"%PDF")
            results.append(("GET /api/v1/reports/patient/{id}/export?format=pdf", is_pdf, res.status_code, {"bytes": len(res.content), "content_type": res.headers.get("content-type")}))

            # N. Model Info & Metrics
            res = await client.get("/api/v1/model/info", headers=headers)
            info = res.json()
            results.append(("GET /api/v1/model/info", res.status_code == 200 and "architecture" in info, res.status_code, {"active_version": info.get("version")}))

            res = await client.get("/api/v1/model/metrics", headers=headers)
            metrics = res.json()
            models_list = [m["model_name"] for m in metrics.get("models", [])]
            results.append(("GET /api/v1/model/metrics", res.status_code == 200 and len(models_list) > 0, res.status_code, {"models_evaluated": models_list}))

            # O. Notes CRUD
            res = await client.post("/api/v1/patients/1/notes", json={"content": "Live integration test note: patient stable."}, headers=headers)
            note_obj = res.json()
            results.append(("POST /api/v1/patients/{id}/notes", res.status_code in [200, 201] and "id" in note_obj, res.status_code, {"note_id": note_obj.get("id")}))

            res = await client.get("/api/v1/patients/1/notes", headers=headers)
            notes_list = res.json()
            results.append(("GET /api/v1/patients/{id}/notes", res.status_code == 200 and len(notes_list) > 0, res.status_code, {"notes_count": len(notes_list)}))

            # P. Auth Logout
            res = await client.post("/api/v1/auth/logout", headers=headers)
            results.append(("POST /api/v1/auth/logout", res.status_code == 200, res.status_code, res.json()))

        # 3. Test WebSocket /ws/vitals/{patient_id}
        print("Testing WebSocket live streaming (/ws/vitals/1)...")
        ws_success = False
        ws_details = None
        try:
            async with websockets.connect(f"{WS_URL}/ws/vitals/1") as ws:
                # 1st message: connection acknowledgment
                msg1_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                msg1 = json.loads(msg1_raw)
                # 2nd message: simulated telemetry update
                msg2_raw = await asyncio.wait_for(ws.recv(), timeout=6.0)
                msg2 = json.loads(msg2_raw)

                if msg1.get("event") == "connected" and msg2.get("event") == "vital_update":
                    ws_success = True
                    ws_details = f"Connected OK, received vital_update: HR={msg2.get('heart_rate')} SBP={msg2.get('systolic_bp')}"
                else:
                    ws_details = f"Unexpected messages: msg1={msg1}, msg2={msg2}"
        except Exception as e:
            ws_details = str(e)

        results.append(("WS /ws/vitals/{patient_id}", ws_success, "STREAMING", ws_details))

        # 4. Print Summary Table
        print("\n" + "=" * 95)
        print(f"{'ENDPOINT / INTERACTION':<46} | {'STATUS':<6} | {'HTTP/STATE':<10} | {'DETAILS'}")
        print("=" * 95)
        all_passed = True
        for name, passed, status, detail in results:
            if not passed:
                all_passed = False
            status_str = "PASS" if passed else "FAIL"
            detail_str = str(detail)[:45]
            print(f"{name:<46} | {status_str:<6} | {str(status):<10} | {detail_str}")
        print("=" * 95)

        if all_passed:
            print("\n>> ALL LIVE ENDPOINT & WEBSOCKET CHECKS PASSED SUCCESSFULLY! <<\n")
        else:
            print("\n>> SOME CHECKS FAILED! <<\n")
            sys.exit(1)

    finally:
        print("Terminating server process...")
        server_process.terminate()
        try:
            server_process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server_process.kill()
        log_file.close()
        print("Server shutdown complete.")

if __name__ == "__main__":
    asyncio.run(test_live_suite())
