"""최종 영상 검사: 길이·용량·스트림 / 장면별 내레이션 음량 / 한 프레임 번쩍임."""
import re
import subprocess

from common import FFMPEG, FFPROBE, FINAL, HIGHLIGHT, TTS, load_json
from scenes import timeline


def probe() -> None:
    out = subprocess.run([FFPROBE, "-v", "error", "-show_entries",
                          "stream=codec_type,codec_name,profile,width,height,r_frame_rate,sample_rate,channels:stream_tags=language",
                          "-show_entries", "format=duration,size", "-of", "compact", FINAL],
                         capture_output=True, text=True).stdout
    print(out.strip())
    size = FINAL.stat().st_size / 1024 / 1024
    hl = HIGHLIGHT.stat().st_size / 1024 / 1024
    print(f"용량 {size:.1f}MB (≤95) · 하이라이트 {hl:.1f}MB (≤10)", "OK" if size <= 95 and hl <= 10 else "확인 필요")


def audio() -> None:
    timings = load_json(TTS / "timings.json")
    quiet = []
    for s in timeline():
        sp = timings[s["id"]]["speech"]
        r = subprocess.run([FFMPEG, "-v", "info", "-ss", f"{s['start'] + 0.3:.2f}", "-t", f"{sp:.2f}", "-i", FINAL,
                            "-vn", "-af", "volumedetect", "-f", "null", "NUL"], capture_output=True, text=True,
                           encoding="utf-8", errors="replace").stderr
        mean = float(re.search(r"mean_volume: (-?[\d.]+)", r).group(1))
        if mean < -35:
            quiet.append((s["id"], mean))
    print(f"내레이션 장면 {len(timeline())}개 중 -35dB 미만: {len(quiet)}개", quiet or "")


def flicker() -> None:
    r = subprocess.run([FFMPEG, "-v", "error", "-i", FINAL, "-vf",
                        "scale=320:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-",
                        "-an", "-f", "null", "NUL"], capture_output=True, text=True)
    ys = [float(v) for v in re.findall(r"YAVG=([\d.]+)", r.stdout)]
    bounds = [s["start"] for s in timeline()]
    flashes = []
    for i in range(1, len(ys) - 1):
        a, b = ys[i] - ys[i - 1], ys[i + 1] - ys[i]
        t = i / 30
        if abs(a) >= 4 and abs(b) >= 4 and a * b < 0 and all(abs(t - x) > 0.6 for x in bounds):
            flashes.append(round(t, 2))
    print(f"프레임 {len(ys)}개 · 한 프레임 번쩍임 {len(flashes)}회", flashes[:10] or "")


if __name__ == "__main__":
    probe()
    audio()
    flicker()
