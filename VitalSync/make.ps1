param(
    [Parameter(Position=0)]
    [string]$Target = "dev"
)

$RootDir = $PSScriptRoot
$VenvPy = Join-Path $RootDir ".venv\Scripts\python.exe"
$Python = if (Test-Path $VenvPy) { $VenvPy } else { "python" }

switch ($Target) {
    "dev" {
        & $Python (Join-Path $RootDir "scripts\dev.py")
    }
    "setup" {
        & $Python (Join-Path $RootDir "scripts\setup.py")
    }
    "test" {
        & $Python (Join-Path $RootDir "scripts\test.py")
    }
    "run-backend" {
        & $Python -m uvicorn backend.app.main:app --reload --reload-dir backend/app --host 0.0.0.0 --port 8000
    }
    "run-frontend" {
        Set-Location (Join-Path $RootDir "frontend")
        npm run dev
    }
    "docker-up" {
        docker compose up --build -d
    }
    "docker-down" {
        docker compose down
    }
    default {
        Write-Host "VitalSync Commands:"
        Write-Host "  .\make dev          - Run both backend and frontend development servers concurrently"
        Write-Host "  .\make setup        - Install dependencies and seed database"
        Write-Host "  .\make test         - Run backend tests and frontend build"
        Write-Host "  .\make run-backend  - Run FastAPI backend server only"
        Write-Host "  .\make run-frontend - Run Vite React frontend server only"
    }
}
