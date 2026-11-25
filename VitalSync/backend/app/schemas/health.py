from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="OK", description="Service health status")
    version: str = Field(..., description="API Version")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="UTC current timestamp")
    database: str = Field(default="connected", description="Database connection health")
    environment: str = Field(..., description="Application environment")
    message: Optional[str] = "VitalSync API is operational"
