"""
Database connection management using SQLAlchemy
"""

import os
from contextlib import contextmanager
from sqlalchemy import create_engine, pool
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/edulens"
)

# Create engine with connection pooling
# Using NullPool for Lambda (connections don't persist)
engine = create_engine(
    DATABASE_URL,
    poolclass=pool.NullPool,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true"
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_database():
    """
    Initialize database connection
    Called once per Lambda cold start
    """
    try:
        # Test connection
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        print("Database connection established")
    except Exception as e:
        print(f"Database connection failed: {e}")
        raise


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    Context manager for database sessions

    Usage:
        with get_db_session() as db:
            result = db.query(Model).all()
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
