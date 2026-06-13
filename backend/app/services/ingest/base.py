# backend/app/services/ingest/base.py
"""
Shared contract for all AtlasLM source loaders.
Every loader returns a list of ExtractedChunk dicts that feed the EXISTING
chunk -> embed -> pgvector pipeline unchanged. New optional field: timestamp
(seconds) for time-based sources (audio / youtube).
"""
from __future__ import annotations
from typing import List, TypedDict, Optional


class ExtractedBlock(TypedDict, total=False):
    text: str
    page: Optional[int]        # for paged docs (pdf, docx, pptx)
    sheet: Optional[str]       # for spreadsheets
    timestamp: Optional[float] # seconds, for audio / youtube
    char_offset: Optional[int]


def block(text: str, *, page=None, sheet=None, timestamp=None, char_offset=None) -> ExtractedBlock:
    b: ExtractedBlock = {"text": text.strip()}
    if page is not None: b["page"] = page
    if sheet is not None: b["sheet"] = sheet
    if timestamp is not None: b["timestamp"] = round(float(timestamp), 2)
    if char_offset is not None: b["char_offset"] = char_offset
    return b
