from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.engine import URL, Engine
from sqlalchemy.orm import Session

from app.core.config import Settings


def build_engine(settings: Settings) -> Engine:
    """Prepare a lazy connection pool; never create tables or apply migrations."""
    url = URL.create(
        "mysql+pymysql",
        username=settings.mysql_user,
        password=settings.mysql_password.get_secret_value(),
        host=settings.mysql_host,
        port=settings.mysql_port,
        database=settings.mysql_database,
        query={"charset": "utf8mb4"},
    )
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=1800,
        connect_args={"connect_timeout": 3, "read_timeout": 3, "write_timeout": 3},
    )


def get_engine(request: Request) -> Engine:
    return request.app.state.engine


def get_db(request: Request) -> Iterator[Session]:
    """Services own commits; unfinished transactions roll back on close."""
    with Session(get_engine(request)) as session:
        yield session
