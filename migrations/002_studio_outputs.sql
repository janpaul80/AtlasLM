-- Patch 005: AtlasLM Studio outputs table
CREATE TABLE IF NOT EXISTS studio_outputs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    output_type     VARCHAR(50)  NOT NULL,
    title           VARCHAR(255) NOT NULL,
    content         TEXT,
    citations       JSON,
    document_ids    JSON,
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_studio_outputs_workspace
    ON studio_outputs (workspace_id, created_at DESC);
