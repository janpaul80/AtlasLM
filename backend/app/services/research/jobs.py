# backend/app/services/research/jobs.py
"""Redis-backed job queue for Deep Research, mirroring Patch 005 Studio jobs.

Queue name: atlaslm:research:queue. Jobs are enqueued 'pending'; the worker
(app/services/worker.py extension or a dedicated loop) pops and runs search.
For SEARCH we run inline (fast) but persist job state so the UI can poll; for
heavy full-text INGEST we enqueue so the request returns immediately.
"""
from __future__ import annotations
import json
import os
import time
import uuid
from typing import Optional

import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUEUE = "atlaslm:research:queue"
JOB_PREFIX = "atlaslm:research:job:"
JOB_TTL = 60 * 60  # 1h

_r: Optional[redis.Redis] = None


def _client() -> redis.Redis:
    global _r
    if _r is None:
        _r = redis.from_url(REDIS_URL, decode_responses=True)
    return _r


def enqueue(kind: str, payload: dict) -> str:
    job_id = uuid.uuid4().hex
    rec = {"id": job_id, "kind": kind, "status": "pending",
           "payload": payload, "result": None, "created": time.time()}
    r = _client()
    r.set(JOB_PREFIX + job_id, json.dumps(rec), ex=JOB_TTL)
    r.lpush(QUEUE, job_id)
    return job_id


def get_job(job_id: str) -> Optional[dict]:
    raw = _client().get(JOB_PREFIX + job_id)
    return json.loads(raw) if raw else None


def set_status(job_id: str, status: str, result=None) -> None:
    r = _client()
    raw = r.get(JOB_PREFIX + job_id)
    if not raw:
        return
    rec = json.loads(raw)
    rec["status"] = status
    if result is not None:
        rec["result"] = result
    r.set(JOB_PREFIX + job_id, json.dumps(rec), ex=JOB_TTL)


def pop(timeout: int = 5) -> Optional[str]:
    res = _client().brpop(QUEUE, timeout=timeout)
    return res[1] if res else None
