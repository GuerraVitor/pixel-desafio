from typing import Annotated

import boto3
from botocore.client import Config
from fastapi import Depends

from config import get_settings


settings = get_settings()


def create_minio_client(endpoint: str):
    return boto3.client(
        "s3",
        endpoint_url=f"{'https' if settings.minio_secure else 'http'}://{endpoint}",
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


minio_client = create_minio_client(settings.minio_endpoint)
public_minio_client = create_minio_client(settings.minio_public_endpoint)


def get_minio():
    return minio_client


def get_public_minio():
    return public_minio_client


MinioClient = Annotated[object, Depends(get_minio)]
PublicMinioClient = Annotated[object, Depends(get_public_minio)]
