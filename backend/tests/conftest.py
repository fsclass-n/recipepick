import os
import sys
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp()) / "test.db"
os.environ.update({
    "DATABASE_URL": f"sqlite:///{_tmp.as_posix()}",
    "TIDB_HOST": "",
    "RPA_MODE": "demo",
    "CRAWL_ON_STARTUP": "false",
    "SEED_TEST_ACCOUNTS": "true",
    "GEMINI_API_KEY": "",
    "SECRET_KEY": "test-secret-key-for-pytest-only-0123456789",
    "TELEGRAM_BOT_TOKEN": "",
    "DISCORD_WEBHOOK_URL": "",
    "SMTP_HOST": "",
    "ADMIN_ACCESS_KEY": "test-admin-access-key",
})
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def _login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def user_headers(client):
    return _login(client, "user@recipepick.dev", "Recipe!2026")


@pytest.fixture(scope="session")
def admin_headers(client):
    return _login(client, "admin@recipepick.dev", "Admin!2026")
