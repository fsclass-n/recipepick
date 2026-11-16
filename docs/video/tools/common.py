"""영상 제작 도구 공통 설정."""
import glob
import json
import os
import shutil
import subprocess
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
VIDEO = TOOLS.parent
ROOT = VIDEO.parent.parent
WORK = VIDEO / "work"
SLIDES = WORK / "slides"
TTS = WORK / "tts"
RAW = WORK / "raw"
CLIPS = WORK / "clips"
PPTX = ROOT / "docs" / "프로젝트_발표자료.pptx"

FINAL = VIDEO / "recipepick_final.mp4"
SRT = VIDEO / "recipepick_final.srt"
HIGHLIGHT = VIDEO / "recipepick_highlight.mp4"
THUMB = VIDEO / "video-thumbnail.png"

FPS = 30
W, H = 1920, 1080
SITE = "https://recipepick.onrender.com"
API = "https://recipepick-api.onrender.com"

for d in (WORK, SLIDES, TTS, RAW, CLIPS):
    d.mkdir(parents=True, exist_ok=True)


def _find(name: str) -> str:
    env = os.getenv(name.upper())
    if env:
        return env
    found = shutil.which(name)
    if found:
        return found
    hits = glob.glob(os.path.expandvars(
        rf"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\ffmpeg-*\bin\{name}.exe"))
    if hits:
        return sorted(hits)[-1]
    raise SystemExit(f"{name} 를 찾을 수 없습니다. ffmpeg 를 설치하거나 {name.upper()} 환경 변수를 지정하세요.")


FFMPEG = _find("ffmpeg")
FFPROBE = _find("ffprobe")


def run(args: list, quiet: bool = True) -> subprocess.CompletedProcess:
    cmd = [str(a) for a in args]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if res.returncode != 0:
        raise RuntimeError(f"명령 실패: {' '.join(cmd[:6])} ...\n{res.stderr[-2500:]}")
    if not quiet:
        print(res.stderr[-800:])
    return res


def duration(path: Path) -> float:
    out = run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path])
    return float(out.stdout.strip())


def load_json(path: Path, default=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
