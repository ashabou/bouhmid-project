"""
Database session management utilities.

Provides dependency injection helpers for FastAPI and session management.
"""

import logging
from typing import Generator
from sqlalchemy.orm import Session
from sqlalchemy import Engine

from .base import Base

logger = logging.getLogger(__name__)


def get_db(session_factory) -> Generator[Session, None, None]:
    """
    Dependency injection helper for FastAPI routes.

    This function is a factory that creates the actual get_db dependency
    for use with FastAPI's Depends() system.

    Args:
        session_factory: SQLAlchemy SessionLocal factory

    Yields:
        Database session

    Example:
        >>> from fastapi import Depends
        >>> from shared.database import get_session_factory, get_db
        >>>
        >>> SessionLocal = get_session_factory(engine)
        >>> get_db_dependency = lambda: get_db(SessionLocal)
        >>>
        >>> @app.get("/items")
        >>> def list_items(db: Session = Depends(get_db_dependency)):
        ...     return db.query(Item).all()
    """
    db = session_factory()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def init_db(engine: Engine, base=Base) -> None:
    """
    Initialize database - create all tables defined in models.

    Args:
        engine: SQLAlchemy engine
        base: Declarative base class (default: shared Base)

    Example:
        >>> from shared.database import create_database_engine, init_db
        >>> engine = create_database_engine("postgresql://...")
        >>> init_db(engine)
    """
    logger.info("Initializing database - creating tables...")

    try:
        base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise
