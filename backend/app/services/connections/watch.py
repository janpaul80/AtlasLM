# backend/app/services/connections/watch.py
"""Drive watch-channel lifecycle for live sync (push).

Registers a watch on a single Drive file (files.watch), stores the channel so the
renewal worker can refresh it before Drive expires it (file watches last up to
~24h), and stops a channel (channels.stop) on opt-out or disconnect.

The webhook ping from Google is contentless, so the stored row carries the
mapping we need: channel_id + resource_id -> file_id -> source_id.

All network calls are defensive: failures raise a clean ValueError the caller
can handle, never a raw stack. Works with db=None for offline verify.
"""
from __future__ import annotations
import os
import time
import uuid
import secrets
import logging

import httpx

log = logging.getLogger("connections.watch")

FILES_API = "https://www.googleapis.com/drive/v3/files"
CHANNELS_STOP = "https://www.googleapis.com/drive/v3/channels/stop"
HTTP_TIMEOUT = float(os.getenv("ATLAS_CONN_HTTP_TIMEOUT", "30"))

WEBHOOK_URL = os.getenv("ATLAS_DRIVE_WEBHOOK_URL", "")
WATCH_TTL_SECONDS = int(os.getenv("ATLAS_WATCH_TTL_SECONDS", str(23 * 3600)))


def _new_token() -> str:
    return secrets.token_urlsafe(24)


class WatchManager:
    def __init__(self, access_token: str) -> None:
        self._h = {"Authorization": f"Bearer {access_token}",
                   "Content-Type": "application/json"}

    def start(self, file_id: str) -> dict:
        if not WEBHOOK_URL:
            raise ValueError("Live sync webhook URL is not configured on this server.")
        channel_id = "atlas-" + uuid.uuid4().hex
        token = _new_token()
        expiration_ms = int((time.time() + WATCH_TTL_SECONDS) * 1000)
        body = {"id": channel_id, "type": "web_hook", "address": WEBHOOK_URL,
                "token": token, "expiration": expiration_ms}
        try:
            with httpx.Client(timeout=HTTP_TIMEOUT) as c:
                r = c.post(f"{FILES_API}/{file_id}/watch",
                           params={"supportsAllDrives": "true"},
                           headers=self._h, json=body)
        except Exception as e:
            raise ValueError("Could not reach Drive to start live sync.") from e
        if r.status_code not in (200, 201):
            log.warning("files.watch %s: %s", r.status_code, r.text[:200])
            raise ValueError("Drive declined the live-sync request.")
        j = r.json()
        return {"channel_id": channel_id, "resource_id": j.get("resourceId"),
                "channel_token": token,
                "expiration": float(j.get("expiration", expiration_ms)) / 1000.0}

    def stop(self, channel_id: str, resource_id: str) -> bool:
        try:
            with httpx.Client(timeout=HTTP_TIMEOUT) as c:
                r = c.post(CHANNELS_STOP, headers=self._h,
                           json={"id": channel_id, "resourceId": resource_id})
            return r.status_code in (200, 204, 404)
        except Exception as e:
            log.warning("channels.stop failed: %s", e)
            return False
