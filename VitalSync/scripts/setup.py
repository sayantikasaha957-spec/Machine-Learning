"""
VitalSync Setup Script
Initializes Python virtual environment, installs backend/ML dependencies,
and installs frontend node modules.
"""
import os
import sys
import subprocess
import shutil

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

def run(cmd, cwd=ROOT_DIR):
    print(f">> Executing: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str))
    if res.returncode != 0:
        print(f"Command failed with return code {res.returncode}")
        sys.exit(res.returncode)

def main():
    print("=== VitalSync Phase 0: Setup ===")

    # Ensure .env exists
    env_file = os.path.join(ROOT_DIR, ".env")
    env_example = os.path.join(ROOT_DIR, ".env.example")
    if not os.path.exists(env_file) and os.path.exists(env_example):
        print("Creating .env from .env.example...")
        shutil.copy(env_example, env_file)

    # 1. Python Venv and Dependencies
    venv_dir = os.path.join(ROOT_DIR, ".venv")
    uv_path = os.path.expanduser(r"~\.local\bin\uv.exe")
    python_311 = os.path.expanduser(r"~\AppData\Roaming\uv\python\cpython-3.11.18-windows-x86_64-none\python.exe")

    if not os.path.exists(venv_dir):
        print("Creating Python virtual environment...")
        if os.path.exists(uv_path) and os.path.exists(python_311):
            run([uv_path, "venv", ".venv", "--python", python_311])
        else:
            run([sys.executable, "-m", "venv", ".venv"])

    # Install Python dependencies
    print("Installing Python backend and ML dependencies...")
    if os.path.exists(uv_path):
        run([uv_path, "pip", "install", "-r", "requirements.txt"])
    else:
        pip_path = os.path.join(venv_dir, "Scripts" if os.name == "nt" else "bin", "pip")
        run([pip_path, "install", "-r", "requirements.txt"])

    # 2. Frontend Dependencies
    print("Installing Frontend dependencies...")
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    run([npm_cmd, "install"], cwd=FRONTEND_DIR)

    # 3. Seed Database
    print("\nSeeding SQLite database with demo accounts, clinical patients, and telemetry...")
    venv_python = os.path.join(venv_dir, "Scripts" if os.name == "nt" else "bin", "python.exe" if os.name == "nt" else "python")
    if not os.path.exists(venv_python):
        venv_python = sys.executable
    env = os.environ.copy()
    env["PYTHONPATH"] = ROOT_DIR
    res = subprocess.run([venv_python, os.path.join(ROOT_DIR, "scripts", "seed.py")], cwd=ROOT_DIR, env=env)
    if res.returncode != 0:
        print(f"Database seeding exited with code {res.returncode}")
        sys.exit(res.returncode)

    print("\n=== Setup completed successfully! ===")
    print("Run `make dev` or `python scripts/dev.py` to start backend and frontend services.")

if __name__ == "__main__":
    main()
