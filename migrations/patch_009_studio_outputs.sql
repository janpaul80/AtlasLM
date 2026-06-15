-- ============================================================
-- AtlasLM Patch 009 migration: Studio outputs.
-- Run after patch_007_synthesis_and_sources.sql. Idempotent.
-- Studio outputs are generated artifacts (mind map, study guide,
-- quiz, flashcards) produced from a workspace or a synthesis scope.
--
-- This script is production-ready and data-preserving. It will
-- create tables if they do not exist, or safely alter them if
-- they were already created in previous patches (e.g. Patch 005).
-- ============================================================

CREATE TABLE IF NOT EXISTS studio_outputs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    synthesis_node_id UUID REFERENCES synthesis_nodes(id) ON DELETE SET NULL,
    output_type       TEXT NOT NULL,
    title             TEXT NOT NULL DEFAULT 'Untitled',
    status            TEXT NOT NULL DEFAULT 'pending',
    content           JSONB,
    error             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safely alter the table if it already existed with the old schema (Patch 005)
DO $$
BEGIN
    -- Add synthesis_node_id if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_outputs' AND column_name='synthesis_node_id') THEN
        ALTER TABLE studio_outputs ADD COLUMN synthesis_node_id UUID REFERENCES synthesis_nodes(id) ON DELETE SET NULL;
    END IF;

    -- Rename error_message to error if error_message exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_outputs' AND column_name='error_message') THEN
        ALTER TABLE studio_outputs RENAME COLUMN error_message TO error;
    END IF;

    -- Add error column if it doesn't exist under either name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_outputs' AND column_name='error') THEN
        ALTER TABLE studio_outputs ADD COLUMN error TEXT;
    END IF;

    -- Add updated_at if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_outputs' AND column_name='updated_at') THEN
        ALTER TABLE studio_outputs ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;

    -- Convert content column to JSONB if it's text (and wrap old Markdown in JSON string format)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_outputs' AND column_name='content' AND data_type='text') THEN
        ALTER TABLE studio_outputs ALTER COLUMN content TYPE JSONB USING to_jsonb(content);
    END IF;

    -- Drop document_ids if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_outputs' AND column_name='document_ids') THEN
        ALTER TABLE studio_outputs DROP COLUMN document_ids;
    END IF;

    -- Drop citations if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_outputs' AND column_name='citations') THEN
        ALTER TABLE studio_outputs DROP COLUMN citations;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_studio_outputs_workspace
    ON studio_outputs (workspace_id, created_at DESC);

-- Citations backing each studio output, so generated artifacts stay grounded.
CREATE TABLE IF NOT EXISTS studio_output_citations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_output_id UUID NOT NULL REFERENCES studio_outputs(id) ON DELETE CASCADE,
    document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number      INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    -- Note: Old citations were stored in a JSON column and are now normalized
    -- in this table. New citations will populate this table automatically.
);

CREATE INDEX IF NOT EXISTS idx_studio_output_citations_output
    ON studio_output_citations (studio_output_id);
