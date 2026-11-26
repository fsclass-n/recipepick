# AGENTS.md — RecipePick

## Environment (Windows, Git Bash)
- Python: `.venv` (3.11, created with `py -3.11 -m venv .venv`). Use `.venv/Scripts/python.exe`.
- Node is installed at `C:\Program Files\nodejs` but not on Git Bash PATH: `export PATH="/c/Program Files/nodejs:$PATH"`.
- Set `PYTHONIOENCODING=utf-8` when printing Korean from Python in the shell.
- Single root `.env` for backend and frontend (Vite `envDir: ".."`; only `VITE_*` exposed).
- New deps: install with `pip install --uploaded-prior-to <date 7+ days ago>` / `npm install --before=<date>`, pin exact versions.

## Verify
- Backend tests: `cd backend && PYTHONIOENCODING=utf-8 ../.venv/Scripts/python.exe -m pytest -q`
- Frontend build: `cd frontend && npm run build`
- RPA standalone: `.venv/Scripts/python.exe -m rpa --mode auto|live|demo [--json]`
- Run: `cd backend && ../.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000` + `cd frontend && npm run dev`

- UI screenshot check (isolated, never touches prod DB/webhooks): run the backend with `APP_ENV=development SECRET_KEY=<any> DATABASE_URL=sqlite:///<tmp>.db TIDB_HOST= CRAWL_ON_STARTUP=false RPA_MODE=demo TELEGRAM_BOT_TOKEN= DISCORD_WEBHOOK_URL= SMTP_HOST=` (root `.env` is otherwise loaded and is production), frontend with `VITE_API_BASE_URL=http://localhost:<port> npx vite`, then screenshot via `.venv` Playwright (`python -m playwright install chromium` once). Write remote/temp files with LF (`newline="
"`/bytes) — Windows text mode adds CRLF.

## Conventions
- Tailwind v4: custom component classes are defined with `@utility` in `frontend/src/index.css` (not `@layer components`).
- Design system ("Rescue Kitchen" editorial): tokens keep legacy names (`leaf`=herb green, `tomato`=terracotta, `cream`/`paper`, `ink`); serif headings (`font-display` = Noto Serif KR, `serif-en` = Fraunces italic). Layout utilities: `container-x`, `section-y`, `eyebrow`. Every route renders inside `SiteLayout` (global Header/Footer/ToTop in `App.jsx`); member pages start with `components/PageHero.jsx`.
- Images: Unsplash IDs live only in `frontend/src/lib/images.js` — verify a new ID returns 200 and check the subject visually before use.
- Login types (3): member (password/OAuth/test user), test admin (`POST /api/auth/test-admin` → JWT `ro: true`; every non-GET/HEAD/OPTIONS is 403), real admin (`POST /api/auth/admin-login` with `.env` `ADMIN_ACCESS_KEY` → JWT `adm: true`). `require_admin` needs role admin **and** `adm`/`ro`; an admin account logged in by password is just a member. Tests' `admin_headers` and the video recorder use the key login.
- Accounts: `DELETE /api/auth/me` (password or '탈퇴' for OAuth) and `DELETE /api/admin/users/{id}` (kick) share `services/accounts.py`; seeded test accounts and the last admin are protected. Clients get a WS `account_removed` event and log out.
- DB failover (EC2): `DATABASE_URL`(RDS)+`TIDB_*` → creator pool; checkout hook recycles TiDB connections once RDS's port reopens (probe ≤30s). `db_status()` reports the backend from `SELECT VERSION()` (not config). Netlify/Render frontends talk to the Render API, which is always TiDB.
- Marts: 4 crawlers (Emart/Lotte/Oimarket demo-only, Homeplus live). Demo product photos are self-hosted in `frontend/public/demo` (`DEMO_IMAGES` in `rpa/base.py`, sources in `CREDITS.txt`); mart signature symbols (round badges) in `frontend/public/logos` (sources in `CREDITS.txt`).
- AI: chef style (`style` in `RecipeRequest`, keys in `schemas.CHEF_STYLES` ↔ `frontend/src/lib/chefs.js`); fridge photo scan `POST /api/fridge/scan` (base64 JSON, Gemini vision, nothing stored).
- `plotly.js-basic-dist-min` has no histogram trace; aggregate server-side (NumPy) and send bar charts.
- RPA: respect robots.txt; Emart (Akamai) and Lotte ON (robots Disallow) are `live_enabled = False` → demo data.

## Deploy
- Push to `main` auto-deploys via platform Git integrations (no deploy hooks): Render (`render.yaml`, `autoDeployTrigger: commit`) and Netlify (`netlify.toml`).
- GitHub Actions: `ci.yml` (tests/build/docker).
- GitHub Pages: deployed from the main branch root → root `index.html` (single-file portfolio) + `assets/` + `.nojekyll`. Edit works/videos via the config arrays at the top of the `<script>` in `index.html`.

## Video (docs/video)
- Rebuild the 10-min presentation/demo video with `docs/video/tools/` (tts.py → export_slides.ps1 → record_demo.py → compose.py → check_final.py → gen_guide.py). Scene script/timing lives only in `tools/scenes.py`.
- ffmpeg is auto-detected from the winget Gyan.FFmpeg install (or set `FFMPEG`). Large outputs (`*.mp4`, `work/`) are git-ignored; upload the final mp4 to a GitHub Release.
- Demo recording runs against production and temporarily changes the test user's health type; the recorder restores it (`ensure_test_user`).

## Docs (진행일지·산출물)
- `python docs/tools/build_docs.py` regenerates the 5 journals (fills only empty cells of the original forms in `docs/tools/templates/`) and 5 deliverables, re-saves them via Hancom Hwp COM and exports PDFs to `docs/pdf/`. Content lives in `docs/tools/doc_content.py`.
- Hwp COM gotchas: use PowerShell COM (`hwp_to_pdf.ps1`), export PDF before re-saving the open HWPX, export to an ASCII temp path. HTML import/InsertFile crashes Hwp here.
