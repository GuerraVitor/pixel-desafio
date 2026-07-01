from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: str
    email: EmailStr
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class FileRead(BaseModel):
    id: str
    original_name: str
    mime_type: str
    size: int
    version: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ShareLink(BaseModel):
    url: str
    expires_in: int
