"""
Base database configuration for SQLAlchemy.

This module provides common database setup functionality to eliminate
code duplication between Orion and Prospector agents.
"""

import logging
from typing import Optional
from sqlalchemy import create_engine, Engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

logger = logging.getLogger(__name__)

# Base class for all SQLAlchemy models
Base = declarative_base()


def create_database_engine(
    database_url: str,
    pool_size: int = 10,
    max_overflow: int = 20,
    pool_pre_ping: bool = True,
    echo: bool = False,
    **kwargs
) -> Engine:
    """
    Create a SQLAlchemy database engine with standard configuration.

    Args:
        database_url: PostgreSQL connection string
        pool_size: Number of permanent connections to maintain
        max_overflow: Maximum overflow connections beyond pool_size
        pool_pre_ping: Verify connections before using them
        echo: Log SQL queries (useful for debugging)
        **kwargs: Additional engine options

    Returns:
        Configured SQLAlchemy engine

    Example:
        >>> engine = create_database_engine(
        ...     database_url="postgresql://user:pass@localhost/db",
        ...     pool_size=5,
        ...     max_overflow=10
        ... )
    """
    logger.info(f"Creating database engine for: {database_url.split('@')[1]}")

    engine = create_engine(
        database_url,
        pool_pre_ping=pool_pre_ping,
        pool_size=pool_size,
        max_overflow=max_overflow,
        echo=echo,
        **kwargs
    )

    logger.info(
        f"Database engine created: pool_size={pool_size}, "
        f"max_overflow={max_overflow}"
    )

    return engine


def get_session_factory(engine: Engine) -> sessionmaker:
    """
    Create a session factory from a database engine.

    Args:
        engine: SQLAlchemy engine

    Returns:
        Session factory for creating database sessions

    Example:
        >>> engine = create_database_engine("postgresql://...")
        >>> SessionLocal = get_session_factory(engine)
        >>> db = SessionLocal()
    """
    return sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine
    )
