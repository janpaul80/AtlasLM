-- Patch 012 - Live Sync (Drive watch channels)
CREATE TABLE IF NOT EXISTS drive_watch_channels (
    id            TEXT PRIMARY KEY,
    workspace_id  TEXT NOT NULL,
    source_id     TEXT NOT NULL,
    file_id       TEXT NOT NULL,
    channel_id    TEXT NOT NULL,
    resource_id   TEXT NOT NULL,
    channel_token TEXT NOT NULL,
    expiration    DOUBLE PRECISION,
    last_synced   DOUBLE PRECISION,
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_watch_channel ON drive_watch_channels (channel_id);
CREATE INDEX IF NOT EXISTS ix_watch_ws     ON drive_watch_channels (workspace_id);
CREATE INDEX IF NOT EXISTS ix_watch_source ON drive_watch_channels (source_id);
CREATE INDEX IF NOT EXISTS ix_watch_exp    ON drive_watch_channels (status, expiration);
