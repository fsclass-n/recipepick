import socket
import threading
import time
from pathlib import Path
from urllib.parse import unquote_plus

import certifi
import pymysql
import pymysql.constants
from sqlalchemy import create_engine, event, exc, text
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


PRIMARY_PROBE_INTERVAL = 30  # 예비 DB 사용 중 주 DB 복구 여부를 확인하는 최소 간격(초)
_probe_lock = threading.Lock()
_probe_cache = {"at": 0.0, "ok": False}


def _primary_reachable(host: str, port: int) -> bool:
    """주 DB TCP 포트가 열려 있는지(=RDS 기동 중) 캐시된 결과로 빠르게 판단한다."""
    with _probe_lock:
        if time.monotonic() - _probe_cache["at"] < PRIMARY_PROBE_INTERVAL:
            return _probe_cache["ok"]
        try:
            socket.create_connection((host, port), timeout=1.5).close()
            ok = True
        except OSError:
            ok = False
        _probe_cache.update(at=time.monotonic(), ok=ok)
        return ok


def _failover_creator():
    """DATABASE_URL(주 DB) 우선, 실패 시 TiDB(예비)로 붙는 커넥션 생성기.

    RDS가 중지되면 새 커넥션부터 TiDB로 자동 전환되고, RDS가 복구되면
    checkout 훅(_enable_failback)이 예비 커넥션을 폐기해 다시 주 DB로 돌아간다.
    중지 기간의 쓰기는 예비 DB에만 남는다.
    """
    primary = make_url(settings.database_url)
    primary_ssl = None if settings.db_ssl_mode == "disabled" else _ssl_args()

    def creator():
        try:
            conn = _pymysql_connect(
                host=primary.host, port=primary.port or 3306,
                user=unquote_plus(primary.username or ""), password=unquote_plus(primary.password or ""),
                database=primary.database, ssl=primary_ssl, connect_timeout=3)
            conn._rp_fallback = False
            return conn
        except Exception as e:
            print(f"[db-failover] primary connect failed ({type(e).__name__}); falling back to TiDB", flush=True)
            _probe_cache.update(at=time.monotonic(), ok=False)
            conn = _pymysql_connect(
                host=settings.tidb_host, port=settings.tidb_port,
                user=settings.tidb_user, password=settings.tidb_password,
                database=settings.tidb_db_name, ssl=_ssl_args(), connect_timeout=10)
            conn._rp_fallback = True
            return conn

    return creator, primary


def _enable_failback(engine, primary) -> None:
    """예비(TiDB) 커넥션을 꺼낼 때 주 DB가 다시 열려 있으면 그 커넥션을 폐기한다.

    DisconnectionError 를 던지면 풀이 커넥션을 무효화하고 creator 로 새로 연결하므로
    RDS 재기동 후 최대 PRIMARY_PROBE_INTERVAL 초 안에 주 DB로 복귀한다.
    """

    @event.listens_for(engine, "checkout")
    def _checkout(dbapi_conn, record, proxy):
        if should_failback(dbapi_conn, primary.host, primary.port or 3306):
            print("[db-failover] primary is reachable again; recycling TiDB connection", flush=True)
            raise exc.DisconnectionError("primary database recovered")


def should_failback(dbapi_conn, host: str, port: int) -> bool:
    return bool(getattr(dbapi_conn, "_rp_fallback", False)) and _primary_reachable(host, port)


def _build_engine():
    if settings.database_url:
        is_mysql = settings.database_url.startswith("mysql")
        if is_mysql and settings.tidb_host:
            # DATABASE_URL + TIDB_* 동시 설정 시 주/예비 페일오버 풀로 동작
            creator, primary = _failover_creator()
            failover_engine = create_engine(
                "mysql+pymysql://",
                creator=creator,
                pool_pre_ping=True,
                pool_recycle=300,
            )
            _enable_failback(failover_engine, primary)
            return failover_engine
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


IS_FAILOVER_POOL = bool(settings.database_url.startswith("mysql") and settings.tidb_host)


def db_status() -> dict:
    """현재 실제로 연결된 DB 를 질의해 판별한다(설정값이 아닌 접속 결과 기준).

    backend: tidb | mysql | sqlite | unavailable, failover: 주 DB(RDS) 대신 예비 TiDB 사용 중 여부
    """
    if engine.dialect.name != "mysql":
        return {"backend": engine.dialect.name, "version": "", "failover": False}
    try:
        with engine.connect() as conn:
            version = str(conn.execute(text("SELECT VERSION()")).scalar() or "")
    except Exception:
        return {"backend": "unavailable", "version": "", "failover": False}
    backend = "tidb" if "tidb" in version.lower() else "mysql"
    return {"backend": backend, "version": version, "failover": IS_FAILOVER_POOL and backend == "tidb"}


def db_backend_name() -> str:
    return db_status()["backend"]
