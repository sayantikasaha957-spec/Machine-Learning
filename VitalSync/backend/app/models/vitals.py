from datetime import datetime
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class Vitals(Base):
    __tablename__ = "vitals"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    hr = Column(Float, nullable=False)   # Heart Rate (bpm)
    sbp = Column(Float, nullable=False)  # Systolic Blood Pressure (mmHg)
    dbp = Column(Float, nullable=False)  # Diastolic Blood Pressure (mmHg)

    patient = relationship("Patient", back_populates="vitals")

    __table_args__ = (
        Index("ix_vitals_patient_timestamp", "patient_id", "timestamp"),
    )
