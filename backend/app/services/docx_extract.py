"""AtlasLM Patch 007: DOCX extraction service.

Converts a .docx file into AtlasLM markdown-style sections so the existing
markdown chunking path handles it (same approach as the YouTube transcript in
Patch 006). Headings become section boundaries; tables become pipe tables.

No external network. Uses python-docx (already in requirements).
"""
from __future__ import annotations
import io
from docx import Document as _Docx


class DocxExtractError(Exception):
    """User-facing, message is safe to show in the UI. No tracebacks leak."""


def extract_docx_markdown(file_bytes: bytes) -> str:
    try:
        doc = _Docx(io.BytesIO(file_bytes))
    except Exception:
        raise DocxExtractError(
            "AtlasLM could not read this Word file. It may be corrupted or "
            "password protected. Re-save it as .docx and try again."
        )

    lines: list[str] = []

    def heading_level(style_name: str) -> int:
        # 'Heading 1' -> 1, 'Title' -> 1, body -> 0
        s = (style_name or "").lower()
        if s.startswith("heading"):
            digits = "".join(c for c in s if c.isdigit())
            return min(int(digits), 6) if digits else 2
        if s == "title":
            return 1
        return 0

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        lvl = heading_level(para.style.name if para.style else "")
        if lvl:
            lines.append("\n" + "#" * lvl + " " + text)
        else:
            lines.append(text)

    # Tables -> markdown pipe tables so they chunk with structure intact.
    for table in doc.tables:
        rows = [[c.text.strip().replace("\n", " ") for c in r.cells]
                for r in table.rows]
        if not rows:
            continue
        lines.append("")
        header = rows[0]
        lines.append("| " + " | ".join(header) + " |")
        lines.append("| " + " | ".join("---" for _ in header) + " |")
        for r in rows[1:]:
            lines.append("| " + " | ".join(r) + " |")

    md = "\n".join(lines).strip()
    if not md:
        raise DocxExtractError(
            "This Word file has no readable text. It may contain only images."
        )
    return md
