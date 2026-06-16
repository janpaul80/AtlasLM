-- Patch 013 - Teams / Shared Workspaces
-- Members and pending invites for multi-user workspaces.

CREATE TABLE IF NOT EXISTS workspace_members (
    id            TEXT PRIMARY KEY,
    workspace_id  TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'viewer',  -- owner | editor | viewer
    added_by      TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_member_ws_user ON workspace_members (workspace_id, user_id);
CREATE INDEX IF NOT EXISTS ix_member_ws   ON workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS ix_member_user ON workspace_members (user_id);

CREATE TABLE IF NOT EXISTS workspace_invites (
    id            TEXT PRIMARY KEY,
    workspace_id  TEXT NOT NULL,
    email         TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'viewer',  -- editor | viewer (never owner)
    token_hash    TEXT NOT NULL,                   -- sha256 of the claim token
    invited_by    TEXT,
    status        TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | revoked | expired
    expires_at    DOUBLE PRECISION,
    created_at    TIMESTAMPTZ DEFAULT now(),
    accepted_at   DOUBLE PRECISION
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_invite_token ON workspace_invites (token_hash);
CREATE INDEX IF NOT EXISTS ix_invite_ws_email ON workspace_invites (workspace_id, email);
CREATE INDEX IF NOT EXISTS ix_invite_status   ON workspace_invites (status, expires_at);

-- Backfill: every existing workspace owner becomes an owner member.
-- DEV TEAM: adjust the source table/column names to match your schema.
-- INSERT INTO workspace_members (id, workspace_id, user_id, role)
--   SELECT 'mem_' || substr(md5(random()::text), 1, 16), id, owner_id, 'owner'
--   FROM workspaces
--   ON CONFLICT (workspace_id, user_id) DO NOTHING;
