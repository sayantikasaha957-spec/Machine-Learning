"""
VitalSync Unified Dev Runner
Runs both FastAPI backend and Vite frontend concurrently and manages lifecycle.
"""
import os
import sys
import subprocess
import signal
import time

def find_python():
    venv_py = os.path.join(".venv", "Scripts", "python.exe") if os.name == "nt" else os.path.join(".venv", "bin", "python")
    return venv_py if os.path.exists(venv_py) else sys.executable

def main():
    py = find_python()
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    frontend_dir = os.path.join(root_dir, "frontend")

    print("[VitalSync] Starting development servers...")
    print(f"[VitalSync] Root Directory: {root_dir}")
    print(f"[VitalSync] Backend: http://localhost:8000 (Docs: /docs, Health: /health)")
    print(f"[VitalSync] Frontend: http://localhost:5173")

    env = os.environ.copy()
    env["PYTHONPATH"] = root_dir

    # Start backend (watch only backend/app to prevent reload loops during data/venv updates)
    backend_cmd = [py, "-m", "uvicorn", "backend.app.main:app", "--reload", "--reload-dir", "backend/app", "--host", "0.0.0.0", "--port", "8000"]
    # Start frontend
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]

    procs = []
    try:
        backend_proc = subprocess.Popen(backend_cmd, cwd=root_dir, env=env)
        procs.append(backend_proc)

        frontend_proc = subprocess.Popen(frontend_cmd, cwd=frontend_dir)
        procs.append(frontend_proc)

        while True:
            for p in procs:
                ret = p.poll()
                if ret is not None:
                    print(f"[VitalSync] Process {p.args} exited with code {ret}")
                    return ret
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[VitalSync] Shutting down development servers...")
    finally:
        for p in procs:
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    p.kill()
        print("[VitalSync] Servers stopped.")

if __name__ == "__main__":
    main()
