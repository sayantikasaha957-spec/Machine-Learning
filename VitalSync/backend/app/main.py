from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.core.database import Base, engine
from backend.app.api.health import router as health_router

# Import all models to ensure metadata registration
import backend.app.models  # noqa: F401

# Import API v1 routers
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.patients import router as patients_router
from backend.app.api.v1.vitals import router as vitals_router
from backend.app.api.v1.alerts import router as alerts_router
from backend.app.api.v1.analytics import router as analytics_router
from backend.app.api.v1.reports import router as reports_router
from backend.app.api.v1.model import router as model_router
from backend.app.api.websockets import router as websocket_router
from backend.app.services.forecast_service import forecast_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize DB schema on startup
    Base.metadata.create_all(bind=engine)
    # 2. Pre-load LSTM model and scaler once
    forecast_service.warmup()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="VitalSync Patient Health Monitoring & LSTM Forecasting API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root-level health check endpoint
app.include_router(health_router)

# Mount WebSocket endpoint
app.include_router(websocket_router)

# Versioned API v1 Router Mounts
api_prefix = settings.API_V1_STR
app.include_router(health_router, prefix=api_prefix)
app.include_router(auth_router, prefix=api_prefix)
app.include_router(patients_router, prefix=api_prefix)
app.include_router(vitals_router, prefix=api_prefix)
app.include_router(alerts_router, prefix=api_prefix)
app.include_router(analytics_router, prefix=api_prefix)
app.include_router(reports_router, prefix=api_prefix)
app.include_router(model_router, prefix=api_prefix)


@app.get("/", tags=["Root"])
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/health",
        "api_v1": settings.API_V1_STR,
    }
