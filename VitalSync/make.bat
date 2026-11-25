@echo off
setlocal

set SCRIPT_DIR=%~dp0
set VENV_PYTHON=%SCRIPT_DIR%.venv\Scripts\python.exe

if not exist "%VENV_PYTHON%" (
    set PYTHON=python
) else (
    set PYTHON=%VENV_PYTHON%
)

if "%1"=="dev" (
    "%PYTHON%" "%SCRIPT_DIR%scripts\dev.py"
) else if "%1"=="setup" (
    "%PYTHON%" "%SCRIPT_DIR%scripts\setup.py"
) else if "%1"=="test" (
    "%PYTHON%" "%SCRIPT_DIR%scripts\test.py"
) else if "%1"=="run-backend" (
    "%PYTHON%" -m uvicorn backend.app.main:app --reload --reload-dir backend/app --host 0.0.0.0 --port 8000
) else if "%1"=="run-frontend" (
    cd /d "%SCRIPT_DIR%frontend" && npm run dev
) else if "%1"=="docker-up" (
    docker compose up --build -d
) else if "%1"=="docker-down" (
    docker compose down
) else if "%1"=="clean" (
    "%PYTHON%" -c "import shutil, glob; [shutil.rmtree(p, ignore_errors=True) for p in glob.glob('**/__pycache__', recursive=True)]; [shutil.rmtree(p, ignore_errors=True) for p in ['frontend/dist', '.pytest_cache']]"
) else (
    echo VitalSync Commands:
    echo   make dev          - Run both backend and frontend development servers concurrently
    echo   make setup        - Install dependencies and seed database
    echo   make test         - Run backend tests and frontend build
    echo   make run-backend  - Run FastAPI backend server only
    echo   make run-frontend - Run Vite React frontend server only
    echo   make docker-up    - Launch multi-container Docker deployment
    echo   make docker-down  - Stop Docker containers
)
