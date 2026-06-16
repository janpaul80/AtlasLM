-- Patch 011 - Google Workspace connector
-- One encrypted connection per (workspace, provider). Refresh token is stored
-- as ciphertext only (envelope-encrypted by the app vault); never plaintext.
CREATE TABLE IF NOT EXISTS workspace_connections (
    id                 TEXT PRIMARY KEY,
    user_id            TEXT NOT NULL,
    workspace_id       TEXT NOT NULL,
    provider           TEXT NOT NULL DEFAULT 'google',
    account_email      TEXT,
    scope              TEXT,
    refresh_token_enc  TEXT NOT NULL,
    key_id             TEXT NOT NULL DEFAULT 'v1',
    access_token       TEXT,
    access_expires_at  DOUBLE PRECISION,
    status             TEXT NOT NULL DEFAULT 'connected',
    created_at         TIMESTAMPTZ DEFAULT now(),
    updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_wsconn_ws_provider
    ON workspace_connections (workspace_id, provider);
CREATE INDEX IF NOT EXISTS ix_wsconn_user ON workspace_connections (user_id);
