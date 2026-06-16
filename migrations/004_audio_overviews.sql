-- Patch 010 - Studio Finish: Audio Overview storage + public sharing
-- Independent of Patch 009 (studio_outputs) and Patch 004 (documents columns).
-- Safe to run after 003. Idempotent guards included.

CREATE TABLE IF NOT EXISTS audio_overviews (
    id            VARCHAR PRIMARY KEY,
    workspace_id  VARCHAR NOT NULL,
    title         VARCHAR NOT NULL,
    style         VARCHAR NOT NULL DEFAULT 'deep_dive',
    voice         VARCHAR NOT NULL DEFAULT 'atlas-offline',
    duration      DOUBLE PRECISION NOT NULL DEFAULT 0,
    audio_path    VARCHAR,
    transcript    JSONB NOT NULL DEFAULT '[]'::jsonb,
    share_token   VARCHAR UNIQUE,
    is_public     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_audio_overviews_workspace
    ON audio_overviews (workspace_id);
CREATE INDEX IF NOT EXISTS ix_audio_overviews_share_token
    ON audio_overviews (share_token);
