from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # tachycardia, bradycardia, hypertension, hypotension
    severity = Column(String(20), nullable=False, default="medium")  # low, medium, high, critical
    message = Column(Text, nullable=False)
    predicted = Column(Boolean, default=False, nullable=False)  # True if predicted by LSTM ahead of time
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved = Column(Boolean, default=False, index=True)
    resolved_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="alerts")
    acknowledged_user = relationship("User", back_populates="acknowledged_alerts", foreign_keys=[acknowledged_by])
