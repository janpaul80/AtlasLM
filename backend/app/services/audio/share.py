# backend/app/services/audio/share.py
"""Public share links for Audio Overviews - the growth loop.

A share token turns one overview into a read-only public listen page. Listeners
get the player + transcript and a "Made with AtlasLM" credit that links back;
they never see the workspace, the sources, or any other overview.

Security model:
  - opaque, unguessable token (secrets.token_urlsafe)
  - public access is gated on is_public AND a matching token
  - public payload is a strict allow-list (title, duration, transcript, audio
    url). It NEVER includes workspace_id, doc ids, or internal paths.
Revoking is just flipping is_public off; the token can be rotated.
"""
from __future__ import annotations
import secrets
from typing import Optional


def new_token() -> str:
    return secrets.token_urlsafe(9)  # ~12 chars, e.g. q2-strategy-x7k2 style


def enable(db, overview_id: str) -> Optional[str]:
    from app.models import AudioOverviewRow
    row = db.get(AudioOverviewRow, overview_id)
    if not row:
        return None
    if not row.share_token:
        row.share_token = new_token()
    row.is_public = True
    db.add(row)
    db.flush()
    return row.share_token


def disable(db, overview_id: str) -> None:
    from app.models import AudioOverviewRow
    row = db.get(AudioOverviewRow, overview_id)
    if row:
        row.is_public = False
        db.add(row)
        db.flush()


def get_public(db, token: str) -> Optional[dict]:
    """Resolve a token to the STRICT public payload, or None."""
    from app.models import AudioOverviewRow
    row = (
        db.query(AudioOverviewRow)
        .filter(AudioOverviewRow.share_token == token,
                AudioOverviewRow.is_public.is_(True))
        .first()
    )
    if not row:
        return None
    # allow-list only - no workspace, no source ids, no file path
    return {
        "title": row.title,
        "duration": row.duration,
        "style": row.style,
        "transcript": row.transcript,
        "audio_url": f"/api/v1/public/audio/{token}/stream",
        "credit": "Made with AtlasLM",
    }
