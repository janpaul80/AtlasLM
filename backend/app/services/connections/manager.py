# backend/app/services/connections/manager.py
"""Connection lifecycle on top of the vault + oauth client.

Owns: persisting an encrypted connection after consent, returning a FRESH access
token on demand (auto-refresh when expired), and disconnecting (revoke + purge).
Works with db=None for offline verification (everything except persistence runs).
"""
from __future__ import annotations
import time
import logging
from typing import Optional

from .oauth import GoogleOAuth, TokenSet
from .vault import TokenVault

log = logging.getLogger("connections.manager")


class ConnectionManager:
    def __init__(self, db=None) -> None:
        self.db = db
        self.oauth = GoogleOAuth()
        self.vault = TokenVault()

    # --- save after consent ----------------------------------------------
    def save(self, *, user_id: str, workspace_id: str, tokens: TokenSet) -> dict:
        if not tokens.refresh_token:
            raise ValueError("No long-term access was granted. Please reconnect.")
        enc = self.vault.encrypt(tokens.refresh_token)
        row = dict(
            user_id=user_id, workspace_id=workspace_id, provider="google",
            account_email=tokens.account_email, scope=tokens.scope,
            refresh_token_enc=enc, key_id=self.vault.key_id,
            access_token=tokens.access_token, access_expires_at=tokens.expires_at,
            status="connected",
        )
        if self.db is None:
            return row
        from app.models import WorkspaceConnection  # local import to avoid cycles
        existing = (self.db.query(WorkspaceConnection)
                    .filter_by(workspace_id=workspace_id, provider="google").first())
        if existing:
            for k, v in row.items():
                setattr(existing, k, v)
            conn = existing
        else:
            conn = WorkspaceConnection(**row)
            self.db.add(conn)
        self.db.commit()
        return {"id": conn.id, "account_email": conn.account_email, "status": conn.status}

    # --- fresh access token (auto-refresh) -------------------------------
    def access_token(self, *, workspace_id: str) -> str:
        if self.db is None:
            raise ValueError("No database session; cannot load stored connection.")
        from app.models import WorkspaceConnection
        conn = (self.db.query(WorkspaceConnection)
                .filter_by(workspace_id=workspace_id, provider="google").first())
        if not conn or conn.status != "connected":
            raise ValueError("Google is not connected for this workspace.")
        if conn.access_token and (conn.access_expires_at or 0) > time.time():
            return conn.access_token
        refresh = self.vault.decrypt(conn.refresh_token_enc)
        tok = self.oauth.refresh(refresh)
        conn.access_token = tok.access_token
        conn.access_expires_at = tok.expires_at
        if tok.refresh_token and tok.refresh_token != refresh:
            conn.refresh_token_enc = self.vault.encrypt(tok.refresh_token)
            conn.key_id = self.vault.key_id
        self.db.commit()
        return tok.access_token

    # --- disconnect: revoke at Google + purge locally --------------------
    def disconnect(self, *, workspace_id: str) -> dict:
        if self.db is None:
            return {"status": "disconnected"}
        from app.models import WorkspaceConnection
        conn = (self.db.query(WorkspaceConnection)
                .filter_by(workspace_id=workspace_id, provider="google").first())
        if not conn:
            return {"status": "disconnected"}
        try:
            self.oauth.revoke(self.vault.decrypt(conn.refresh_token_enc))
        except Exception as e:
            log.warning("revoke skipped: %s", e)
        self.db.delete(conn)      # purge ciphertext entirely
        self.db.commit()
        return {"status": "disconnected"}

    def status(self, *, workspace_id: str) -> dict:
        if self.db is None:
            return {"connected": False}
        from app.models import WorkspaceConnection
        conn = (self.db.query(WorkspaceConnection)
                .filter_by(workspace_id=workspace_id, provider="google").first())
        if not conn or conn.status != "connected":
            return {"connected": False}
        return {"connected": True, "account_email": conn.account_email, "scope": conn.scope}
