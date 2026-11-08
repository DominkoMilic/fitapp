#!/usr/bin/env python3
"""Render docs/PACE_SPEC.md to docs/PACE_Specification.pdf.

Supports the Markdown subset used by the spec: headings (#..####), paragraphs,
bullet and numbered lists, pipe tables, fenced code blocks, horizontal rules,
**bold** and `inline code`.

Usage: python3 docs/tools/build_pdf.py
"""
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    Preformatted, PageBreak, KeepTogether, ListFlowable, ListItem, HRFlowable,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "PACE_SPEC.md"
OUT = ROOT / "PACE_Specification.pdf"

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
pdfmetrics.registerFont(TTFont("Sans", str(FONT_DIR / "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("Sans-Bold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))
pdfmetrics.registerFont(TTFont("Sans-Oblique", str(FONT_DIR / "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("Mono", str(FONT_DIR / "DejaVuSansMono.ttf")))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily("Sans", normal="Sans", bold="Sans-Bold", italic="Sans-Oblique", boldItalic="Sans-Bold")

ACCENT = colors.HexColor("#059669")
DARK = colors.HexColor("#121417")
MUTED = colors.HexColor("#5A6270")
RULE = colors.HexColor("#E1E4E8")
CODE_BG = colors.HexColor("#F3F4F6")
HEAD_BG = colors.HexColor("#1B1E23")

body = ParagraphStyle("body", fontName="Sans", fontSize=9, leading=12.6, textColor=DARK,
                      spaceAfter=4, alignment=TA_LEFT)
small = ParagraphStyle("small", parent=body, fontSize=7.6, leading=9.8, spaceAfter=0)
small_head = ParagraphStyle("smallhead", parent=small, fontName="Sans-Bold", textColor=colors.white)
h1 = ParagraphStyle("h1", fontName="Sans-Bold", fontSize=17, leading=21, textColor=DARK,
                    spaceBefore=4, spaceAfter=8)
h2 = ParagraphStyle("h2", fontName="Sans-Bold", fontSize=13.5, leading=17, textColor=ACCENT,
                    spaceBefore=10, spaceAfter=6)
h3 = ParagraphStyle("h3", fontName="Sans-Bold", fontSize=11, leading=14, textColor=DARK,
                    spaceBefore=8, spaceAfter=4)
h4 = ParagraphStyle("h4", fontName="Sans-Bold", fontSize=9.5, leading=12, textColor=DARK,
                    spaceBefore=6, spaceAfter=3)
code_style = ParagraphStyle("code", fontName="Mono", fontSize=7.3, leading=9.2, textColor=DARK)
toc_l0 = ParagraphStyle("toc0", fontName="Sans", fontSize=9.5, leading=13, leftIndent=0)
toc_l1 = ParagraphStyle("toc1", fontName="Sans", fontSize=8.3, leading=11, leftIndent=14, textColor=MUTED)


def inline(text: str) -> str:
    """Escape XML then apply **bold** and `code` markup."""
    parts = re.split(r"(`[^`]+`)", text)
    out = []
    for part in parts:
        if part.startswith("`") and part.endswith("`") and len(part) > 1:
            out.append('<font name="Mono" size="8" color="#0B5D46">' + escape(part[1:-1]) + "</font>")
        else:
            seg = escape(part)
            seg = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", seg)
            out.append(seg)
    return "".join(out)


class Doc(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(str(path), pagesize=A4, leftMargin=17 * mm, rightMargin=17 * mm,
                         topMargin=18 * mm, bottomMargin=18 * mm,
                         title="PACE — Final Product & Engineering Specification",
                         author="PACE", subject="Implementation brief v2.0")
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="f")
        self.addPageTemplates([
            PageTemplate(id="cover", frames=[frame], onPage=self._cover),
            PageTemplate(id="normal", frames=[frame], onPage=self._page),
        ])
        self._h = 0

    def _cover(self, c, d):
        pass

    def _page(self, c, d):
        c.saveState()
        c.setFont("Sans", 7.5)
        c.setFillColor(MUTED)
        c.drawString(self.leftMargin, 10 * mm, "PACE — Final Specification v2.0")
        c.drawRightString(A4[0] - self.rightMargin, 10 * mm, f"Page {d.page}")
        c.setStrokeColor(RULE)
        c.line(self.leftMargin, A4[1] - 12 * mm, A4[0] - self.rightMargin, A4[1] - 12 * mm)
        c.restoreState()

    def afterFlowable(self, f):
        if isinstance(f, Paragraph) and getattr(f, "_toc_level", None) is not None:
            key = f"h{f._toc_id}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(f.getPlainText(), key, level=f._toc_level, closed=f._toc_level > 0)
            self.notify("TOCEntry", (f._toc_level, f.getPlainText(), self.page, key))


def heading(text, style, level):
    p = Paragraph(inline(text), style)
    p._toc_level = level
    heading.n = getattr(heading, "n", 0) + 1
    p._toc_id = heading.n
    return p


def parse_table(lines):
    rows = []
    for ln in lines:
        cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        rows.append(cells)
    header, data = rows[0], [r for r in rows[2:]]
    return header, data


def build_table(header, data, width):
    ncol = len(header)
    # column widths proportional to content length (bounded)
    lens = [max([len(header[i])] + [len(r[i]) if i < len(r) else 0 for r in data]) for i in range(ncol)]
    lens = [min(max(l, 6), 70) for l in lens]
    total = sum(lens)
    widths = [width * l / total for l in lens]
    rows = [[Paragraph(inline(h), small_head) for h in header]]
    for r in data:
        r = r + [""] * (ncol - len(r))
        rows.append([Paragraph(inline(c), small) for c in r[:ncol]])
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F8FA")]),
        ("GRID", (0, 0), (-1, -1), 0.4, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    return t


def build_list(items, ordered):
    flow = []
    for text, sub in items:
        content = [Paragraph(inline(text), body)]
        if sub:
            content.append(build_list(sub, False))
        flow.append(ListItem(content, leftIndent=12))
    if ordered:
        return ListFlowable(flow, bulletType="1", bulletFontName="Sans", bulletFontSize=8.5,
                            leftIndent=14, bulletDedent=12)
    return ListFlowable(flow, bulletType="bullet", start="•", bulletFontName="Sans",
                        bulletFontSize=8, leftIndent=12, bulletColor=ACCENT)


def cover(story, width):
    story.append(Spacer(1, 55 * mm))
    story.append(Paragraph("PACE", ParagraphStyle("c0", fontName="Sans-Bold", fontSize=44, leading=50, textColor=ACCENT)))
    story.append(Paragraph("Personal Fitness &amp; Nutrition Platform",
                           ParagraphStyle("c1", fontName="Sans", fontSize=16, leading=22, textColor=DARK)))
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", color=RULE, thickness=1))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Final Product &amp; Engineering Specification — v2.0",
                           ParagraphStyle("c2", fontName="Sans-Bold", fontSize=13, leading=18, textColor=DARK)))
    story.append(Paragraph(
        "Reviewed and consolidated implementation brief for the coding agent: scope decisions, "
        "architecture, formulas with test vectors, injury-safety model, database schema and RLS, "
        "seed data, phased plan, acceptance criteria and a full edge-case catalogue.",
        ParagraphStyle("c3", parent=body, fontSize=10.5, leading=15, textColor=MUTED)))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "Audience: the coding agent and any developer building PACE. This document is the single "
        "source of truth; where it conflicts with the original PRD (v1), this document wins.",
        ParagraphStyle("c4", parent=body, fontSize=10, leading=14, textColor=MUTED)))
    story.append(Spacer(1, 24 * mm))
    meta = [["Platforms", "iOS and Android"],
            ["Stack", "React Native · Expo · TypeScript (strict) · Expo Router · Supabase"],
            ["Status", "Source of truth — implement phase by phase"],
            ["Date", "8 November 2026"]]
    t = Table([[Paragraph(f"<b>{a}</b>", body), Paragraph(b, body)] for a, b in meta],
              colWidths=[35 * mm, width - 35 * mm])
    t.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
                           ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    story.append(t)


def main():
    lines = SRC.read_text(encoding="utf-8").splitlines()
    doc = Doc(OUT)
    width = doc.width
    story = []
    cover(story, width)
    from reportlab.platypus import NextPageTemplate
    story.append(NextPageTemplate("normal"))
    story.append(PageBreak())
    story.append(Paragraph("Contents", h1))
    toc = TableOfContents()
    toc.levelStyles = [toc_l0, toc_l1]
    toc.dotsMinLevel = 0
    story.append(toc)
    story.append(PageBreak())

    i = 0
    seen_title = False
    while i < len(lines):
        ln = lines[i]
        s = ln.strip()
        if not s:
            i += 1
            continue
        if s.startswith("```"):
            j = i + 1
            buf = []
            while j < len(lines) and not lines[j].strip().startswith("```"):
                buf.append(lines[j])
                j += 1
            pre = Preformatted("\n".join(buf), code_style)
            t = Table([[pre]], colWidths=[width])
            t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
                                   ("BOX", (0, 0), (-1, -1), 0.4, RULE),
                                   ("LEFTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 5),
                                   ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
            story.append(t)
            story.append(Spacer(1, 5))
            i = j + 1
            continue
        if s == "---":
            i += 1
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            level, text = len(m.group(1)), m.group(2)
            if level == 1:
                if not seen_title:  # document title already on the cover
                    seen_title = True
                    i += 1
                    continue
                story.append(heading(text, h1, 0))
            elif level == 2:
                if story and not isinstance(story[-1], PageBreak) and re.match(r"^(\d+\.|Appendix)", text):
                    story.append(PageBreak())
                story.append(heading(text, h1, 0))
            elif level == 3:
                story.append(heading(text, h2, 1))
            else:
                story.append(Paragraph(inline(text), h4))
            i += 1
            continue
        if s.startswith("|"):
            j = i
            buf = []
            while j < len(lines) and lines[j].strip().startswith("|"):
                buf.append(lines[j])
                j += 1
            header, data = parse_table(buf)
            story.append(build_table(header, data, width))
            story.append(Spacer(1, 6))
            i = j
            continue
        if re.match(r"^(-|\d+\.)\s+", s):
            ordered = bool(re.match(r"^\d+\.", s))
            items = []
            j = i
            while j < len(lines):
                raw = lines[j]
                if not raw.strip():
                    # list continues only if next non-empty line is a list item of same type
                    k = j + 1
                    if k < len(lines) and re.match(r"^(-|\d+\.)\s+", lines[k].strip()) and not lines[k].startswith(" "):
                        j += 1
                        continue
                    break
                indent = len(raw) - len(raw.lstrip())
                mm_ = re.match(r"^(-|\d+\.)\s+(.*)$", raw.strip())
                if mm_ and indent >= 2 and items:
                    items[-1][1].append((mm_.group(2), []))
                elif mm_ and indent < 2:
                    if bool(re.match(r"^\d+\.", raw.strip())) != ordered:
                        break
                    items.append((mm_.group(2), []))
                elif items:
                    items[-1] = (items[-1][0] + " " + raw.strip(), items[-1][1])
                else:
                    break
                j += 1
            story.append(build_list(items, ordered))
            story.append(Spacer(1, 4))
            i = j
            continue
        if not any(getattr(f, "_toc_level", None) is not None for f in story):
            i += 1  # preamble lines before the first section are shown on the cover
            continue
        # paragraph: merge consecutive text lines
        buf = [s]
        j = i + 1
        while j < len(lines) and lines[j].strip() and not re.match(r"^(#|\||```|-\s|\d+\.\s|---)", lines[j].strip()):
            buf.append(lines[j].strip())
            j += 1
        story.append(Paragraph(inline(" ".join(buf)), body))
        i = j

    doc.multiBuild(story)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    sys.exit(main())
