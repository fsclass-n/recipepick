from app.services.crawler import crawler_service


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


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
