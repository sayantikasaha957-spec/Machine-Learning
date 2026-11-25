"""
VitalSync Test Runner
Executes backend pytest test suite and frontend type-checking / build verification.
"""
import os
import sys
import subprocess

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

def run(cmd, cwd=ROOT_DIR):
    print(f">> Running: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str))
    if res.returncode != 0:
        print(f"Test step failed with code {res.returncode}")
        sys.exit(res.returncode)

def main():
    print("=== VitalSync Test Suite ===")
    
    # 1. Backend tests
    venv_pytest = os.path.join(ROOT_DIR, ".venv", "Scripts", "pytest.exe") if os.name == "nt" else os.path.join(ROOT_DIR, ".venv", "bin", "pytest")
    if not os.path.exists(venv_pytest):
        venv_pytest = "pytest"

    print("\n--- Running Backend Tests ---")
    env = os.environ.copy()
    env["PYTHONPATH"] = ROOT_DIR
    res = subprocess.run([venv_pytest, "-v", "backend/tests"], cwd=ROOT_DIR, env=env)
    if res.returncode != 0:
        sys.exit(res.returncode)

    # 2. Frontend verification
    print("\n--- Running Frontend Typecheck & Build ---")
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    run([npm_cmd, "run", "build"], cwd=FRONTEND_DIR)

    print("\n=== All Tests and Verifications Passed! ===")

if __name__ == "__main__":
    main()
