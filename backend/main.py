from typing import Annotated

import boto3
from botocore.client import Config
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from config import get_settings
from database import Base, DbSession, RedisClient, engine
import models
from routers.auth import router as auth_router

settings = get_settings()

minio_client = boto3.client(
    "s3",
    endpoint_url=f"{'https' if settings.minio_secure else 'http'}://{settings.minio_endpoint}",
    aws_access_key_id=settings.minio_access_key,
    aws_secret_access_key=settings.minio_secret_key,
    config=Config(signature_version="s3v4"),
    region_name="us-east-1",
)

app = FastAPI(
    title="Pixel Breeders File Manager API",
    version="0.1.0",
    description="Initial FastAPI service for auth, streaming uploads/downloads, cache, and MinIO storage.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_minio():
    return minio_client


MinioClient = Annotated[object, Depends(get_minio)]

app.include_router(auth_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "Pixel Breeders File Manager API", "status": "ok"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/dependencies")
def dependency_health(
    db: DbSession,
    cache: RedisClient,
    storage: MinioClient,
) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    cache.ping()
    storage.head_bucket(Bucket=settings.minio_bucket)
    return {"database": "ok", "redis": "ok", "minio": "ok"}


@app.on_event("startup")
def create_database_tables() -> None:
    Base.metadata.create_all(bind=engine)


@app.on_event("startup")
def ensure_minio_bucket() -> None:
    existing_buckets = minio_client.list_buckets().get("Buckets", [])
    bucket_names = {bucket["Name"] for bucket in existing_buckets}
    if settings.minio_bucket not in bucket_names:
        minio_client.create_bucket(Bucket=settings.minio_bucket)
