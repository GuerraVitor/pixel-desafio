from io import BytesIO
from pathlib import Path
from typing import Annotated
from urllib.parse import quote
from uuid import uuid4

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, File as UploadField, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from config import get_settings
from database import DbSession
from models import File as FileModel
from models import User
from schemas import FileRead, ShareLink
from security import get_current_user
from storage import MinioClient, PublicMinioClient


router = APIRouter(tags=["files"])
settings = get_settings()
CurrentUser = Annotated[User, Depends(get_current_user)]

MAX_FILE_SIZE = 10 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024
ALLOWED_EXTENSIONS = {".png", ".jpg", ".pdf", ".txt"}
ALLOWED_MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
}


def sanitize_filename(filename: str) -> str:
    return Path(filename).name.strip()


def validate_upload_metadata(upload: UploadFile) -> tuple[str, str, str]:
    original_name = sanitize_filename(upload.filename or "")
    extension = Path(original_name).suffix.lower()
    if not original_name or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allowed file types: .png, .jpg, .pdf, .txt",
        )

    expected_mime_type = ALLOWED_MIME_TYPES[extension]
    mime_type = upload.content_type or expected_mime_type
    if mime_type != expected_mime_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid content type for {extension}. Expected {expected_mime_type}.",
        )
    return original_name, extension, mime_type


async def read_upload_in_chunks(upload: UploadFile) -> tuple[BytesIO, int]:
    file_buffer = BytesIO()
    total_size = 0

    while chunk := await upload.read(CHUNK_SIZE):
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size must be 10MB or less",
            )
        file_buffer.write(chunk)

    if total_size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File cannot be empty")

    file_buffer.seek(0)
    return file_buffer, total_size


def get_next_version(db: DbSession, user_id: str, original_name: str) -> int:
    latest_version = db.scalar(
        select(func.max(FileModel.version)).where(
            FileModel.user_id == user_id,
            FileModel.original_name == original_name,
        )
    )
    return (latest_version or 0) + 1


def get_owned_file(db: DbSession, current_user: User, file_id: str) -> FileModel:
    stored_file = db.scalar(
        select(FileModel).where(
            FileModel.id == file_id,
            FileModel.user_id == current_user.id,
            FileModel.is_deleted.is_(False),
        )
    )
    if stored_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return stored_file


def stream_minio_body(body):
    try:
        for chunk in body.iter_chunks(chunk_size=CHUNK_SIZE):
            if chunk:
                yield chunk
    finally:
        body.close()


@router.post("/upload", response_model=FileRead, status_code=status.HTTP_201_CREATED)
async def upload_file(
    current_user: CurrentUser,
    db: DbSession,
    storage: MinioClient,
    file: UploadFile = UploadField(...),
) -> FileModel:
    original_name, extension, mime_type = validate_upload_metadata(file)
    file_buffer, total_size = await read_upload_in_chunks(file)
    version = get_next_version(db, current_user.id, original_name)
    minio_key = f"users/{current_user.id}/{uuid4().hex}_v{version}{extension}"

    try:
        storage.upload_fileobj(
            file_buffer,
            settings.minio_bucket,
            minio_key,
            ExtraArgs={"ContentType": mime_type},
        )
    except ClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not upload file to storage",
        ) from exc

    stored_file = FileModel(
        user_id=current_user.id,
        original_name=original_name,
        minio_key=minio_key,
        mime_type=mime_type,
        size=total_size,
        version=version,
    )
    db.add(stored_file)

    try:
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        storage.delete_object(Bucket=settings.minio_bucket, Key=minio_key)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not register file metadata",
        ) from exc

    db.refresh(stored_file)
    return stored_file


@router.get("/download/{file_id}")
def download_file(
    file_id: str,
    current_user: CurrentUser,
    db: DbSession,
    storage: MinioClient,
) -> StreamingResponse:
    stored_file = get_owned_file(db, current_user, file_id)

    try:
        minio_object = storage.get_object(Bucket=settings.minio_bucket, Key=stored_file.minio_key)
    except ClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored file object not found",
        ) from exc

    encoded_name = quote(stored_file.original_name)
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}"}
    return StreamingResponse(
        stream_minio_body(minio_object["Body"]),
        media_type=stored_file.mime_type,
        headers=headers,
    )


@router.get("/share/{file_id}", response_model=ShareLink)
def share_file(
    file_id: str,
    current_user: CurrentUser,
    db: DbSession,
    public_storage: PublicMinioClient,
    expires_minutes: int = Query(default=15, ge=1, le=60),
) -> ShareLink:
    stored_file = get_owned_file(db, current_user, file_id)
    expires_in = expires_minutes * 60

    try:
        url = public_storage.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.minio_bucket, "Key": stored_file.minio_key},
            ExpiresIn=expires_in,
        )
    except ClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not generate share link",
        ) from exc

    return ShareLink(url=url, expires_in=expires_in)
