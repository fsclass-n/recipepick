from pathlib import Path

import certifi
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import BASE_DIR, get_settings

settings = get_settings()


def _ssl_args() -> dict:
    """TiDB Cloud 는 TLS 필수: CA 검증 + 호스트명 확인."""
    return {"ca": settings.tidb_ca_path or certifi.where(), "check_hostname": True}


def _build_engine():
    if settings.database_url:
        is_mysql = settings.database_url.startswith("mysql")
        use_ssl = is_mysql and settings.db_ssl_mode != "disabled"
        return create_engine(
            settings.database_url,
            connect_args={"ssl": _ssl_args()} if use_ssl else {},
            pool_pre_ping=True,
            pool_recycle=300 if is_mysql else -1,
        )
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
        return create_engine(
            url,
            connect_args={"ssl": _ssl_args()},
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
    if engine.dialect.name == "mysql":
        host = settings.tidb_host or (engine.url.host or "")
        return "tidb" if "tidbcloud" in host else "mysql"
    return engine.dialect.name
