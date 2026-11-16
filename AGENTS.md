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

## Conventions
- Tailwind v4: custom component classes are defined with `@utility` in `frontend/src/index.css` (not `@layer components`).
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
