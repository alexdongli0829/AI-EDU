"""
Database connection management using SQLAlchemy.
Resolves DATABASE_URL from AWS Secrets Manager when DB_SECRET_ARN is set.
"""

import os
import json
import boto3
from contextlib import contextmanager
from sqlalchemy import create_engine, pool, text
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

_engine = None
_SessionLocal = None


def _get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    secret_arn = os.getenv("DB_SECRET_ARN")
    if secret_arn:
        region = os.getenv("AWS_REGION", "us-west-2")
        client = boto3.client("secretsmanager", region_name=region)
        secret = client.get_secret_value(SecretId=secret_arn)
        creds = json.loads(secret["SecretString"])
        password = creds["password"].replace("@", "%40").replace("#", "%23")
        return f"postgresql://{creds['username']}:{password}@{creds['host']}:{creds['port']}/{creds['dbname']}?sslmode=require"
    return "postgresql://user:password@localhost:5432/edulens"


def _get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        url = _get_database_url()
        _engine = create_engine(
            url,
            poolclass=pool.NullPool,
            echo=os.getenv("SQL_ECHO", "false").lower() == "true",
        )
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def init_database():
    """Initialize database connection — called once per Lambda cold start."""
    try:
        eng = _get_engine()
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database connection established")
    except Exception as e:
        print(f"Database connection failed: {e}")
        # Do not re-raise — let the handler's try/except handle DB errors
        # so API Gateway always gets a proper HTTP response with CORS headers


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """Context manager for database sessions."""
    _get_engine()  # ensure initialized
    session = _SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
