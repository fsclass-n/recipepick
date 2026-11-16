from pathlib import Path

import certifi
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import BASE_DIR, get_settings

settings = get_settings()


def _build_engine():
    if settings.database_url:
        return create_engine(settings.database_url, pool_pre_ping=True)
    if settings.tidb_host:
        url = URL.create(
            "mysql+pymysql",
            username=settings.tidb_user,
            password=settings.tidb_password,
            host=settings.tidb_host,
            port=settings.tidb_port,
            database=settings.tidb_db_name,
            query={"charset": "utf8mb4"},
        )
        ssl = {"ca": settings.tidb_ca_path or certifi.where(), "check_hostname": True}
        return create_engine(
            url,
            connect_args={"ssl": ssl},
            pool_pre_ping=True,
            pool_recycle=300,
            pool_size=5,
            max_overflow=5,
        )
    data_dir = BASE_DIR / "data"
    data_dir.mkdir(exist_ok=True)
    db_path = Path(data_dir) / "recipepick.db"
    return create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def db_backend_name() -> str:
    return "tidb" if engine.dialect.name == "mysql" else engine.dialect.name
