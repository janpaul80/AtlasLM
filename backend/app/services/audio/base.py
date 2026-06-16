# backend/app/services/audio/base.py
"""Shared types + the TTS engine interface for Audio Overview.

The engine is pluggable: the default is on-device (free, unlimited), and a
cloud engine can be slotted in later WITHOUT touching script generation or the
mixing pipeline. Engines never surface provider/gateway names to the client
(branding rule) and never raise on a single failed line - they degrade so one
bad line never kills the whole overview.
"""
from __future__ import annotations
import abc
from dataclasses import dataclass, field, asdict
from typing import List, Optional


@dataclass
class ScriptLine:
    speaker: str                  # "A" | "B"  (host slot, not a provider)
    name: str                     # display name, e.g. "Maya"
    text: str                     # spoken text, ASCII punctuation only
    cite: Optional[int] = None    # 1-based source index this line is grounded in
    start: float = 0.0            # seconds into the track (filled at mix time)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class AudioOverview:
    overview_id: str
    title: str
    style: str                    # "deep_dive" | "brief"
    voice: str                    # engine id used
    duration: float               # seconds
    lines: List[ScriptLine] = field(default_factory=list)
    audio_path: Optional[str] = None   # server-side path to the rendered file

    def transcript(self) -> List[dict]:
        return [ln.to_dict() for ln in self.lines]


class TTSEngine(abc.ABC):
    """Pluggable text-to-speech backend.

    `voice_id` is a stable, user-facing handle (e.g. "atlas-offline"); it never
    leaks the underlying library or vendor. Implementations MUST be safe to call
    repeatedly and MUST return a path to a playable audio file.
    """

    voice_id: str = "engine"
    is_free: bool = True          # on-device default is free + unlimited

    @abc.abstractmethod
    def synthesize(self, lines: List[ScriptLine], out_path: str) -> float:
        """Render the lines to a single audio file at out_path.

        Returns the total duration in seconds and sets each line's `start`.
        """
        ...
