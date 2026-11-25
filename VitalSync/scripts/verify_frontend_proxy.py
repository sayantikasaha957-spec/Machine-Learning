import asyncio
import httpx
import websockets
import json

async def test_vite_proxy():
    print("Testing Vite Dev Server & Proxy on port 5173...")
    async with httpx.AsyncClient(base_url="http://localhost:5173", timeout=10.0) as client:
        # 1. Root HTML
        r = await client.get("/")
        print(f"GET / -> {r.status_code} ({len(r.text)} bytes)")
        assert r.status_code == 200
        assert "VitalSync" in r.text or "vite" in r.text

        # 2. Proxied /health
        r = await client.get("/health")
        print(f"GET /health -> {r.status_code}: {r.json().get('status')}")
        assert r.status_code == 200

        # 3. Proxied Login
        r = await client.post("/api/v1/auth/login/json", json={"email": "doctor@vitalsync.com", "password": "Doctor123!"})
        print(f"POST /api/v1/auth/login/json -> {r.status_code}")
        assert r.status_code == 200
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 4. Proxied Patients
        r = await client.get("/api/v1/patients?page=1&page_size=5", headers=headers)
        data = r.json()
        print(f"GET /api/v1/patients -> {r.status_code}: {data.get('total')} total patients")
        assert r.status_code == 200

        # 5. Proxied Forecast
        r = await client.get("/api/v1/patients/1/forecast?horizon=12", headers=headers)
        f_data = r.json()
        print(f"GET /api/v1/patients/1/forecast -> {r.status_code}: horizon {f_data.get('horizon_minutes')} min, mean HR step 1: {f_data.get('mean', {}).get('heart_rate', [None])[0]}")
        assert r.status_code == 200

        # 6. Proxied Analytics
        r = await client.get("/api/v1/analytics/summary", headers=headers)
        a_data = r.json()
        print(f"GET /api/v1/analytics/summary -> {r.status_code}: active inpatients {a_data.get('active_monitoring_patients')}")
        assert r.status_code == 200

        # 7. Proxied Model Metrics
        r = await client.get("/api/v1/model/metrics")
        m_data = r.json()
        print(f"GET /api/v1/model/metrics -> {r.status_code}: {len(m_data.get('models', []))} models evaluated")
        assert r.status_code == 200

    # 8. Proxied WebSocket through Vite port 5173
    print("Testing WebSocket proxy ws://localhost:5173/ws/vitals/1...")
    async with websockets.connect("ws://localhost:5173/ws/vitals/1") as ws:
        msg1 = json.loads(await ws.recv())
        print(f"WS Connected greeting: {msg1.get('message')}")
        assert msg1.get("event") == "connected"

        msg2 = json.loads(await ws.recv())
        print(f"WS Stream reading: event={msg2.get('event')} HR={msg2.get('heart_rate')} SBP={msg2.get('systolic_bp')}")
        assert msg2.get("event") == "vital_update"

    print("\n>> ALL VITE DEV SERVER PROXY & WEBSOCKET CHECKS PASSED SUCCESSFULLY! <<\n")

if __name__ == "__main__":
    asyncio.run(test_vite_proxy())
