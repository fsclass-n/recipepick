"""scenes.py · timings.json 으로 영상 대본·연출 가이드 문서를 만든다."""
from common import TTS, VIDEO, load_json
from compose import PART_LABEL
from scenes import resolve, subtitle_text, timeline


def mmss(t: float) -> str:
    m, s = divmod(int(round(t)), 60)
    return f"{m:02d}:{s:02d}"


def main() -> None:
    timings = load_json(TTS / "timings.json")
    rows = []
    for s in timeline():
        lines = timings[s["id"]]["lines"]
        screen = f"PPT {s['slide']}장" if s["kind"] == "slide" else ("좌우 분할 녹화" if s["kind"] == "split" else "운영 사이트 녹화")
        action = s.get("guide") or ("강조 테두리: 핵심 영역" if s.get("hl") else "정지 화면")
        tags = " · ".join(f"{t}({resolve(a, lines):.0f}~{resolve(b, lines):.0f}s)" for t, a, b in s.get("tags", [])) or "-"
        script = " ".join(subtitle_text(x) for x in s["say"])
        rows.append(f"| {mmss(s['start'])}–{mmss(s['start'] + s['dur'])} | {s['id']} | {PART_LABEL[s['part']]} | {screen} | "
                    f"{action} | {script} | {tags} |")
    spoken = sum(v["speech"] for v in timings.values())
    doc = f"""# RecipePick 10분 발표·시연 영상 — 대본 및 연출 가이드

> 이 문서는 `tools/gen_guide.py` 가 `tools/scenes.py`(장면 정의)와 실제 합성 음성 시간으로 생성합니다. 대본 수정은 `scenes.py` 에서만 합니다.

## 완성본 사양

| 항목 | 값 |
| :--- | :--- |
| 파일 | `recipepick_final.mp4` (Git 제외 · GitHub Release 업로드 권장) |
| 길이·형식 | 10:00.00 · 1920×1080 · 고정 30fps · H.264 High · 2-pass 1,100kbps (maxrate 3,000k) |
| 음성 | AAC-LC 160kbps · 48kHz · 스테레오 · 언어 `kor` |
| 내레이션 | 신경망 합성 음성 `ko-KR-HyunsuMultilingualNeural` (속도 −5%, 톤 −2Hz, 문장 사이 0.35초 쉼, 목소리 보정 후 −16 LUFS) · 말하는 시간 약 {spoken:.0f}초 / 600초 |
| 자막 | 화면 자막 + `recipepick_final.srt` |
| 부가 | `recipepick_highlight.mp4` (60초, AI 레시피 구간) · `video-thumbnail.png` |
| 발표자 | 팀 구성 (1인 프로젝트): 홍기흥 (Full-stack Developer) |

## 구간 구성

| 구간 | 시간 | 화면 |
| :--- | :--- | :--- |
| ① PPT 발표 | 00:00–03:00 | `docs/프로젝트_발표자료.pptx` 1~14장 |
| ② 운영 서비스 | 03:00–03:30 | recipepick.onrender.com 메인페이지 |
| ③ 일반 회원 시연 | 03:30–06:30 | 테스트 일반 회원(당뇨 관리): 대시보드 → 냉장고 → 마트 할인 → AI 레시피 → 관리자 화면 차단(403) |
| ④ 관리자 시연 | 06:30–09:00 | 테스트 관리자: 크롤러 · Plotly 차트 · 작업 로그 → **두 계정 좌우 비교**(실시간 반영·자기 권한 잠금) → API 문서 · GitHub Actions |
| ⑤ 클로징 | 09:00–10:00 | PPT 15장(회고) · 16장(Q&A·QR) |

## 계정 비교 포인트 (일반 vs 관리자)

| 비교 항목 | 일반 회원 | 관리자 |
| :--- | :--- | :--- |
| 로그인 | 같은 로그인 화면 · [일반 회원] 테스트 버튼 | 같은 로그인 화면 · [시스템 관리자] 테스트 버튼 |
| 메뉴 | 대시보드 · 냉장고 · 마트 할인 · AI 레시피 · 건강 프로필 | + **관리자** 메뉴 |
| `/admin` 접근 | 대시보드로 돌려보냄 + 관리자 API **403** | 관리자 대시보드 |
| 권한 변경 | - | 회원 건강 타입·권한 변경 → 대상 화면에 **WebSocket 즉시 반영** |
| 자기 권한 | - | 자기 강등·비활성화 스위치 잠금 (서버 400) |

## 장면별 타임라인

| 시간 | ID | 구간 | 화면 | 클릭 동작·마우스 동선 | 대본(자막 표기) | 안내 태그 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
{chr(10).join(rows)}

## 연출 원칙

- 커서: 노란 원형(지름 36px) + 클릭 링. 이동은 경과 시간 기준 0.6~0.8초, 도착 후 0.45초 정지 후 클릭
- 강조: 시안 테두리만 0.3초 페이드(화면 전체 딤·플래시 없음). 설명 중 커서는 대상 오른쪽 아래로 비켜 둠
- 이동: 앱 내부 이동(React Router)만 사용 → 새로고침 흰 화면 없음. `/admin` 직접 입력은 주소 표시줄 오버레이 + history 이동으로 연출
- 구간 라벨: 슬라이드 오른쪽 위 / 시연 왼쪽 아래. 안내 태그: 노란 상자(시연 오른쪽 위, 분할 화면은 아래 가운데)
- 장면 동기화: 장면 시작마다 오른쪽 아래 0.26초 마젠타 표식 → 합성 시 프레임에서 찾아 그 이후부터 정확히 자름(표식은 결과 영상에 남지 않음)

## 데이터·정직성 원칙

- 시연은 **실제 운영 사이트**에서 진행합니다. 운영 데이터 변경은 테스트 일반 회원의 건강 타입 1건이며, 영상 안에서 원래대로(당뇨 관리) 되돌리고 녹화 도구도 종료 시 다시 확인·복구합니다.
- 이마트·롯데마트 상품은 데모(시뮬레이션) 데이터이며 화면의 `DEMO` 배지와 대본으로 밝힙니다. 홈플러스만 실제 수집입니다.
- 영양 수치는 AI 추정값이라는 한계를 PPT 구간에서 언급합니다.
- 내레이션은 합성 음성입니다. 영상 설명에 “AI 합성 음성”을 표기하세요.

## 다시 만들기 (`docs/video/tools/`)

| 순서 | 명령 | 하는 일 |
| :--- | :--- | :--- |
| 1 | `python tts.py --force` | 문장 단위 합성 · 쉼 · 목소리 보정 · 장면 시간 초과 시 속도 자동 조정 |
| 2 | `powershell -File export_slides.ps1` | 발표자료 16장을 1920×1080 PNG 로 내보내기 |
| 3 | `python record_demo.py` | 운영 사이트 시연 자동 녹화(메인 흐름 · 두 계정 비교 · 외부 페이지) |
| 4 | `python compose.py --rebuild` | 장면 클립 → 이어 붙이기 → 내레이션·자막 → 2-pass 인코딩 → 하이라이트·썸네일 |
| 5 | `python check_final.py` | 길이·용량·스트림 · 장면별 음량(−35dB 초과) · 한 프레임 번쩍임 검사 |
| 6 | `python gen_guide.py` | 이 문서 생성 |

- 필요 도구: `.venv`(playwright · edge-tts · requests), ffmpeg(자동 탐색 또는 `FFMPEG` 환경 변수), PowerPoint
- **실제 목소리로 바꾸려면**: 장면별로 녹음해 `work/tts/<장면ID>.wav`(48kHz 스테레오, 장면 길이보다 0.9초 이상 짧게)로 저장하고 `compose.py` 만 다시 실행합니다. 자막 시간은 `work/tts/timings.json` 의 문장 시작·끝을 녹음에 맞게 고칩니다.
"""
    out = VIDEO / "영상_대본_및_연출가이드.md"
    out.write_text(doc, encoding="utf-8")
    print("생성:", out)


if __name__ == "__main__":
    main()
