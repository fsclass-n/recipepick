import re
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import User

settings = get_settings()
ALGORITHM = "HS256"
PASSWORD_RULE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$")
PASSWORD_RULE_MESSAGE = "비밀번호는 영문 대·소문자, 숫자, 특수문자를 모두 포함한 8자 이상이어야 합니다."

bearer = HTTPBearer(auto_error=False)
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
READ_ONLY_MESSAGE = "테스트 관리자는 읽기 전용입니다. 데이터 변경은 실제 관리자만 가능합니다."


def validate_password(password: str) -> None:
    if not PASSWORD_RULE.match(password or ""):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, PASSWORD_RULE_MESSAGE)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(data: dict, minutes: int | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=minutes or settings.access_token_expire_minutes
    )
    return jwt.encode({**data, "exp": expire}, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])


def create_access_token(user: User, read_only: bool = False) -> str:
    data = {"sub": str(user.id), "role": user.role}
    if read_only:
        data["ro"] = True
    return create_token(data)


def _session_from_token(token: str, db: Session) -> tuple[User, dict] | None:
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        return None
    if payload.get("typ"):
        return None
    user = db.get(User, int(payload.get("sub", 0)))
    return (user, payload) if user and user.is_active else None


def user_from_token(token: str, db: Session) -> User | None:
    session = _session_from_token(token, db)
    return session[0] if session else None


def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    session = _session_from_token(creds.credentials, db) if creds else None
    if not session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "인증이 필요합니다.")
    user, payload = session
    # 테스트 관리자(읽기 전용 토큰)는 조회만 허용하고 모든 변경 요청을 서버에서 차단
    if payload.get("ro") and request.method not in SAFE_METHODS:
        raise HTTPException(status.HTTP_403_FORBIDDEN, READ_ONLY_MESSAGE)
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "관리자 권한이 필요합니다.")
    return user
