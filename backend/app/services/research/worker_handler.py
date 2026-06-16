# backend/app/services/research/worker_handler.py
"""Worker loop for the Deep Research ingest queue.

Run alongside the Patch 005 Studio worker. Either:
  (A) add `handle_research_queue()` as a thread in your existing worker.py, or
  (B) run as its own process:  python -m app.services.research.worker_handler
"""
from __future__ import annotations
import json
import logging

# Resilient session import - works whether your factory lives in app.db,
# app.database, or app.core.db (Patch 009 may differ - falls back gracefully).
try:
    from app.core.database import SessionLocal
except Exception:  # noqa: BLE001
    try:
        from app.db import SessionLocal
    except Exception:  # noqa: BLE001
        try:
            from app.database import SessionLocal
        except Exception:  # noqa: BLE001
            from app.core.db import SessionLocal
from . import jobs as research_jobs
from .service import DeepResearchService

log = logging.getLogger("atlas.research.worker")
_svc = DeepResearchService()


def _process(job_id: str) -> None:
    job = research_jobs.get_job(job_id)
    if not job:
        return
    if job.get("kind") != "ingest":
        return  # search jobs already completed inline
    research_jobs.set_status(job_id, "running")
    payload = job["payload"]
    db = SessionLocal()
    try:
        created = _svc.ingest(
            db,
            payload["workspace_id"],
            payload["query"],
            payload["results"],
            fetch_full_text=payload.get("fetch_full_text", True),
        )
        db.commit()
        research_jobs.set_status(job_id, "done", {"sources": created})
        log.info("research ingest done: %s sources", len(created))
    except Exception as e:                           # noqa: BLE001
        db.rollback()
        log.exception("research ingest failed")
        research_jobs.set_status(job_id, "error", {"error": "ingest failed"})
    finally:
        db.close()


def handle_research_queue(poll_timeout: int = 5) -> None:
    log.info("Deep Research worker listening on %s", research_jobs.QUEUE)
    while True:
        job_id = research_jobs.pop(timeout=poll_timeout)
        if job_id:
            _process(job_id)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    handle_research_queue()
