"""Patch 013 - membership lifecycle for shared workspaces.

DB-backed. Mirrors the 011/012 service style: a thin class that takes a
SQLAlchemy session and exposes intent methods. All permission decisions go
through teams.roles so the rules live in one place.
"""
from __future__ import annotations

from typing import List, Optional

from .roles import Role, ROLE_RANK, require


class TeamService:
    def __init__(self, db):
        self.db = db

    # --- reads -----------------------------------------------------------
    def role_of(self, workspace_id: str, user_id: str) -> Optional[str]:
        from app.models import WorkspaceMember
        m = (
            self.db.query(WorkspaceMember)
            .filter_by(workspace_id=workspace_id, user_id=user_id)
            .one_or_none()
        )
        return m.role if m else None

    def members(self, workspace_id: str) -> List[dict]:
        from app.models import WorkspaceMember
        rows = (
            self.db.query(WorkspaceMember)
            .filter_by(workspace_id=workspace_id)
            .all()
        )
        rows.sort(key=lambda r: (-ROLE_RANK.get(r.role, 0), r.created_at or 0))
        return [
            {"id": r.id, "user_id": r.user_id, "role": r.role, "added_by": r.added_by}
            for r in rows
        ]

    def owner_count(self, workspace_id: str) -> int:
        from app.models import WorkspaceMember
        return (
            self.db.query(WorkspaceMember)
            .filter_by(workspace_id=workspace_id, role=Role.OWNER)
            .count()
        )

    # --- writes ----------------------------------------------------------
    def add(self, workspace_id: str, user_id: str, role: str, added_by: str) -> dict:
        from app.models import WorkspaceMember
        if role not in Role.ALL:
            raise ValueError("Unknown role: %s" % role)
        existing = (
            self.db.query(WorkspaceMember)
            .filter_by(workspace_id=workspace_id, user_id=user_id)
            .one_or_none()
        )
        if existing:
            return {"id": existing.id, "user_id": user_id, "role": existing.role}
        m = WorkspaceMember(
            workspace_id=workspace_id, user_id=user_id, role=role, added_by=added_by
        )
        self.db.add(m)
        self.db.commit()
        return {"id": m.id, "user_id": user_id, "role": role}

    def change_role(self, actor_role: str, workspace_id: str, user_id: str, new_role: str) -> None:
        from app.models import WorkspaceMember
        require(actor_role, "member.manage")
        if new_role not in Role.ALL:
            raise ValueError("Unknown role: %s" % new_role)
        m = (
            self.db.query(WorkspaceMember)
            .filter_by(workspace_id=workspace_id, user_id=user_id)
            .one_or_none()
        )
        if not m:
            raise ValueError("Not a member")
        # Never demote the last owner - it would orphan the workspace.
        if m.role == Role.OWNER and new_role != Role.OWNER and self.owner_count(workspace_id) <= 1:
            raise ValueError("Cannot remove the last owner")
        m.role = new_role
        self.db.commit()

    def remove(self, actor_role: str, workspace_id: str, user_id: str) -> None:
        from app.models import WorkspaceMember
        require(actor_role, "member.manage")
        m = (
            self.db.query(WorkspaceMember)
            .filter_by(workspace_id=workspace_id, user_id=user_id)
            .one_or_none()
        )
        if not m:
            return
        if m.role == Role.OWNER and self.owner_count(workspace_id) <= 1:
            raise ValueError("Cannot remove the last owner")
        self.db.delete(m)
        self.db.commit()
