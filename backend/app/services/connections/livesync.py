# backend/app/services/connections/livesync.py
"""Live sync service: opt a source in/out, resolve a webhook ping, and re-ingest
a changed file using build-then-swap so a synced source is never empty mid-update.

Build-then-swap:
  1. download the new version of the file
  2. ingest it into a SHADOW source (not visible yet)
  3. atomically repoint the live source_id to the shadow content
  4. delete the old content
If any step fails, the live source keeps serving the previous version untouched.

Decoupled from project internals via callables supplied by the route:
  reingest(workspace_id, source_id, filename, ext, raw) -> int (block_count)
Works with db=None for offline verification.
"""
from __future__ import annotations
import time
import logging
from typing import Callable

from .watch import WatchManager
from .drive import DriveConnector

log = logging.getLogger("connections.livesync")


class LiveSyncService:
    def __init__(self, db=None) -> None:
        self.db = db

    def enable(self, *, workspace_id: str, source_id: str, file_id: str,
               access_token: str) -> dict:
        info = WatchManager(access_token).start(file_id)
        if self.db is None:
            return {"source_id": source_id, "live": True, **info}
        from app.models import DriveWatchChannel
        self._stop_existing(workspace_id=workspace_id, source_id=source_id,
                            access_token=access_token)
        row = DriveWatchChannel(
            workspace_id=workspace_id, source_id=source_id, file_id=file_id,
            channel_id=info["channel_id"], resource_id=info["resource_id"],
            channel_token=info["channel_token"], expiration=info["expiration"],
            status="active")
        self.db.add(row)
        self.db.commit()
        return {"source_id": source_id, "live": True, "expiration": info["expiration"]}

    def disable(self, *, workspace_id: str, source_id: str, access_token: str) -> dict:
        self._stop_existing(workspace_id=workspace_id, source_id=source_id,
                            access_token=access_token)
        return {"source_id": source_id, "live": False}

    def _stop_existing(self, *, workspace_id: str, source_id: str, access_token: str) -> None:
        if self.db is None:
            return
        from app.models import DriveWatchChannel
        wm = WatchManager(access_token)
        rows = (self.db.query(DriveWatchChannel)
                .filter_by(workspace_id=workspace_id, source_id=source_id).all())
        for row in rows:
            try:
                wm.stop(row.channel_id, row.resource_id)
            except Exception as e:
                log.warning("stop channel %s failed: %s", row.channel_id, e)
            self.db.delete(row)
        if rows:
            self.db.commit()

    def resolve_ping(self, *, channel_id: str, resource_id: str, token: str):
        if self.db is None:
            return None
        from app.models import DriveWatchChannel
        row = (self.db.query(DriveWatchChannel)
               .filter_by(channel_id=channel_id).first())
        if not row:
            log.info("ping for unknown channel %s ignored", channel_id)
            return None
        if row.resource_id != resource_id or row.channel_token != token:
            log.warning("ping channel/resource/token mismatch; ignored")
            return None
        return row

    def apply_change(self, row, *, access_token: str,
                     reingest: Callable[[str, str, str, str, bytes], int]) -> dict:
        conn = DriveConnector(access_token)
        meta = conn.metadata(row.file_id)
        raw, ext = conn.download(meta)
        blocks = reingest(row.workspace_id, row.source_id, meta.get("name", "file"), ext, raw)
        if self.db is not None:
            row.last_synced = time.time()
            self.db.commit()
        return {"source_id": row.source_id, "blocks": blocks, "name": meta.get("name")}

    def due_for_renewal(self, *, within_seconds: int = 12 * 3600):
        if self.db is None:
            return []
        from app.models import DriveWatchChannel
        cutoff = time.time() + within_seconds
        return (self.db.query(DriveWatchChannel)
                .filter(DriveWatchChannel.status == "active",
                        DriveWatchChannel.expiration <= cutoff).all())

    def renew(self, row, *, access_token: str) -> dict:
        wm = WatchManager(access_token)
        try:
            wm.stop(row.channel_id, row.resource_id)
        except Exception as e:
            log.info("pre-renew stop skipped: %s", e)
        info = wm.start(row.file_id)
        if self.db is not None:
            row.channel_id = info["channel_id"]
            row.resource_id = info["resource_id"]
            row.channel_token = info["channel_token"]
            row.expiration = info["expiration"]
            self.db.commit()
        return {"source_id": row.source_id, "expiration": info["expiration"]}
