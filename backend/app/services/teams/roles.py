"""Patch 013 - role model and permission checks for shared workspaces.

Three roles only, mapped to what the product actually does:
  owner  - billing, delete workspace, manage members, everything below
  editor - add and remove sources, run studio, invite viewers
  viewer - read and listen only

Keep this module dependency free so it can be imported anywhere and unit
tested without a database.
"""
from __future__ import annotations


class Role:
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"
    ALL = (OWNER, EDITOR, VIEWER)
    INVITABLE = (EDITOR, VIEWER)  # owner is never assigned through an invite


# Higher rank means more authority. Used for "at least" checks.
ROLE_RANK = {Role.VIEWER: 1, Role.EDITOR: 2, Role.OWNER: 3}

# Capability -> minimum role required.
CAPABILITY = {
    "source.read":    Role.VIEWER,
    "studio.listen":  Role.VIEWER,
    "source.write":   Role.EDITOR,
    "studio.run":     Role.EDITOR,
    "member.invite":  Role.EDITOR,   # editors may invite viewers (see invite rules)
    "member.manage":  Role.OWNER,    # change roles, remove members
    "workspace.billing": Role.OWNER,
    "workspace.delete":  Role.OWNER,
}


def can(role: str, capability: str) -> bool:
    """True if `role` meets the minimum role for `capability`."""
    need = CAPABILITY.get(capability)
    if need is None:
        return False
    return ROLE_RANK.get(role, 0) >= ROLE_RANK[need]


def require(role: str, capability: str) -> None:
    """Raise PermissionError if the role cannot perform the capability."""
    if not can(role, capability):
        raise PermissionError(
            "Role '%s' is not allowed to %s" % (role, capability)
        )
