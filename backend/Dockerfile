# RecipePick API — FastAPI + Playwright(Chromium) + Gemini SDK
# 빌드 컨텍스트는 저장소 루트입니다:  docker build -f backend/Dockerfile .
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    TZ=Asia/Seoul

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install -r requirements.txt \
 # 빌드 타임에 Chromium 바이너리 + 시스템 종속성(폰트/라이브러리) 설치
 && playwright install --with-deps chromium \
 && apt-get update && apt-get install -y --no-install-recommends fonts-noto-cjk tzdata \
 && rm -rf /var/lib/apt/lists/*

COPY rpa ./rpa
COPY backend ./backend

RUN useradd -m -u 1000 app && mkdir -p /app/backend/data && chown -R app:app /app /ms-playwright
USER app

WORKDIR /app/backend
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD python -c "import os,urllib.request;urllib.request.urlopen(f'http://127.0.0.1:{os.getenv(\"PORT\",\"8000\")}/api/health')" || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
