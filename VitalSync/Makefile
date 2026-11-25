# VitalSync Makefile
# Supports Windows (cmd / PowerShell / Git Bash) and POSIX environments

ifeq ($(OS),Windows_NT)
    VENV_DIR = .venv
    PYTHON = .venv\Scripts\python.exe
    PYTEST = .venv\Scripts\pytest.exe
    UVICORN = .venv\Scripts\uvicorn.exe
    NPM = npm.cmd
else
    VENV_DIR = .venv
    PYTHON = .venv/bin/python
    PYTEST = .venv/bin/pytest
    UVICORN = .venv/bin/uvicorn
    NPM = npm
endif

.PHONY: help setup dev test run-backend run-frontend clean docker-up docker-down docker-build

help:
	@echo "VitalSync Commands:"
	@echo "  make setup        - Install all backend, ML, and frontend dependencies, and seed database"
	@echo "  make dev          - Run both backend and frontend development servers concurrently"
	@echo "  make test         - Run backend tests and frontend type checking/build"
	@echo "  make run-backend  - Run FastAPI backend server on http://localhost:8000"
	@echo "  make run-frontend - Run Vite React frontend server on http://localhost:5173"
	@echo "  make docker-up    - Build and launch backend and frontend via Docker Compose"
	@echo "  make docker-down  - Stop and remove running Docker Compose containers"
	@echo "  make docker-build - Rebuild Docker images without starting services"
	@echo "  make clean        - Remove caches and build artifacts"

setup:
ifeq ($(wildcard $(PYTHON)),)
	python scripts/setup.py
else
	$(PYTHON) scripts/setup.py
endif

dev:
	$(PYTHON) scripts/dev.py

test:
	$(PYTHON) scripts/test.py

run-backend:
	$(PYTHON) -m uvicorn backend.app.main:app --reload --reload-dir backend/app --host 0.0.0.0 --port 8000

run-frontend:
	cd frontend && $(NPM) run dev

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-build:
	docker compose build

clean:
	$(PYTHON) -c "import shutil, glob; [shutil.rmtree(p, ignore_errors=True) for p in glob.glob('**/__pycache__', recursive=True)]; [shutil.rmtree(p, ignore_errors=True) for p in ['frontend/dist', '.pytest_cache']]"
