from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from backend.app.core.database import Base


class ModelRun(Base):
    __tablename__ = "model_runs"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), nullable=False, unique=True, index=True)
    metrics_json = Column(Text, nullable=False)  # JSON serialized performance metrics
    trained_at = Column(DateTime, default=datetime.utcnow)
    active = Column(Boolean, default=True)
