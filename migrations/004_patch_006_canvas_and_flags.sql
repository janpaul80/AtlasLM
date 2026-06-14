-- Patch 006: workspace graph (canvas connections) + user onboarding flags

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id VARCHAR(255) PRIMARY KEY,
    tour_completed BOOLEAN NOT NULL DEFAULT FALSE,
    marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS workspace_graph (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    from_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    to_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT no_self_edge CHECK (from_document_id <> to_document_id),
    CONSTRAINT unique_edge UNIQUE (workspace_id, from_document_id, to_document_id)
);
CREATE INDEX IF NOT EXISTS idx_workspace_graph_ws ON workspace_graph(workspace_id);

-- Node positions so the canvas layout survives refresh
CREATE TABLE IF NOT EXISTS canvas_positions (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    x_pos REAL NOT NULL DEFAULT 0,
    y_pos REAL NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_canvas_positions_ws ON canvas_positions(workspace_id);

-- Onboarding flags
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE;
