from functools import lru_cache
from typing import Annotated

import boto3
import redis
from botocore.client import Config
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "postgresql+psycopg2://pixel:pixel@localhost:5432/pixel_breeders"
    redis_url: str = "redis://localhost:6379/0"
    minio_endpoint: str = "localhost:9000"
    minio_public_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "pixel-files"
    minio_secure: bool = False
    jwt_secret_key: str = "change-me-in-development"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
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


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_redis() -> redis.Redis:
    return redis_client


def get_minio():
    return minio_client


DbSession = Annotated[Session, Depends(get_db)]
RedisClient = Annotated[redis.Redis, Depends(get_redis)]
MinioClient = Annotated[object, Depends(get_minio)]


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
def ensure_minio_bucket() -> None:
    existing_buckets = minio_client.list_buckets().get("Buckets", [])
    bucket_names = {bucket["Name"] for bucket in existing_buckets}
    if settings.minio_bucket not in bucket_names:
        minio_client.create_bucket(Bucket=settings.minio_bucket)
