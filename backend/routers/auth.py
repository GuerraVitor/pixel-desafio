from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from config import get_settings
from database import DbSession
from models import User
from schemas import Token, UserCreate, UserLogin, UserRead
from security import create_access_token, get_current_user, hash_password, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
CurrentUser = Annotated[User, Depends(get_current_user)]


def normalize_email(email: str) -> str:
    return email.strip().lower()


def build_token_response(user: User) -> Token:
    access_token = create_access_token(
        subject=user.id,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return Token(access_token=access_token, user=UserRead.model_validate(user))


def authenticate_user(email: str, password: str, db: DbSession) -> User:
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: DbSession) -> Token:
    user = User(email=normalize_email(payload.email), password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from exc
    db.refresh(user)
    return build_token_response(user)


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: DbSession) -> Token:
    user = authenticate_user(payload.email, payload.password, db)
    return build_token_response(user)


@router.post("/token", response_model=Token)
def token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession) -> Token:
    user = authenticate_user(form_data.username, form_data.password, db)
    return build_token_response(user)


@router.get("/me", response_model=UserRead)
def me(current_user: CurrentUser) -> User:
    return current_user
