from pathlib import Path
from urllib.parse import unquote_plus

import certifi
import pymysql
import pymysql.constants
from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import BASE_DIR, get_settings

settings = get_settings()


def _ssl_args() -> dict:
    """TiDB Cloud 는 TLS 필수: CA 검증 + 호스트명 확인."""
    return {"ca": settings.tidb_ca_path or certifi.where(), "check_hostname": True}


def _pymysql_connect(*, host, port, user, password, database, ssl=None, connect_timeout=10):
    # FOUND_ROWS: SQLAlchemy 기본 다이얼렉트와 동일하게 "변경된 행"이 아닌 "일치한 행" 수를 받아야
    # 값이 그대로인 UPDATE 에서 StaleDataError 가 나지 않는다.
    kwargs = dict(
        host=host, port=port, user=user, password=password,
        database=database, charset="utf8mb4", connect_timeout=connect_timeout,
        client_flag=pymysql.constants.CLIENT.FOUND_ROWS,
    )
    if ssl:
        kwargs["ssl"] = ssl
    return pymysql.connect(**kwargs)


def _failover_creator():
    """DATABASE_URL(주 DB) 우선, 실패 시 TiDB(예비)로 붙는 커넥션 생성기.

    RDS가 중지되면 새 커넥션부터 TiDB로 자동 전환되고, RDS가 복구되면
    새 커넥션부터 다시 주 DB로 돌아간다. 중지 기간의 쓰기는 예비 DB에만 남는다.
    """
    primary = make_url(settings.database_url)
    primary_ssl = None if settings.db_ssl_mode == "disabled" else _ssl_args()

    def creator():
        try:
            return _pymysql_connect(
                host=primary.host, port=primary.port or 3306,
                user=unquote_plus(primary.username or ""), password=unquote_plus(primary.password or ""),
                database=primary.database, ssl=primary_ssl, connect_timeout=3)
        except Exception as exc:
            print(f"[db-failover] primary connect failed ({type(exc).__name__}); falling back to TiDB", flush=True)
            return _pymysql_connect(
                host=settings.tidb_host, port=settings.tidb_port,
                user=settings.tidb_user, password=settings.tidb_password,
                database=settings.tidb_db_name, ssl=_ssl_args(), connect_timeout=10)

    return creator


def _build_engine():
    if settings.database_url:
        is_mysql = settings.database_url.startswith("mysql")
        if is_mysql and settings.tidb_host:
            # DATABASE_URL + TIDB_* 동시 설정 시 주/예비 페일오버 풀로 동작
            return create_engine(
                "mysql+pymysql://",
                creator=_failover_creator(),
                pool_pre_ping=True,
                pool_recycle=300,
            )
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
        if settings.database_url and not engine.url.host:
            return "mysql"
        host = engine.url.host or settings.tidb_host or ""
        return "tidb" if "tidbcloud" in host else "mysql"
    return engine.dialect.name
