"""
AtlasLM ingestion worker (Patch 003).

Standalone process consuming ingestion jobs from Redis and running the
DocumentPipeline outside the HTTP request path.

Run via:  python -m app.worker
Deployed as the 'worker' service in docker-compose (same image as backend).

Flow per job:
1. Pop job (meta + file bytes) from Redis.
2. Load the placeholder Document row (status='processing').
3. Run parse -> chunk -> embed -> persist chunks.
4. Mark document status='ready' (or 'failed' with a public error message).

Crash-safety: every job is wrapped; a failure marks the document
'failed' and the worker continues. The worker never fabricates data.
"""

import asyncio
import logging
import signal
import uuid

from .core.database import SessionLocal
from .core.providers import ProviderError
from .models import Document
from .services.jobs import pop_ingestion_job, redis_healthy
from .services.pipeline import DocumentPipeline

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s",
)
logger = logging.getLogger("atlaslm.worker")

_shutdown = False


def _handle_signal(signum, frame):
    global _shutdown
    logger.info("Received signal %s; finishing current job then exiting.", signum)
    _shutdown = True


async def process_job(job: dict) -> None:
    meta = job["meta"]
    file_bytes = job["file_bytes"]
    document_id = uuid.UUID(meta["document_id"])

    db = SessionLocal()
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if document is None:
            # Document was deleted while queued; drop the job silently.
            logger.info("Document %s no longer exists; skipping job %s.",
                        document_id, meta["job_id"])
            return

        pipeline = DocumentPipeline(db)
        try:
            await pipeline.run_ingestion_for_document(
                document=document,
                file_bytes=file_bytes,
                file_type=meta["file_type"],
            )
            document.status = "ready"
            document.error_message = None
            db.commit()
            logger.info("Job %s complete: document %s ready.",
                        meta["job_id"], document_id)
        except ProviderError as e:
            db.rollback()
            document = db.query(Document).filter(Document.id == document_id).first()
            if document:
                document.status = "failed"
                document.error_message = e.public_message
                db.commit()
            logger.error("Job %s failed (provider): %s", meta["job_id"], e.public_message)
        except ValueError as e:
            db.rollback()
            document = db.query(Document).filter(Document.id == document_id).first()
            if document:
                document.status = "failed"
                document.error_message = str(e)
                db.commit()
            logger.error("Job %s failed (parse/validation): %s", meta["job_id"], e)
        except Exception as e:
            db.rollback()
            document = db.query(Document).filter(Document.id == document_id).first()
            if document:
                document.status = "failed"
                document.error_message = (
                    "An unexpected error occurred while processing this document."
                )
                db.commit()
            logger.error("Job %s failed (unexpected): %s", meta["job_id"], e, exc_info=True)
    finally:
        db.close()


async def main() -> None:
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    if not redis_healthy():
        logger.warning("Redis not reachable at startup; will keep retrying.")

    logger.info("AtlasLM ingestion worker started.")
    while not _shutdown:
        try:
            job = await asyncio.to_thread(pop_ingestion_job, 5)
        except Exception as e:
            logger.error("Queue pop failure: %s; retrying in 5s.", e)
            await asyncio.sleep(5)
            continue

        if job is None:
            continue
        await process_job(job)

    logger.info("Worker shut down cleanly.")


if __name__ == "__main__":
    asyncio.run(main())
