import secrets
from urllib.parse import urlencode

import jwt
import requests
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import User, utcnow
from ..schemas import AdminKeyIn, LoginIn, ProfileUpdate, RegisterIn, TokenOut, UserOut
from ..security import (
    create_access_token,
    create_token,
    decode_token,
    get_current_user,
    hash_password,
    validate_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()

OAUTH_PROVIDERS = {
    "google": {
        "authorize": "https://accounts.google.com/o/oauth2/v2/auth",
        "token": "https://oauth2.googleapis.com/token",
        "profile": "https://openidconnect.googleapis.com/v1/userinfo",
        "scope": "openid email profile",
    },
    "naver": {
        "authorize": "https://nid.naver.com/oauth2.0/authorize",
        "token": "https://nid.naver.com/oauth2.0/token",
        "profile": "https://openapi.naver.com/v1/nid/me",
        "scope": "",
    },
    "kakao": {
        "authorize": "https://kauth.kakao.com/oauth/authorize",
        "token": "https://kauth.kakao.com/oauth/token",
        "profile": "https://kapi.kakao.com/v2/user/me",
        "scope": "profile_nickname account_email",
    },
}


def _token_response(user: User, db: Session, read_only: bool = False) -> TokenOut:
    user.last_login_at = utcnow()
    db.commit()
    return TokenOut(access_token=create_access_token(user, read_only), user=UserOut.model_validate(user))


def _first_admin(db: Session) -> User:
    admin = db.scalar(select(User).where(User.role == "admin", User.is_active.is_(True)).order_by(User.id))
    if not admin:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "활성화된 관리자 계정이 없습니다.")
    return admin


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    validate_password(body.password)
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 가입된 이메일입니다.")
    user = User(
        email=email,
        name=body.name,
        password_hash=hash_password(body.password),
        health_type=body.health_type,
    )
    db.add(user)
    db.flush()
    return _token_response(user, db)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "비활성화된 계정입니다.")
    return _token_response(user, db)


@router.post("/admin-login", response_model=TokenOut)
def admin_login(body: AdminKeyIn, db: Session = Depends(get_db)):
    """실제 관리자: .env 의 ADMIN_ACCESS_KEY 로 진입해 전체 CRUD 권한 토큰을 발급."""
    if not settings.admin_access_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "서버에 관리자 키(ADMIN_ACCESS_KEY)가 설정되지 않았습니다.")
    if not secrets.compare_digest(body.access_key.encode(), settings.admin_access_key.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "관리자 키가 올바르지 않습니다.")
    return _token_response(_first_admin(db), db)


@router.post("/test-admin", response_model=TokenOut)
def test_admin_login(db: Session = Depends(get_db)):
    """테스트 관리자: 관리자 화면은 열람하되 모든 변경 요청이 차단되는 읽기 전용 토큰을 발급."""
    return _token_response(_first_admin(db), db, read_only=True)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(user, k, v)
    db.commit()
    return user


@router.get("/providers")
def providers():
    return {name: bool(cid and secret or (name == "kakao" and cid)) for name, (cid, secret) in settings.oauth.items()}


def _redirect_uri(provider: str) -> str:
    return f"{settings.backend_url}/api/auth/oauth/{provider}/callback"


def _safe_frontend(redirect: str | None) -> str:
    redirect = (redirect or "").rstrip("/")
    return redirect if redirect in settings.frontend_urls else settings.frontend_url


@router.get("/oauth/{provider}/login")
def oauth_login(provider: str, redirect: str | None = Query(default=None)):
    cfg = OAUTH_PROVIDERS.get(provider)
    if not cfg:
        raise HTTPException(404, "지원하지 않는 소셜 로그인입니다.")
    client_id, _ = settings.oauth[provider]
    if not client_id:
        raise HTTPException(503, f"{provider} 소셜 로그인이 아직 설정되지 않았습니다.")
    state = create_token(
        {"typ": "oauth_state", "p": provider, "r": _safe_frontend(redirect), "n": secrets.token_urlsafe(8)},
        minutes=10,
    )
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": _redirect_uri(provider),
        "state": state,
    }
    if cfg["scope"]:
        params["scope"] = cfg["scope"]
    if provider == "google":
        params["prompt"] = "select_account"
    return RedirectResponse(f"{cfg['authorize']}?{urlencode(params)}")


def _fetch_profile(provider: str, code: str, state: str) -> tuple[str, str, str]:
    """return: (provider_id, email, name)"""
    cfg = OAUTH_PROVIDERS[provider]
    client_id, client_secret = settings.oauth[provider]
    data = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "code": code,
        "redirect_uri": _redirect_uri(provider),
    }
    if client_secret:
        data["client_secret"] = client_secret
    if provider == "naver":
        data["state"] = state
    tok = requests.post(cfg["token"], data=data, timeout=10)
    tok.raise_for_status()
    access = tok.json().get("access_token")
    if not access:
        raise ValueError("access_token 없음")
    prof = requests.get(cfg["profile"], headers={"Authorization": f"Bearer {access}"}, timeout=10)
    prof.raise_for_status()
    p = prof.json()
    if provider == "google":
        return p["sub"], p.get("email") or f"google_{p['sub']}@users.recipepick", p.get("name") or "구글 사용자"
    if provider == "naver":
        r = p.get("response", {})
        return r["id"], r.get("email") or f"naver_{r['id']}@users.recipepick", r.get("name") or r.get("nickname") or "네이버 사용자"
    acc = p.get("kakao_account", {})
    nickname = acc.get("profile", {}).get("nickname") or p.get("properties", {}).get("nickname")
    return str(p["id"]), acc.get("email") or f"kakao_{p['id']}@users.recipepick", nickname or "카카오 사용자"


@router.get("/oauth/{provider}/callback")
def oauth_callback(
    provider: str,
    code: str | None = None,
    state: str = "",
    error: str | None = None,
    db: Session = Depends(get_db),
):
    try:
        st = decode_token(state)
        if st.get("typ") != "oauth_state" or st.get("p") != provider:
            raise ValueError
        frontend = _safe_frontend(st.get("r"))
    except (jwt.PyJWTError, ValueError):
        return RedirectResponse(f"{settings.frontend_url}/login?error=invalid_state")
    if error or not code:
        return RedirectResponse(f"{frontend}/login?error={error or 'cancelled'}")
    try:
        pid, email, name = _fetch_profile(provider, code, state)
    except (requests.RequestException, KeyError, ValueError):
        return RedirectResponse(f"{frontend}/login?error=oauth_failed")

    email = email.lower()
    user = db.scalar(select(User).where(User.provider == provider, User.provider_id == pid))
    if not user:
        user = db.scalar(select(User).where(User.email == email))
        if user:
            user.provider_id = user.provider_id or pid
        else:
            user = User(email=email, name=name, provider=provider, provider_id=pid)
            db.add(user)
            db.flush()
    if not user.is_active:
        return RedirectResponse(f"{frontend}/login?error=inactive")
    token = _token_response(user, db).access_token
    return RedirectResponse(f"{frontend}/oauth/callback#token={token}")
