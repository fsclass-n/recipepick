from app.services import gemini

DEALS = [{"name": "국산콩 두부", "mart": "홈플러스", "category": "두부·콩", "unit": "380g",
          "sale_price": 2740, "original_price": 5490, "discount_rate": 50.1, "is_closing_sale": False}]


def test_model_chain_falls_back(monkeypatch):
    monkeypatch.setattr(gemini.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(gemini.settings, "gemini_model", "retired-model")
    calls = []

    def fake_call(prompt, model):
        calls.append(model)
        if model == "retired-model":
            raise RuntimeError("404 NOT_FOUND")
        return {"title": "두부 볶음", "steps": ["볶는다"]}

    monkeypatch.setattr(gemini, "_call_gemini", fake_call)
    data, source = gemini.create_recipe(["양파"], DEALS, "diabetes")
    assert source == "gemini" and data["model"] == gemini.FALLBACK_MODELS[0]
    assert calls[:2] == ["retired-model", gemini.FALLBACK_MODELS[0]]


def test_all_models_fail_uses_template(monkeypatch):
    monkeypatch.setattr(gemini.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(gemini, "_call_gemini", lambda p, m: (_ for _ in ()).throw(RuntimeError("503")))
    data, source = gemini.create_recipe(["양파"], DEALS, "diabetes")
    assert source == "fallback" and data["fallback_reason"] == "ai_error" and data["steps"]
