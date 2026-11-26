from app.services.crawler import crawler_service


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_head_requests_get_200(client):
    """UptimeRobot 무료 모니터는 HEAD 요청을 보낸다 — HEAD가 405가 되면 안 된다."""
    assert client.head("/api/health").status_code == 200
    assert client.head("/").status_code == 200


def test_register_password_rule(client):
    weak = client.post("/api/auth/register", json={"email": "a@b.com", "password": "password1", "name": "A"})
    assert weak.status_code == 422
    ok = client.post("/api/auth/register", json={"email": "new@b.com", "password": "Strong!123", "name": "New"})
    assert ok.status_code == 201
    assert ok.json()["user"]["role"] == "user"
    dup = client.post("/api/auth/register", json={"email": "new@b.com", "password": "Strong!123", "name": "New"})
    assert dup.status_code == 409


def test_login_and_me(client, user_headers):
    me = client.get("/api/auth/me", headers=user_headers).json()
    assert me["health_type"] == "diabetes"
    assert client.get("/api/auth/me").status_code == 401
    bad = client.post("/api/auth/login", json={"email": "user@recipepick.dev", "password": "Wrong!1234"})
    assert bad.status_code == 401


def test_admin_guard(client, user_headers, admin_headers):
    assert client.get("/api/admin/users", headers=user_headers).status_code == 403
    assert client.get("/api/admin/users", headers=admin_headers).status_code == 200


def test_crawl_match_and_notify(client, user_headers, admin_headers):
    job_id = crawler_service.run_once("manual")
    assert job_id
    jobs = client.get("/api/admin/crawler/jobs", headers=admin_headers).json()
    assert jobs[0]["status"] == "success" and jobs[0]["items_collected"] > 0
    deals = client.get("/api/deals", headers=user_headers).json()
    assert deals and deals[0]["discount_rate"] >= deals[-1]["discount_rate"]

    client.post("/api/fridge", headers=user_headers, json={"name": deals[0]["name"], "is_wishlist": True})
    crawler_service.run_once("manual")
    notes = client.get("/api/notifications", headers=user_headers).json()
    assert any(n["type"] == "deal_match" for n in notes)

    fridge = client.get("/api/fridge", headers=user_headers).json()
    assert any(i["matched_deal"] for i in fridge)

    stats = client.get("/api/admin/crawler/stats", headers=admin_headers).json()
    assert "discount_by_category" in stats["figures"]


def test_recipe_generation_fallback(client, user_headers):
    r = client.post("/api/recipes/generate", headers=user_headers, json={"servings": 2})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source"] == "fallback"
    assert body["data"]["steps"] and body["data"]["nutrition_per_serving"]
    assert client.get("/api/recipes", headers=user_headers).json()[0]["id"] == body["id"]


def test_role_change_and_websocket(client, admin_headers):
    users = client.get("/api/admin/users", headers=admin_headers).json()
    target = next(u for u in users if u["email"] == "new@b.com")
    r = client.patch(f"/api/admin/users/{target['id']}", headers=admin_headers, json={"role": "admin"})
    assert r.json()["role"] == "admin"
    me = next(u for u in users if u["email"] == "admin@recipepick.dev")
    assert client.patch(f"/api/admin/users/{me['id']}", headers=admin_headers, json={"role": "user"}).status_code == 400

    token = admin_headers["Authorization"].split()[1]
    with client.websocket_connect(f"/ws?token={token}") as ws:
        assert ws.receive_json()["type"] == "hello"
        assert ws.receive_json()["type"] == "crawl_status"
        ws.send_text("ping")
        assert ws.receive_json()["type"] == "pong"


def test_admin_access_key_login(client):
    assert client.post("/api/auth/admin-login", json={"access_key": "wrong"}).status_code == 401
    r = client.post("/api/auth/admin-login", json={"access_key": "test-admin-access-key"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    users = client.get("/api/admin/users", headers=h).json()
    target = next(u for u in users if u["email"] == "user@recipepick.dev")
    assert client.patch(f"/api/admin/users/{target['id']}", headers=h, json={"daily_kcal": 1800}).status_code == 200


def test_test_admin_is_read_only(client):
    r = client.post("/api/auth/test-admin")
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/api/admin/overview", headers=h).status_code == 200
    assert client.get("/api/admin/users", headers=h).status_code == 200
    users = client.get("/api/admin/users", headers=h).json()
    target = next(u for u in users if u["email"] == "user@recipepick.dev")
    for resp in (
        client.patch(f"/api/admin/users/{target['id']}", headers=h, json={"role": "admin"}),
        client.post("/api/admin/crawler/run", headers=h),
        client.patch("/api/admin/crawler", headers=h, json={"enabled": False}),
        client.post("/api/fridge", headers=h, json={"name": "x", "category": "기타", "quantity": 1, "unit": "개"}),
        client.patch("/api/auth/me", headers=h, json={"name": "hacked"}),
    ):
        assert resp.status_code == 403, resp.text
        assert "읽기 전용" in resp.json()["detail"]
    assert client.get("/api/admin/users", headers=h).json()[0]["name"] != "hacked"


def test_failover_connection_reports_matched_rows(monkeypatch):
    """페일오버 풀의 raw pymysql 연결도 FOUND_ROWS 를 켜야 값이 같은 UPDATE 가 StaleDataError 를 내지 않는다."""
    import pymysql.constants

    from app import database

    captured = {}
    monkeypatch.setattr(database.pymysql, "connect", lambda **kw: captured.update(kw))
    database._pymysql_connect(host="h", port=3306, user="u", password="p", database="d")
    assert captured["client_flag"] & pymysql.constants.CLIENT.FOUND_ROWS


def test_failback_only_recycles_fallback_connections(monkeypatch):
    """RDS 가 다시 열리면 TiDB(예비) 커넥션만 폐기 대상이 되고, 주 DB 커넥션은 그대로 둔다."""
    from types import SimpleNamespace

    from app import database

    monkeypatch.setattr(database, "_primary_reachable", lambda host, port: True)
    assert database.should_failback(SimpleNamespace(_rp_fallback=True), "rds", 3306)
    assert not database.should_failback(SimpleNamespace(_rp_fallback=False), "rds", 3306)
    monkeypatch.setattr(database, "_primary_reachable", lambda host, port: False)
    assert not database.should_failback(SimpleNamespace(_rp_fallback=True), "rds", 3306)


def test_db_status_reports_actual_backend(client, admin_headers):
    body = client.get("/api/admin/overview", headers=admin_headers).json()
    assert body["database"] == "sqlite" and body["database_failover"] is False



def test_admin_password_login_has_no_admin_rights(client):
    """로그인 유형 분리: 관리자 계정이라도 일반(비밀번호) 로그인으로는 관리자 API 에 접근할 수 없다."""
    r = client.post("/api/auth/login", json={"email": "admin@recipepick.dev", "password": "Admin!2026"})
    assert r.status_code == 200
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/api/admin/users", headers=h).status_code == 403
    assert client.get("/api/fridge", headers=h).status_code == 200


def test_oauth_login_grants_admin_rights_to_promoted_admin(client, admin_headers, monkeypatch):
    """승격된 관리자 계정이 소셜 로그인하면 실제 관리자 권한(adm)을 받는다."""
    from app.routers import auth as auth_router
    from app.security import create_token, decode_token

    monkeypatch.setattr(auth_router, "_fetch_profile", lambda provider, code, state: ("g-uid-1", "promoted@example.com", "승격회원"))

    def callback_token():
        state = create_token({"typ": "oauth_state", "p": "google", "r": "", "n": "x"}, minutes=10)
        r = client.get(f"/api/auth/oauth/google/callback?code=fake&state={state}", follow_redirects=False)
        assert r.status_code in (302, 307), r.text
        return r.headers["location"].split("token=")[1]

    claims = decode_token(callback_token())
    assert not claims.get("adm") and not claims.get("ro")

    uid = next(u for u in client.get("/api/admin/users?q=promoted", headers=admin_headers).json()
               if u["email"] == "promoted@example.com")["id"]
    assert client.patch(f"/api/admin/users/{uid}", headers=admin_headers, json={"role": "admin"}).status_code == 200
    token = callback_token()
    assert decode_token(token).get("adm") is True
    assert client.get("/api/admin/overview", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def _register(client, email):
    r = client.post("/api/auth/register", json={"email": email, "password": "Bye!2026a", "name": "탈퇴테스트"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_withdraw(client, user_headers):
    h = _register(client, "bye@b.com")
    client.post("/api/fridge", headers=h, json={"name": "양파", "category": "채소", "quantity": 1, "unit": "개"})
    assert client.request("DELETE", "/api/auth/me", headers=h, json={"password": "wrong"}).status_code == 401
    assert client.request("DELETE", "/api/auth/me", headers=h, json={"password": "Bye!2026a"}).status_code == 204
    assert client.get("/api/auth/me", headers=h).status_code == 401
    assert client.post("/api/auth/login", json={"email": "bye@b.com", "password": "Bye!2026a"}).status_code == 401
    # 데모 테스트 계정은 보호
    r = client.request("DELETE", "/api/auth/me", headers=user_headers, json={"password": "Recipe!2026"})
    assert r.status_code == 400


def test_admin_kick(client, admin_headers):
    victim = _register(client, "kick@b.com")
    users = client.get("/api/admin/users", headers=admin_headers).json()
    target = next(u for u in users if u["email"] == "kick@b.com")
    me = next(u for u in users if u["email"] == "admin@recipepick.dev")
    ro = {"Authorization": f"Bearer {client.post('/api/auth/test-admin').json()['access_token']}"}
    assert client.delete(f"/api/admin/users/{target['id']}", headers=ro).status_code == 403
    assert client.delete(f"/api/admin/users/{me['id']}", headers=admin_headers).status_code == 400
    assert client.delete(f"/api/admin/users/{target['id']}", headers=admin_headers).status_code == 204
    assert client.get("/api/auth/me", headers=victim).status_code == 401
    assert client.delete(f"/api/admin/users/{target['id']}", headers=admin_headers).status_code == 404


def test_fridge_scan(client, user_headers, monkeypatch):
    import base64

    from app.services import vision

    img = "data:image/png;base64," + base64.b64encode(b"\x89PNG fake-bytes").decode()
    # GEMINI_API_KEY 미설정 → 503
    assert client.post("/api/fridge/scan", headers=user_headers, json={"image": img, "mime": "image/png"}).status_code == 503
    assert client.post("/api/fridge/scan", headers=user_headers, json={"image": img, "mime": "image/gif"}).status_code == 415
    monkeypatch.setattr(vision.settings, "gemini_api_key", "test")
    monkeypatch.setattr(vision, "_call_vision", lambda image, mime, model: {"items": [
        {"name": "계란", "category": "유제품·계란", "quantity": 6, "unit": "개", "confidence": 0.9},
        {"name": "계란", "category": "유제품·계란", "quantity": 1, "unit": "개"},
        {"name": "대파", "category": "알수없음", "quantity": 1, "unit": "단"},
    ]})
    body = client.post("/api/fridge/scan", headers=user_headers, json={"image": img, "mime": "image/png"}).json()
    assert [i["name"] for i in body["items"]] == ["계란", "대파"]
    assert body["items"][1]["category"] == "기타"


def test_recipe_chef_style(client, user_headers):
    styles = client.get("/api/recipes/chef-styles").json()
    assert set(styles) == {"baek", "ahn", "lee", "choi", "shim"}
    r = client.post("/api/recipes/generate", headers=user_headers, json={"style": "lee"})
    assert r.status_code == 200 and r.json()["data"]["style"] == "lee"
    assert r.json()["title"].startswith("[이연복 스타일]")
    assert client.post("/api/recipes/generate", headers=user_headers, json={"style": "unknown"}).status_code == 422
