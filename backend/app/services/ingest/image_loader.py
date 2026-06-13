# backend/app/services/ingest/image_loader.py
"""Image OCR loader -> extracted text. Requires pytesseract + Pillow,
and the system package 'tesseract-ocr' installed in the container."""
from __future__ import annotations
from typing import List
from PIL import Image
import pytesseract
from .base import ExtractedBlock, block


def load_image(path: str) -> List[ExtractedBlock]:
    img = Image.open(path)
    text = pytesseract.image_to_string(img) or ""
    text = text.strip()
    if not text:
        return []
    # split into paragraph-ish blocks for cleaner chunking
    blocks: List[ExtractedBlock] = []
    offset = 0
    for para in [p for p in text.split("\n\n") if p.strip()]:
        blocks.append(block(para.strip(), char_offset=offset))
        offset += len(para)
    return blocks or [block(text)]
