from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc
from backend.app.core.database import get_db
from backend.app.core.deps import get_current_active_user, require_roles
from backend.app.models.patient import Patient
from backend.app.models.user import User
from backend.app.models.note import Note
from backend.app.schemas.patient import PatientCreate, PatientUpdate, PatientOut, PatientListOut
from backend.app.schemas.note import NoteCreate, NoteOut

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("", response_model=PatientListOut)
def list_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    search: Optional[str] = Query(None, description="Search by name, room, or UID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: stable, warning, critical"),
    room: Optional[str] = Query(None, description="Filter by room"),
    doctor_id: Optional[int] = Query(None, description="Filter by assigned doctor"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("created_at", description="Field to sort by (name, age, status, created_at)"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
):
    """Lists patients with search, filtering, sorting, and pagination."""
    query = db.query(Patient)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Patient.name.ilike(search_term),
                Patient.patient_uid.ilike(search_term),
                Patient.room.ilike(search_term),
                Patient.conditions.ilike(search_term),
            )
        )

    if status_filter:
        query = query.filter(Patient.status == status_filter.lower())

    if room:
        query = query.filter(Patient.room.ilike(f"%{room}%"))

    if doctor_id:
        query = query.filter(Patient.doctor_id == doctor_id)

    # Sorting
    sort_col = getattr(Patient, sort_by, Patient.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))

    total = query.count()
    patients = query.offset((page - 1) * page_size).limit(page_size).all()

    return PatientListOut(
        total=total,
        page=page,
        page_size=page_size,
        patients=patients,
    )


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(
    patient_in: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "doctor")),
):
    """Admits a new patient into the ICU/telemetry ward."""
    new_patient = Patient(
        patient_uid=patient_in.patient_uid,
        name=patient_in.name,
        age=patient_in.age,
        gender=patient_in.gender,
        conditions=patient_in.conditions,
        room=patient_in.room,
        doctor_id=patient_in.doctor_id or (current_user.id if current_user.role == "doctor" else None),
        status=patient_in.status or "stable",
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    return new_patient


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Fetches details for a specific patient."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    return patient


@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: int,
    update_data: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "doctor", "nurse")),
):
    """Updates patient information, bed assignment, or clinical condition."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    for field, val in update_data.model_dump(exclude_unset=True).items():
        setattr(patient, field, val)

    db.commit()
    db.refresh(patient)
    return patient


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Discharges and removes a patient record (Admin only)."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    db.delete(patient)
    db.commit()
    return None


@router.get("/{patient_id}/notes", response_model=list[NoteOut])
def get_patient_notes(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieves all clinical progress notes for a patient."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    
    notes = db.query(Note).filter(Note.patient_id == patient_id).order_by(desc(Note.created_at)).all()
    out = []
    for n in notes:
        author_name = n.author.full_name if n.author else "Medical Staff"
        out.append(NoteOut(
            id=n.id,
            patient_id=n.patient_id,
            author_id=n.author_id,
            author_name=author_name,
            content=n.content,
            created_at=n.created_at,
        ))
    return out


@router.post("/{patient_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def add_patient_note(
    patient_id: int,
    note_in: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Appends a new clinical observation note to a patient's chart."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    new_note = Note(
        patient_id=patient_id,
        author_id=current_user.id,
        content=note_in.content,
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)

    return NoteOut(
        id=new_note.id,
        patient_id=new_note.patient_id,
        author_id=new_note.author_id,
        author_name=current_user.full_name,
        content=new_note.content,
        created_at=new_note.created_at,
    )
