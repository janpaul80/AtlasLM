# backend/app/services/ingest/audio_loader.py
"""Audio loader -> timestamped transcript via offline faster-whisper.
Requires faster-whisper + ffmpeg installed in the container.
Model size is configurable via env ATLAS_WHISPER_MODEL (default 'base')."""
from __future__ import annotations
from typing import List
import os
from .base import ExtractedBlock, block

_MODEL = None


def _get_model():
    global _MODEL
    if _MODEL is None:
        from faster_whisper import WhisperModel
        size = os.getenv("ATLAS_WHISPER_MODEL", "base")
        device = os.getenv("ATLAS_WHISPER_DEVICE", "cpu")
        compute = os.getenv("ATLAS_WHISPER_COMPUTE", "int8")
        _MODEL = WhisperModel(size, device=device, compute_type=compute)
    return _MODEL


def transcribe_audio(path: str) -> List[ExtractedBlock]:
    model = _get_model()
    segments, _info = model.transcribe(path, beam_size=1)
    blocks: List[ExtractedBlock] = []
    for seg in segments:
        t = (seg.text or "").strip()
        if t:
            blocks.append(block(t, timestamp=seg.start))
    return blocks
