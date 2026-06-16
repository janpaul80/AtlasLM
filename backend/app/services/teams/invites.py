"""Patch 013 - invite lifecycle (sign-in-then-claim flow).

Why sign-in-then-claim instead of a magic link that grants access directly:
seats map to billing, so access must be tied to a real authenticated account,
not to whoever forwards a link. The flow is:

  1. An owner or editor creates an invite for an email + role.
     We generate a random token, email a claim link, and store only the
     SHA-256 hash of the token (never the raw token).
  2. The recipient clicks the link, signs in (or signs up) with that email,
     then the app calls accept() with the raw token.
  3. accept() verifies the token hash, checks the signed-in email matches the
     invite, checks expiry, and creates the membership.

Invite rules:
  - Only editor or viewer can be invited (owner is assigned, never invited).
  - Editors may invite viewers only. Owners may invite editors or viewers.
  - Re-inviting an existing member or a pending email is rejected.
"""
from __future__ import annotations

import hashlib
import secrets
import time
from typing import List, Optional

from .roles import Role, can, require


DEFAULT_TTL_SECONDS = 7 * 24 * 3600  # invites expire after 7 days


class InviteError(Exception):
    pass


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _norm(email: str) -> str:
    return (email or "").strip().lower()


class InviteService:
    def __init__(self, db, ttl_seconds: int = DEFAULT_TTL_SECONDS):
        self.db = db
        self.ttl = ttl_seconds

    # --- create ----------------------------------------------------------
    def create(self, actor_role: str, workspace_id: str, email: str,
               role: str, invited_by: str) -> dict:
        from app.models import WorkspaceInvite, WorkspaceMember

        email = _norm(email)
        if "@" not in email or "." not in email.split("@")[-1]:
            raise InviteError("Enter a valid email address.")
        if role not in Role.INVITABLE:
            raise InviteError("Invites can only grant editor or viewer access.")

        # Permission: editors may invite viewers only; owners may invite both.
        require(actor_role, "member.invite")
        if role == Role.EDITOR and not can(actor_role, "member.manage"):
            raise InviteError("Only an owner can invite editors.")

        # Already a member? (look up by user email is app specific; we match on
        # any pending invite for the same email here and let accept() de-dupe
        # against membership at claim time.)
        dup = (
            self.db.query(WorkspaceInvite)
            .filter_by(workspace_id=workspace_id, email=email, status="pending")
            .one_or_none()
        )
        if dup:
            raise InviteError("That person already has a pending invite.")

        token = secrets.token_urlsafe(32)
        inv = WorkspaceInvite(
            workspace_id=workspace_id,
            email=email,
            role=role,
            token_hash=_hash(token),
            invited_by=invited_by,
            status="pending",
            expires_at=time.time() + self.ttl,
        )
        self.db.add(inv)
        self.db.commit()
        # Return the raw token ONCE so the caller can build the email link.
        # It is never persisted in raw form.
        return {"id": inv.id, "email": email, "role": role, "token": token,
                "expires_at": inv.expires_at}

    # --- read ------------------------------------------------------------
    def pending(self, workspace_id: str) -> List[dict]:
        from app.models import WorkspaceInvite
        rows = (
            self.db.query(WorkspaceInvite)
            .filter_by(workspace_id=workspace_id, status="pending")
            .all()
        )
        now = time.time()
        out = []
        for r in rows:
            if r.expires_at and r.expires_at < now:
                continue  # hide expired; the sweep marks them later
            out.append({"id": r.id, "email": r.email, "role": r.role,
                        "expires_at": r.expires_at})
        return out

    # --- mutate ----------------------------------------------------------
    def revoke(self, actor_role: str, invite_id: str) -> bool:
        from app.models import WorkspaceInvite
        require(actor_role, "member.invite")
        inv = self.db.query(WorkspaceInvite).filter_by(id=invite_id).one_or_none()
        if not inv or inv.status != "pending":
            return False
        inv.status = "revoked"
        self.db.commit()
        return True

    def accept(self, token: str, signed_in_email: str, user_id: str) -> dict:
        """Claim an invite. The caller must have authenticated the user first."""
        from app.models import WorkspaceInvite
        from .members import TeamService

        inv = (
            self.db.query(WorkspaceInvite)
            .filter_by(token_hash=_hash(token))
            .one_or_none()
        )
        if not inv:
            raise InviteError("This invite link is not valid.")
        if inv.status != "pending":
            raise InviteError("This invite has already been used or revoked.")
        if inv.expires_at and inv.expires_at < time.time():
            inv.status = "expired"
            self.db.commit()
            raise InviteError("This invite has expired. Ask for a new one.")
        if _norm(signed_in_email) != inv.email:
            raise InviteError("Sign in with the email the invite was sent to.")

        member = TeamService(self.db).add(
            inv.workspace_id, user_id, inv.role, added_by=inv.invited_by
        )
        inv.status = "accepted"
        inv.accepted_at = time.time()
        self.db.commit()
        return {"workspace_id": inv.workspace_id, "role": inv.role, "member": member}

    def expire_due(self) -> int:
        """Mark expired pending invites. Safe to call from a periodic sweep."""
        from app.models import WorkspaceInvite
        now = time.time()
        rows = (
            self.db.query(WorkspaceInvite)
            .filter(WorkspaceInvite.status == "pending")
            .all()
        )
        n = 0
        for r in rows:
            if r.expires_at and r.expires_at < now:
                r.status = "expired"
                n += 1
        if n:
            self.db.commit()
        return n
