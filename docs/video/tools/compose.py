"""장면 클립 → 이어 붙이기 → 내레이션·자막 → 2-pass 인코딩 → 하이라이트·썸네일.

python compose.py            # 전체
python compose.py --rebuild  # 장면 클립도 다시 생성
"""
import re
import sys
from pathlib import Path

from common import (CLIPS, FFMPEG, FINAL, FPS, H, HIGHLIGHT, RAW, SLIDES, SRT, THUMB, TTS, W, WORK,
                    duration, load_json, run)
from scenes import PARTS, TOTAL, resolve, subtitle_text, timeline

PX = W / 13.333  # 발표자료 인치 → 픽셀
LEAD = 0.3
X264_CLIP = ["-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", str(FPS)]
PART_LABEL = {"ppt": "① PPT 발표", "intro": "② 운영 서비스", "user": "③ 일반 회원 시연",
              "admin": "④ 관리자 시연", "compare": "④ 두 계정 비교", "close": "⑤ 클로징"}


def frames(sec: float) -> int:
    return int(round(sec * FPS))


# ------------------------------------------------------------------ 동기화 표식 찾기
SYNC_GAP = 0.36
_sync_cache: dict = {}


def find_sync(src: str, approx: float) -> float:
    """녹화 원본에서 오른쪽 아래 마젠타 표식이 처음 보이는 프레임을 찾아 장면 0초 위치를 돌려준다."""
    key = (src, approx)
    if key in _sync_cache:
        return _sync_cache[key]
    import subprocess
    t0 = max(0.0, approx - 12)
    res = subprocess.run([FFMPEG, "-v", "error", "-ss", f"{t0:.3f}", "-i", src, "-t", "20",
                          "-vf", "fps=25,crop=12:12:iw-18:ih-18", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True)
    data, size = res.stdout, 12 * 12 * 3
    found = None
    for i in range(len(data) // size):
        px = data[i * size:(i + 1) * size]
        r, g, b = (sum(px[c::3]) / (size // 3) for c in range(3))
        if r > 200 and g < 90 and b > 200:
            found = t0 + i / 25
            break
    start = (found + SYNC_GAP) if found is not None else approx
    print(f"    sync {Path(src).name[:14]} 예상 {approx:7.2f}s → {'표식 ' + format(found, '.2f') + 's' if found is not None else '표식 없음(예상값 사용)'}")
    _sync_cache[key] = start
    return start


# ------------------------------------------------------------------ 장면 클립
def slide_clip(s: dict, out: Path) -> None:
    n, dur = frames(s["dur"]), s["dur"]
    vf = []
    if s.get("hl"):
        x, y, w, h = (round(v * PX) for v in s["hl"])
        pad = 8
        x, y, w, h = x - pad, y - pad, w + pad * 2, h + pad * 2
        on = f"enable='between(t,1.2,{dur - 0.6})'"
        vf += [f"drawbox=x={x - 4}:y={y - 4}:w={w + 8}:h={h + 8}:color=0x22d3ee@0.28:t=4:{on}",
               f"drawbox=x={x}:y={y}:w={w}:h={h}:color=0x22d3ee@1.0:t=4:{on}"]
    if s["id"] in ("P01", "C01"):
        vf.append("fade=t=in:st=0:d=0.5")
    vf.append("format=yuv420p")
    run([FFMPEG, "-y", "-loop", "1", "-framerate", FPS, "-i", SLIDES / f"s{s['slide']:02d}.png",
         "-vf", ",".join(vf), "-frames:v", n, *X264_CLIP, out])


def demo_clip(s: dict, marks: dict, out: Path) -> None:
    n, m = frames(s["dur"]), marks[s["id"]]["video"]
    src = marks["_videos"][m["page"]]
    vf = (f"fps={FPS},scale={W}:{H}:flags=lanczos,tpad=stop_mode=clone:stop_duration=4"
          + (",fade=t=in:st=0:d=0.5" if s["id"] == "D01" else "") + ",format=yuv420p")
    start = find_sync(src, m["start"])
    run([FFMPEG, "-y", "-ss", f"{start:.3f}", "-i", src, "-t", s["dur"] + 1, "-vf", vf, "-frames:v", n, *X264_CLIP, out])


def split_clip(s: dict, marks: dict, out: Path) -> None:
    n, mk = frames(s["dur"]), marks[s["id"]]
    left, right = marks["_videos"][mk["left"]["page"]], marks["_videos"][mk["right"]["page"]]
    half = W // 2
    fc = (f"[0:v]fps={FPS},scale={half}:{H}:flags=lanczos,tpad=stop_mode=clone:stop_duration=4[l];"
          f"[1:v]fps={FPS},scale={half}:{H}:flags=lanczos,tpad=stop_mode=clone:stop_duration=4[r];"
          f"[l][r]hstack=inputs=2,drawbox=x={half - 2}:y=0:w=4:h={H}:color=0x0c1410@1:t=fill,format=yuv420p[v]")
    ls, rs = find_sync(left, mk["left"]["start"]), find_sync(right, mk["right"]["start"])
    run([FFMPEG, "-y", "-ss", f"{ls:.3f}", "-i", left, "-ss", f"{rs:.3f}", "-i", right,
         "-filter_complex", fc, "-map", "[v]", "-frames:v", n, *X264_CLIP, out])


# ------------------------------------------------------------------ 오디오
def narration(scenes: list) -> Path:
    parts = []
    for s in scenes:
        wav, out = TTS / f"{s['id']}.wav", CLIPS / f"{s['id']}_a.wav"
        delay = int(LEAD * 1000)
        run([FFMPEG, "-y", "-i", wav, "-af", f"adelay={delay}|{delay},apad", "-t", s["dur"],
             "-ar", 48000, "-ac", 2, "-c:a", "pcm_s16le", out])
        parts.append(out)
    lst = CLIPS / "audio_list.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
    out = WORK / "narration.wav"
    run([FFMPEG, "-y", "-f", "concat", "-safe", 0, "-i", lst, "-c:a", "pcm_s16le", out])
    return out


# ------------------------------------------------------------------ 자막
def chunks(text: str, max_len: int = 23) -> list[str]:
    """어절 단위로 줄을 나누고, 두 줄씩 한 자막으로 묶는다."""
    words, lines, cur = text.split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > max_len:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    return ["\n".join(lines[i:i + 2]) for i in range(0, len(lines), 2)]


def subtitle_events(scenes: list, timings: dict) -> list[tuple]:
    ev = []
    for s in scenes:
        for ln in timings[s["id"]]["lines"]:
            text = subtitle_text(ln["text"])
            parts = chunks(text)
            total = sum(len(p) for p in parts)
            t, span = s["start"] + ln["start"], ln["end"] - ln["start"]
            for i, p in enumerate(parts):
                d = span * len(p) / total
                end = t + d + (0.25 if i == len(parts) - 1 else 0)
                ev.append((t, min(end, s["start"] + s["dur"] - 0.05), p))
                t += d
    return ev


def ts_ass(t: float) -> str:
    h, rem = divmod(t, 3600)
    m, sec = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{sec:05.2f}"


def ts_srt(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    sec, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"


def write_subs(scenes: list, timings: dict) -> Path:
    ev = subtitle_events(scenes, timings)
    SRT.write_text("".join(f"{i}\n{ts_srt(a)} --> {ts_srt(b)}\n{t}\n\n" for i, (a, b, t) in enumerate(ev, 1)),
                   encoding="utf-8")
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Malgun Gothic,40,&H00FFFFFF,&H00FFFFFF,&H70000000,&H70000000,-1,0,0,0,100,100,0,0,3,14,0,2,80,80,42,1
Style: Label,Malgun Gothic,25,&H00FFFFFF,&H00FFFFFF,&H004AA316,&H004AA316,-1,0,0,0,100,100,0,0,3,9,0,7,24,24,24,1
Style: Tag,Malgun Gothic,28,&H00101010,&H00101010,&H0015CCFA,&H0015CCFA,-1,0,0,0,100,100,0,0,3,10,0,9,32,32,90,1
Style: Pane,Malgun Gothic,26,&H00FFFFFF,&H00FFFFFF,&H00532D14,&H00532D14,-1,0,0,0,100,100,0,0,3,9,0,8,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    rows = []
    esc = lambda t: t.replace("\n", "\\N")  # noqa: E731
    for a, b, t in ev:
        rows.append(f"Dialogue: 2,{ts_ass(a)},{ts_ass(b)},Sub,,0,0,0,,{esc(t)}")
    # 구간 라벨: 슬라이드는 오른쪽 위, 시연은 왼쪽 아래
    for s in scenes:
        a, b = s["start"], s["start"] + s["dur"]
        label = PART_LABEL[s["part"]]
        pos = r"{\an9\pos(1890,22)}" if s["kind"] == "slide" else r"{\an1\pos(22,1058)}"
        rows.append(f"Dialogue: 1,{ts_ass(a)},{ts_ass(b)},Label,,0,0,0,,{pos}{label}")
        lines = timings[s["id"]]["lines"]
        for text, t1, t2 in s.get("tags", []):
            t1, t2 = resolve(t1, lines), resolve(t2, lines)
            p = r"{\an2\pos(960,930)}" if s["kind"] == "split" else r"{\an9\pos(1890,84)}"
            rows.append(f"Dialogue: 3,{ts_ass(a + t1)},{ts_ass(a + t2)},Tag,,0,0,0,,{p}{{\\fad(250,250)}}{text}")
        if s["kind"] == "split":
            rows.append(f"Dialogue: 3,{ts_ass(a)},{ts_ass(b)},Pane,,0,0,0,,{{\\an2\\pos(480,996)}} 일반 회원 · user@recipepick.dev ")
            rows.append(f"Dialogue: 3,{ts_ass(a)},{ts_ass(b)},Pane,,0,0,0,,{{\\an2\\pos(1440,996)}} 관리자 · admin@recipepick.dev ")
    out = WORK / "subs.ass"
    out.write_text(head + "\n".join(rows) + "\n", encoding="utf-8-sig")
    return out


# ------------------------------------------------------------------ 최종 인코딩
def encode(video: Path, audio: Path, ass: Path) -> None:
    vf = f"ass={ass.name}:fontsdir='C\\:/Windows/Fonts'"
    x264 = ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", str(FPS),
            "-b:v", "1100k", "-maxrate", "3000k", "-bufsize", "6000k", "-x264-params", "keyint=150:min-keyint=30"]
    common = ["-i", video.name, "-i", audio.name, "-vf", vf, "-t", TOTAL, *x264]
    plog = WORK / "x264pass"
    import subprocess
    for p in (1, 2):
        extra = ["-pass", "1", "-passlogfile", plog.name, "-an", "-f", "null", "NUL"] if p == 1 else [
            "-pass", "2", "-passlogfile", plog.name, "-map", "0:v", "-map", "1:a",
            "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", "-metadata:s:a:0", "language=kor",
            "-metadata", "title=RecipePick 발표·시연 (1인 프로젝트: 홍기흥)", "-movflags", "+faststart", str(FINAL)]
        res = subprocess.run([FFMPEG, "-y", "-nostats", "-loglevel", "error", *map(str, common), *extra],
                             cwd=WORK, capture_output=True,
                             text=True, encoding="utf-8", errors="replace")
        if res.returncode:
            raise RuntimeError(f"ffmpeg pass {p} 실패 (code {res.returncode}): {res.stderr[-2500:]}")
        print(f"  pass {p} 완료", flush=True)


def extras(scenes: list) -> None:
    by_id = {s["id"]: s for s in scenes}
    hs = by_id["U05"]["start"]
    run([FFMPEG, "-y", "-ss", hs, "-i", FINAL, "-t", 60, "-vf", "scale=1280:-2", "-c:v", "libx264",
         "-b:v", "1000k", "-maxrate", "2000k", "-bufsize", "4000k", "-c:a", "aac", "-b:a", "96k",
         "-movflags", "+faststart", HIGHLIGHT])
    run([FFMPEG, "-y", "-ss", by_id["U06"]["start"] + 6, "-i", FINAL, "-frames:v", 1, THUMB])


def main() -> None:
    scenes = timeline()
    timings = load_json(TTS / "timings.json")
    marks = load_json(RAW / "marks.json")
    rebuild = "--rebuild" in sys.argv
    clips = []
    for s in scenes:
        out = CLIPS / f"{s['id']}.mp4"
        if rebuild or not out.exists():
            {"slide": lambda: slide_clip(s, out), "demo": lambda: demo_clip(s, marks, out),
             "split": lambda: split_clip(s, marks, out)}[s["kind"]]()
            print(f"  clip {s['id']} ({s['kind']}, {s['dur']}s)", flush=True)
        clips.append(out)
    lst = CLIPS / "video_list.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in clips), encoding="utf-8")
    master = WORK / "master_video.mp4"
    run([FFMPEG, "-y", "-f", "concat", "-safe", 0, "-i", lst, "-c", "copy", master])
    print(f"영상 이어 붙이기: {duration(master):.2f}s", flush=True)
    audio = narration(scenes)
    print(f"내레이션: {duration(audio):.2f}s", flush=True)
    ass = write_subs(scenes, timings)
    print("자막 생성:", SRT.name, flush=True)
    encode(master, audio, ass)
    extras(scenes)
    size = FINAL.stat().st_size / 1024 / 1024
    print(f"완료: {FINAL.name} {duration(FINAL):.2f}s · {size:.1f}MB / 하이라이트 "
          f"{HIGHLIGHT.stat().st_size / 1024 / 1024:.1f}MB")


if __name__ == "__main__":
    main()
