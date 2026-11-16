"""진행일지(양식 빈 칸 채우기)·산출물(본문 생성) HWPX 작성 → 한글(COM)로 정리 저장 → PDF 변환.

python docs/tools/build_docs.py          # HWPX 작성 + PDF 변환
python docs/tools/build_docs.py --no-pdf # HWPX 작성만
"""
import re
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

sys.path.insert(0, str(Path(__file__).resolve().parent))
from doc_content import JOURNAL, MEMBER, OUTPUTS, TOPIC  # noqa: E402

DOCS = Path(__file__).resolve().parents[1]
OUT_DIR = DOCS / "산출물"
TEMPLATES = Path(__file__).resolve().parent / "templates"  # 원본 양식(빈 칸 상태) 보관본
PDF_DIR = DOCS / "pdf"
JOURNAL_FIELDS = ["수행과제", "도달목표", "지시사항", "수행사항", "미수행사항", "수행결과",
                  "마감회의", "문제점", "미해결 사항및 과제", "차기 주제"]
P_ATTR = 'id="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"'


# ------------------------------------------------------------------ HWPX 입출력
def read_hwpx(path: Path) -> dict:
    with zipfile.ZipFile(path) as z:
        return {i.filename: (z.read(i.filename), i.compress_type) for i in z.infolist()}


def write_hwpx(path: Path, entries: dict) -> None:
    tmp = path.with_suffix(".tmp")
    with zipfile.ZipFile(tmp, "w") as z:
        for name in ["mimetype"] + [n for n in entries if n != "mimetype"]:
            data, ctype = entries[name]
            z.writestr(zipfile.ZipInfo(name), data, compress_type=zipfile.ZIP_STORED if name == "mimetype" else ctype)
    tmp.replace(path)


def para(text: str, para_pr: int, char_pr: int) -> str:
    t = f"<hp:t>{escape(text)}</hp:t>" if text else "<hp:t/>"
    return f'<hp:p {P_ATTR} paraPrIDRef="{para_pr}"><hp:run charPrIDRef="{char_pr}">{t}</hp:run></hp:p>'


# ------------------------------------------------------------------ 진행일지
def fill_cell(section: str, row: int, col: int, lines: list[str]) -> str:
    """cellAddr(row, col) 셀의 문단을 lines 로 교체한다 (subList 속성·셀 크기·테두리는 유지)."""
    addr = f'<hp:cellAddr colAddr="{col}" rowAddr="{row}"/>'
    ai = section.index(addr)
    tc = section.rfind("<hp:tc ", 0, ai)
    s_open_end = section.index(">", section.index("<hp:subList", tc)) + 1
    s_close = section.index("</hp:subList>", s_open_end)
    body = "".join(para(l, 2, 1 if l.startswith("▶") else 0) for l in lines)
    return section[:s_open_end] + body + section[s_close:]


def build_journal(path: Path, data: dict) -> None:
    entries = read_hwpx(TEMPLATES / path.name)
    sec = entries["Contents/section0.xml"][0].decode("utf-8")
    second = sec.index("<hp:tbl", sec.index("<hp:tbl") + 10)  # 1번째 표는 제목 표
    head, body = sec[:second], sec[second:]
    body = fill_cell(body, 1, 2, [TOPIC])
    body = fill_cell(body, 2, 2, [MEMBER])
    for i, field in enumerate(JOURNAL_FIELDS):
        body = fill_cell(body, 3 + i, 1, data[field])
    entries["Contents/section0.xml"] = (( head + body).encode("utf-8"), entries["Contents/section0.xml"][1])
    write_hwpx(path, entries)


# ------------------------------------------------------------------ 산출물 스타일 (진행일지 헤더 기반 + 추가)
def char_pr(i: int, height: int, color: str, bold: bool) -> str:
    z = 'hangul="{v}" latin="{v}" hanja="{v}" japanese="{v}" other="{v}" symbol="{v}" user="{v}"'
    return (f'<hh:charPr id="{i}" height="{height}" textColor="{color}" shadeColor="none" useFontSpace="0" useKerning="0" '
            f'symMark="NONE" borderFillIDRef="2"><hh:fontRef {z.format(v=0)}/><hh:ratio {z.format(v=100)}/>'
            f'<hh:spacing {z.format(v=0)}/><hh:relSz {z.format(v=100)}/><hh:offset {z.format(v=0)}/>'
            + ("<hh:bold/>" if bold else "") + '<hh:strikeout shape="3D" color="#000000"/></hh:charPr>')


def para_pr(i: int, align: str, spacing: int, prev: int = 0, nxt: int = 0, left: int = 0, intent: int = 0,
            keep_next: int = 0) -> str:
    return (f'<hh:paraPr id="{i}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">'
            f'<hh:align horizontal="{align}" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/>'
            f'<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="{keep_next}" '
            f'keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/><hh:autoSpacing eAsianEng="0" eAsianNum="0"/>'
            f'<hh:margin><hc:intent value="{intent}" unit="HWPUNIT"/><hc:left value="{left}" unit="HWPUNIT"/>'
            f'<hc:right value="0" unit="HWPUNIT"/><hc:prev value="{prev}" unit="HWPUNIT"/><hc:next value="{nxt}" unit="HWPUNIT"/></hh:margin>'
            f'<hh:lineSpacing type="PERCENT" value="{spacing}" unit="HWPUNIT"/>'
            f'<hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr>')


# 글자 모양: 0 본문10 · 1 본문10굵게 · 2 제목16굵게 · 3 제목16파랑 · 4 H1 13파랑 · 5 H2 11굵게 · 6 표9.5 · 7 표9.5굵게 · 8 캡션9회색
EXTRA_CHAR = [char_pr(4, 1300, "#2E5597", True), char_pr(5, 1100, "#000000", True), char_pr(6, 950, "#000000", False),
              char_pr(7, 950, "#000000", True), char_pr(8, 900, "#555555", False)]
# 문단 모양: 5 H1 · 6 본문 · 7 글머리 · 8 표 왼쪽 · 9 H2 · 10 표 가운데
EXTRA_PARA = [para_pr(5, "LEFT", 130, prev=1700, nxt=500, keep_next=1), para_pr(6, "JUSTIFY", 155, nxt=300),
              para_pr(7, "LEFT", 150, left=1400, intent=-700, nxt=120), para_pr(8, "LEFT", 125),
              para_pr(9, "LEFT", 130, prev=900, nxt=300, keep_next=1), para_pr(10, "CENTER", 125)]


def extend_header(header: str) -> str:
    def add(tag: str, items: list[str], h: str) -> str:
        m = re.search(rf'<hh:{tag} itemCnt="(\d+)">', h)
        n = int(m.group(1)) + len(items)
        h = h.replace(m.group(0), f'<hh:{tag} itemCnt="{n}">', 1)
        return h.replace(f"</hh:{tag}>", "".join(items) + f"</hh:{tag}>", 1)
    header = add("charProperties", EXTRA_CHAR, header)
    return add("paraProperties", EXTRA_PARA, header)


# ------------------------------------------------------------------ 산출물 본문 블록
class Doc:
    def __init__(self, width: int):
        self.width, self.parts, self.tbl_id = width, [], 2000

    def p(self, text: str, pp: int = 6, cp: int = 0) -> None:
        self.parts.append(para(text, pp, cp))

    def title_box(self) -> None:
        """진행일지 양식과 동일한 제목 표: 위·아래 굵은 선(테두리 4), 16pt 굵게 + 파랑 강조."""
        self.tbl_id += 1
        body = (para("[K-Digital] 심화_생성형 AI와 AWS 클라우드를 활용한", 3, 2)
                + f'<hp:p {P_ATTR} paraPrIDRef="3"><hp:run charPrIDRef="2"><hp:t>{escape("풀스택 & 자동화 실무 개발 ")}</hp:t></hp:run>'
                  '<hp:run charPrIDRef="3"><hp:t>Final-Project 산출물</hp:t></hp:run></hp:p>')
        tbl = (f'<hp:tbl id="{self.tbl_id}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" '
               'lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="1" colCnt="1" cellSpacing="0" '
               f'borderFillIDRef="3" noAdjust="0"><hp:sz width="{self.width}" widthRelTo="ABSOLUTE" height="4000" '
               'heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" '
               'allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" '
               'vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/>'
               '<hp:inMargin left="510" right="510" top="141" bottom="141"/><hp:tr><hp:tc name="" header="0" hasMargin="0" '
               'protect="0" editable="0" dirty="0" borderFillIDRef="4"><hp:subList id="" textDirection="HORIZONTAL" '
               'lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" '
               f'hasTextRef="0" hasNumRef="0">{body}</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/>'
               f'<hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="{self.width}" height="4000"/>'
               '<hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc></hp:tr></hp:tbl>')
        self.parts.append(f'<hp:p {P_ATTR} paraPrIDRef="1"><hp:run charPrIDRef="0">{tbl}<hp:t/></hp:run></hp:p>')

    def table(self, header: list[str] | None, rows: list[list[str]], weights: list[float], key_col: bool = False,
              title_style: bool = False) -> None:
        self.tbl_id += 1
        ncol = len(weights)
        total = sum(weights)
        widths = [int(self.width * w / total) for w in weights]
        widths[-1] += self.width - sum(widths)
        all_rows = ([header] if header else []) + rows
        trs = []
        for r, row in enumerate(all_rows):
            tcs = []
            for c, val in enumerate(row):
                is_head = header is not None and r == 0
                is_key = key_col and c == 0
                if title_style:
                    bf, pp, cp = 4, 3, (2 if r == 0 else 3)
                else:
                    bf = 5 if (is_head or is_key) else 3
                    pp = 10 if is_head else 8
                    cp = 7 if (is_head or is_key) else 6
                lines = str(val).split("\n")
                body = "".join(para(l, pp, cp) for l in lines)
                tcs.append(
                    f'<hp:tc name="" header="{1 if is_head else 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="{bf}">'
                    '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" '
                    'linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
                    f'{body}</hp:subList><hp:cellAddr colAddr="{c}" rowAddr="{r}"/><hp:cellSpan colSpan="1" rowSpan="1"/>'
                    f'<hp:cellSz width="{widths[c]}" height="{1600 if title_style else 900}"/>'
                    '<hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>')
            trs.append("<hp:tr>" + "".join(tcs) + "</hp:tr>")
        height = (1600 if title_style else 900) * len(all_rows)
        tbl = (f'<hp:tbl id="{self.tbl_id}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" '
               f'lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="{len(all_rows)}" colCnt="{ncol}" '
               f'cellSpacing="0" borderFillIDRef="3" noAdjust="0"><hp:sz width="{self.width}" widthRelTo="ABSOLUTE" '
               f'height="{height}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="0" affectLSpacing="0" '
               'flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" '
               'horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/>'
               '<hp:inMargin left="510" right="510" top="141" bottom="141"/>' + "".join(trs) + "</hp:tbl>")
        self.parts.append(f'<hp:p {P_ATTR} paraPrIDRef="6"><hp:run charPrIDRef="0">{tbl}<hp:t/></hp:run></hp:p>')


def build_output(path: Path, spec: dict, header_xml: str) -> None:
    entries = read_hwpx(TEMPLATES / path.name)
    sec = entries["Contents/section0.xml"][0].decode("utf-8")
    width = 59528 - 2 * int(re.search(r'<hp:margin [^>]*left="(\d+)"', sec).group(1))
    first_p_end = sec.index("</hp:p>") + len("</hp:p>")  # secPr 를 가진 첫 문단은 유지
    d = Doc(width)
    d.title_box()
    d.p("", 6)
    d.p(spec["title"], 1, 2)
    d.p("", 6)
    d.table(None, [[k, v] for k, v in spec["meta"]], [1.1, 4.9], key_col=True)
    for kind, *rest in spec["blocks"]:
        if kind == "h1":
            d.p(rest[0], 5, 4)
        elif kind == "h2":
            d.p(rest[0], 9, 5)
        elif kind == "p":
            d.p(rest[0], 6, 0)
        elif kind == "b":
            d.p("• " + rest[0], 7, 0)
        elif kind == "table":
            header, rows, weights = rest
            d.table(header, rows, weights)
            d.p("", 8, 8)
    d.p("", 6)
    d.p("작성자: 홍기흥 (1인 프로젝트 · Full-stack Developer)", 6, 8)
    new_sec = sec[:first_p_end] + "".join(d.parts) + "</hs:sec>"
    entries["Contents/section0.xml"] = (new_sec.encode("utf-8"), entries["Contents/section0.xml"][1])
    entries["Contents/header.xml"] = (header_xml.encode("utf-8"), entries["Contents/header.xml"][1])
    write_hwpx(path, entries)


# ------------------------------------------------------------------ 한글 COM: 정리 저장 + PDF
def hwp_finalize(pdf: bool) -> None:
    """한글 COM(PowerShell)으로 열어 HWPX 정리 저장 + PDF 변환 (Python COM 은 PDF 저장 중 멈춤 현상이 있어 분리)."""
    import subprocess
    ps1 = Path(__file__).resolve().parent / "hwp_to_pdf.ps1"
    res = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps1)]
                         + ([] if pdf else ["-NoPdf"]), capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(res.stdout.strip())
    if res.returncode:
        raise RuntimeError(res.stderr[-2000:])


def main() -> None:
    journals = sorted(DOCS.glob("프로젝트_진행일지_*.hwpx"))
    outputs = sorted(OUT_DIR.glob("*_산출물.hwpx"))
    template_header = read_hwpx(TEMPLATES / journals[0].name)["Contents/header.xml"][0].decode("utf-8")
    header_xml = extend_header(template_header)
    for f in journals:
        key = f.stem.replace("프로젝트_진행일지_", "")
        build_journal(f, JOURNAL[key])
        print("진행일지 작성:", f.name)
    for f in outputs:
        key = f.stem.replace("_산출물", "")
        build_output(f, OUTPUTS[key], header_xml)
        print("산출물 작성:", f.name)
    hwp_finalize(pdf="--no-pdf" not in sys.argv)


if __name__ == "__main__":
    main()
