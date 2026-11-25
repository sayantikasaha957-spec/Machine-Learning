from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_uid = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    conditions = Column(String(255), nullable=True)
    room = Column(String(50), nullable=True)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="stable")  # stable, warning, critical
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    doctor = relationship("User", back_populates="patients", foreign_keys=[doctor_id])
    vitals = relationship("Vitals", back_populates="patient", cascade="all, delete-orphan", order_by="Vitals.timestamp")
    alerts = relationship("Alert", back_populates="patient", cascade="all, delete-orphan", order_by="Alert.created_at.desc()")
    notes = relationship("Note", back_populates="patient", cascade="all, delete-orphan", order_by="Note.created_at.desc()")
