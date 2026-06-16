# backend/app/services/connections/renewal_worker.py
"""Renewal sweep for Drive watch channels.

Drive file watches expire (max ~24h), so without renewal live sync silently dies
after a day. This sweep runs every 6h and re-registers any channel expiring within
the next 12h.

Run as a thread alongside the existing worker (recommended) or standalone:
    python -m app.services.connections.renewal_worker
"""
from __future__ import annotations
import os
import time
import logging

log = logging.getLogger("connections.renewal")

SWEEP_SECONDS = int(os.getenv("ATLAS_WATCH_SWEEP_SECONDS", str(6 * 3600)))
RENEW_WITHIN = int(os.getenv("ATLAS_WATCH_RENEW_WITHIN", str(12 * 3600)))


def run_once() -> int:
    try:
        from app.core.database import SessionLocal
    except Exception:
        log.warning("no SessionLocal; renewal sweep skipped")
        return 0
    from .livesync import LiveSyncService
    from .manager import ConnectionManager

    renewed = 0
    db = SessionLocal()
    try:
        svc = LiveSyncService(db)
        mgr = ConnectionManager(db)
        due = svc.due_for_renewal(within_seconds=RENEW_WITHIN)
        token_cache: dict = {}
        for row in due:
            try:
                ws = row.workspace_id
                if ws not in token_cache:
                    token_cache[ws] = mgr.access_token(workspace_id=ws)
                svc.renew(row, access_token=token_cache[ws])
                renewed += 1
            except Exception as e:
                log.warning("renew failed for source %s: %s", row.source_id, e)
        if renewed:
            log.info("renewed %d watch channel(s)", renewed)
    finally:
        db.close()
    return renewed


def run_forever() -> None:
    log.info("watch renewal sweep started (every %ds, renew within %ds)",
             SWEEP_SECONDS, RENEW_WITHIN)
    while True:
        try:
            run_once()
        except Exception as e:
            log.warning("renewal sweep error: %s", e)
        time.sleep(SWEEP_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_forever()
