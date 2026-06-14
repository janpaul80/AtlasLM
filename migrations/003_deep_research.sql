-- migrations/003_deep_research.sql
-- Patch 004 Deep Research. Sources are stored in the EXISTING documents table
-- via ingest_extracted_blocks, so no new chunk columns are required. We only
-- add lightweight provenance so the UI can badge "Deep Research" sources and
-- citationLabel can show the origin URL.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS origin       TEXT,          -- 'deep_research' | NULL
  ADD COLUMN IF NOT EXISTS source_label TEXT,          -- 'Web' | 'arXiv' | 'Crossref'
  ADD COLUMN IF NOT EXISTS external_url TEXT,          -- original link
  ADD COLUMN IF NOT EXISTS research_query TEXT;        -- query that produced it

CREATE INDEX IF NOT EXISTS idx_documents_origin ON documents (origin);
