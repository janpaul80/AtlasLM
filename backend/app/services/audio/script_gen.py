# backend/app/services/audio/script_gen.py
"""Turn the workspace's selected sources into a two-host (or single-host)
conversation script, grounded in retrieved chunks and citation-tagged.

Reuses the SAME retrieval + generation path the rest of Studio uses (Patch 002
/ 009), so audio overviews are as source-grounded as reports. We only own the
PROMPTING and the parse-into-ScriptLine step here; we never call a model
provider directly (that stays behind the existing generation client, which is
where the branding/no-leak rules already live).

House style: all spoken text is ASCII punctuation only (no em/en dashes, no
ellipses) so the transcript passes the T10 lint when exported.
"""
from __future__ import annotations
import re
from typing import List

from .base import ScriptLine

HOST_A = "Maya"
HOST_B = "Theo"

_DEEP_DIVE_BRIEF = (
    "You are scripting a short two-host audio overview. Host A ({a}) is warm and "
    "drives the narrative; Host B ({b}) is the skeptic who asks the sharp "
    "questions. Use ONLY the provided source chunks. After every factual claim, "
    "tag the source it came from as [S<n>] using the chunk's index. Keep it "
    "conversational and about 60 to 90 seconds. Use plain ASCII punctuation only: "
    "no em dashes, no en dashes, no ellipses."
)
_BRIEF_BRIEF = (
    "You are scripting a single-host, 60-second spoken summary delivered by {a}. "
    "Use ONLY the provided source chunks and tag each claim as [S<n>]. Plain "
    "ASCII punctuation only: no em dashes, no en dashes, no ellipses."
)

_LINE_RE = re.compile(r"^\s*(MAYA|THEO|A|B)\s*[:\-]\s*(.+)$", re.IGNORECASE)
_CITE_RE = re.compile(r"\[S(\d+)\]")


def build_prompt(style: str) -> str:
    tmpl = _BRIEF_BRIEF if style == "brief" else _DEEP_DIVE_BRIEF
    return tmpl.format(a=HOST_A, b=HOST_B)


def parse_script(raw: str, style: str) -> List[ScriptLine]:
    """Parse the model's transcript into ScriptLine objects.

    Accepts 'Maya: ...' / 'Theo: ...' (deep dive) or plain paragraphs (brief).
    Strips the [S<n>] tags out of the spoken text and records them as `cite`.
    """
    lines: List[ScriptLine] = []
    for raw_line in raw.splitlines():
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        m = _LINE_RE.match(raw_line)
        if m:
            who = m.group(1).upper()
            slot = "B" if who in ("THEO", "B") else "A"
            text = m.group(2).strip()
        else:
            slot = "A"
            text = raw_line
        cite = None
        cm = _CITE_RE.search(text)
        if cm:
            cite = int(cm.group(1))
        text = _CITE_RE.sub("", text).strip()
        text = re.sub(r"\s{2,}", " ", text)
        if not text:
            continue
        name = HOST_A if slot == "A" else HOST_B
        if style == "brief":
            slot, name = "A", HOST_A
        lines.append(ScriptLine(speaker=slot, name=name, text=text, cite=cite))
    return lines
