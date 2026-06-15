-- ============================================================
-- AtlasLM Patch 007 migration: scoped synthesis nodes + source parsers
-- Run after patch_006_canvas_and_flags.sql.
-- Idempotent: safe to re-run.
-- ============================================================

-- A synthesis node is a virtual node on the canvas that is NOT a document.
-- Sources are wired INTO it; chat run from the node retrieves only from the
-- documents that are wired in (its inbound subgraph).
CREATE TABLE IF NOT EXISTS synthesis_nodes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title        TEXT NOT NULL DEFAULT 'Synthesis',
    x_pos        DOUBLE PRECISION NOT NULL DEFAULT 0,
    y_pos        DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_synthesis_nodes_workspace
    ON synthesis_nodes (workspace_id);

-- Which documents are wired into a synthesis node. This is the retrieval scope.
CREATE TABLE IF NOT EXISTS synthesis_inputs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    synthesis_node_id  UUID NOT NULL REFERENCES synthesis_nodes(id) ON DELETE CASCADE,
    document_id        UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_synthesis_input UNIQUE (synthesis_node_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_synthesis_inputs_node
    ON synthesis_inputs (synthesis_node_id);

-- No schema change is needed for documents.file_type. It is a free string.
-- Valid values after this patch:
--   'pdf','txt','md','url','youtube','docx','csv','xlsx','pptx'
