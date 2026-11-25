from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = Field(default="nurse", description="admin, doctor, or nurse")


class UserCreate(UserBase):
    password: str = Field(min_length=6, description="Plaintext user password")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str
    email: str


class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None
