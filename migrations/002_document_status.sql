-- AtlasLM Patch 003: async ingestion status tracking
-- Run against the atlaslm database BEFORE deploying the new backend/worker.

BEGIN;

-- 1. Status lifecycle: processing -> ready | failed
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ready';

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS error_message TEXT NULL;

-- 2. All pre-existing documents were ingested synchronously and are complete.
UPDATE documents SET status = 'ready' WHERE status IS NULL OR status = '';

-- 3. Helpful index for the polling endpoint.
CREATE INDEX IF NOT EXISTS idx_documents_workspace_status
    ON documents (workspace_id, status);

COMMIT;

-- Diagnostics (run manually if needed):
-- Documents stuck in processing for > 1 hour (likely from a crashed worker):
-- SELECT id, filename, created_at FROM documents
--   WHERE status = 'processing' AND created_at < NOW() - INTERVAL '1 hour';
