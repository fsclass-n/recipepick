"""장면별 내레이션 합성 (문장 단위 · 쉼 · 목소리 보정 · -16 LUFS).

python tts.py            # 없는 장면만 합성
python tts.py --force    # 전체 다시 합성
python tts.py P01 U05    # 지정 장면만
"""
import asyncio
import sys

import edge_tts

from common import FFMPEG, TTS, duration, load_json, run, save_json
from scenes import timeline

VOICE = "ko-KR-HyunsuMultilingualNeural"
BASE_RATE = -5          # 기본보다 5% 느리게
PITCH = "-2Hz"          # 톤 약간 낮게
PAUSE = 0.35            # 문장 사이 숨 쉬는 쉼
LEAD = 0.3              # 장면 시작 후 말 시작까지
TAIL_MARGIN = 0.6       # 장면 끝 여유
VOICE_FX = (
    "highpass=f=80,"
    "acompressor=threshold=-20dB:ratio=2.5:attack=15:release=200:makeup=2,"
    "equalizer=f=3000:t=q:w=1.2:g=2.5,"
    "loudnorm=I=-16:TP=-1.5:LRA=7"
)
TRIM = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,"
        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse")


async def synth(text: str, rate: int, path) -> None:
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, VOICE, rate=f"{rate:+d}%", pitch=PITCH).save(str(path))
            return
        except Exception:
            if attempt == 3:
                raise
            await asyncio.sleep(2 + attempt * 2)


async def build_scene(scene: dict) -> dict:
    sid, budget = scene["id"], scene["dur"] - LEAD - TAIL_MARGIN
    silence = TTS / "_pause.wav"
    if not silence.exists():
        run([FFMPEG, "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", PAUSE, silence])
    rate = BASE_RATE
    while True:
        parts, lines, t = [], [], LEAD
        for i, text in enumerate(scene["say"]):
            mp3 = TTS / f"{sid}_{i}.mp3"
            wav = TTS / f"{sid}_{i}.wav"
            await synth(text, rate, mp3)
            run([FFMPEG, "-y", "-i", mp3, "-af", TRIM, "-ar", 48000, "-ac", 2, wav])
            d = duration(wav)
            lines.append({"text": text, "start": round(t, 3), "end": round(t + d, 3)})
            t += d + PAUSE
            parts += [wav, silence]
        total = t - PAUSE - LEAD
        if total <= budget or rate >= 12:
            break
        rate += 3
    lst = TTS / f"{sid}_list.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts[:-1]), encoding="utf-8")
    out = TTS / f"{sid}.wav"
    run([FFMPEG, "-y", "-f", "concat", "-safe", 0, "-i", lst, "-af", VOICE_FX, "-ar", 48000, "-ac", 2, out])
    return {"id": sid, "rate": rate, "speech": round(total, 2), "budget": round(budget, 2),
            "over": total > budget, "lines": lines}


async def main(ids: list[str], force: bool) -> None:
    meta_path = TTS / "timings.json"
    meta = load_json(meta_path, {})
    todo = [s for s in timeline() if (not ids or s["id"] in ids) and (force or ids or s["id"] not in meta)]
    sem = asyncio.Semaphore(4)

    async def one(s):
        async with sem:
            r = await build_scene(s)
            flag = "  ⚠ 시간 초과" if r["over"] else ""
            print(f"{r['id']}: 말하기 {r['speech']:5.1f}s / 예산 {r['budget']:5.1f}s · 속도 {r['rate']:+d}%{flag}", flush=True)
            meta[r["id"]] = r

    await asyncio.gather(*(one(s) for s in todo))
    save_json(meta_path, meta)
    spoken = sum(m["speech"] for m in meta.values())
    print(f"\n합성 장면 {len(meta)}개 · 전체 말하기 시간 {spoken:.0f}s / 600s")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    asyncio.run(main(args, "--force" in sys.argv))
