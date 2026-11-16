import os
import sys
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

load_dotenv(ROOT_DIR / ".env")

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _list(name: str, default: str = "") -> list[str]:
    return [v.strip().rstrip("/") for v in os.getenv(name, default).split(",") if v.strip()]


class Settings:
    def __init__(self) -> None:
        self.app_env = os.getenv("APP_ENV", "development")
        self.secret_key = os.getenv("SECRET_KEY", "dev-secret-change-me")
        self.access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
        self.frontend_urls = _list(
            "FRONTEND_URLS",
            "http://localhost:5173,https://recipepick.netlify.app,https://recipepick.onrender.com",
        )
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
        self.backend_url = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")

        self.tidb_host = os.getenv("TIDB_HOST", "").strip()
        self.tidb_port = int(os.getenv("TIDB_PORT", "4000") or 4000)
        self.tidb_user = os.getenv("TIDB_USER", "")
        self.tidb_password = os.getenv("TIDB_PASSWORD", "")
        self.tidb_db_name = os.getenv("TIDB_DB_NAME", "recipepick")
        self.tidb_ca_path = os.getenv("TIDB_CA_PATH", "").strip()
        self.database_url = os.getenv("DATABASE_URL", "").strip()
        self.seed_test_accounts = _bool("SEED_TEST_ACCOUNTS", True)

        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

        self.oauth = {
            "google": (os.getenv("GOOGLE_CLIENT_ID", ""), os.getenv("GOOGLE_CLIENT_SECRET", "")),
            "naver": (os.getenv("NAVER_CLIENT_ID", ""), os.getenv("NAVER_CLIENT_SECRET", "")),
            "kakao": (os.getenv("KAKAO_CLIENT_ID", ""), os.getenv("KAKAO_CLIENT_SECRET", "")),
        }

        self.rpa_mode = os.getenv("RPA_MODE", "auto").lower()
        self.crawl_interval_minutes = int(os.getenv("CRAWL_INTERVAL_MINUTES", "60"))
        self.crawl_on_startup = _bool("CRAWL_ON_STARTUP", True)

        self.telegram_bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
        self.discord_webhook_url = os.getenv("DISCORD_WEBHOOK_URL", "")
        self.smtp_host = os.getenv("SMTP_HOST", "")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587") or 587)
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.alert_email_to = os.getenv("ALERT_EMAIL_TO", "")

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
