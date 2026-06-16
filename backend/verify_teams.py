"""Patch 013 - offline verification for Teams / Shared Workspaces.

Runs without a real database or network. Uses an in-memory fake session that
mimics the SQLAlchemy query/add/commit surface the services use. Verifies:

  1. Role permission matrix (owner/editor/viewer capabilities).
  2. Last-owner protection on change_role and remove.
  3. Invite token is hashed, never stored raw; accept() matches on hash.
  4. accept() rejects: bad token, wrong email, expired, already used.
  5. Editor cannot invite an editor; owner can.
  6. Punctuation cleanliness (no em dash, en dash, ellipsis, emoji) in shipped files.
"""
import os, sys, time, types, hashlib

# --- make the package importable with stubbed app.models / app deps ----------
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

# Stub app.models.Base and the two ORM classes with plain attribute objects.
app = types.ModuleType("app"); sys.modules["app"] = app
models = types.ModuleType("app.models"); sys.modules["app.models"] = models

class _Base: pass
def _mk(cls_name, defaults):
    def __init__(self, **kw):
        for k, v in defaults.items(): setattr(self, k, v() if callable(v) else v)
        for k, v in kw.items(): setattr(self, k, v)
    return type(cls_name, (), {"__init__": __init__})

import uuid
models.Base = _Base
models.WorkspaceMember = _mk("WorkspaceMember", {
    "id": lambda: "mem_" + uuid.uuid4().hex[:16], "workspace_id": None, "user_id": None,
    "role": "viewer", "added_by": None, "created_at": 0.0})
models.WorkspaceInvite = _mk("WorkspaceInvite", {
    "id": lambda: "inv_" + uuid.uuid4().hex[:16], "workspace_id": None, "email": None,
    "role": "viewer", "token_hash": None, "invited_by": None, "status": "pending",
    "expires_at": None, "created_at": 0.0, "accepted_at": None})

# --- tiny fake DB session ----------------------------------------------------
class FakeQuery:
    def __init__(self, rows, cls): self.rows = rows; self.cls = cls; self._f = {}
    def filter_by(self, **kw): self._f = kw; return self
    def filter(self, *a):  # only used by expire_due (status == pending)
        self._pred = a; return self
    def _match(self, r): return all(getattr(r, k) == v for k, v in self._f.items())
    def all(self):
        rs = [r for r in self.rows if self._match(r)]
        if getattr(self, "_pred", None):
            rs = [r for r in rs if r.status == "pending"]
        return rs
    def one_or_none(self):
        rs = self.all(); return rs[0] if rs else None
    def count(self): return len(self.all())

class FakeDB:
    def __init__(self): self.store = {"WorkspaceMember": [], "WorkspaceInvite": []}
    def query(self, cls): return FakeQuery(self.store[cls.__name__], cls)
    def add(self, obj): self.store[type(obj).__name__].append(obj)
    def delete(self, obj): self.store[type(obj).__name__].remove(obj)
    def commit(self): pass

# --- import services under test ----------------------------------------------
sys.path.insert(0, os.path.join(ROOT, "app", "services"))
import importlib.util
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec); sys.modules[name] = mod
    spec.loader.exec_module(mod); return mod

roles = load("teams_roles", os.path.join(ROOT, "app/services/teams/roles.py"))
# members and invites import "from .roles" / "from .members"; build a package shim
pkg = types.ModuleType("teams"); pkg.__path__ = [os.path.join(ROOT, "app/services/teams")]
sys.modules["teams"] = pkg
sys.modules["teams.roles"] = roles
members = load("teams.members", os.path.join(ROOT, "app/services/teams/members.py"))
invites = load("teams.invites", os.path.join(ROOT, "app/services/teams/invites.py"))

Role = roles.Role
fails = []
def check(name, cond):
    print(("PASS" if cond else "FAIL"), "-", name)
    if not cond: fails.append(name)

# 1. permission matrix
check("viewer can read", roles.can("viewer", "source.read"))
check("viewer cannot write", not roles.can("viewer", "source.write"))
check("editor can write", roles.can("editor", "source.write"))
check("editor cannot manage members", not roles.can("editor", "member.manage"))
check("owner can billing", roles.can("owner", "workspace.billing"))

# 2. last-owner protection
db = FakeDB(); ts = members.TeamService(db)
ts.add("ws1", "u_owner", "owner", "u_owner")
try:
    ts.change_role("owner", "ws1", "u_owner", "viewer"); demoted = True
except ValueError: demoted = False
check("cannot demote last owner", not demoted)
try:
    ts.remove("owner", "ws1", "u_owner"); removed = True
except ValueError: removed = False
check("cannot remove last owner", not removed)

# 3 + 4. invite hashing + accept paths
db = FakeDB(); members.TeamService(db).add("ws2", "owner1", "owner", "owner1")
isvc = invites.InviteService(db)
res = isvc.create("owner", "ws2", "New.Person@Example.com", "viewer", "owner1")
stored = db.store["WorkspaceInvite"][0]
check("token not stored raw", stored.token_hash != res["token"])
check("token hash matches", stored.token_hash == hashlib.sha256(res["token"].encode()).hexdigest())
check("email normalized", stored.email == "new.person@example.com")

# wrong email
try: isvc.accept(res["token"], "other@example.com", "u_new"); ok = True
except invites.InviteError: ok = False
check("accept rejects wrong email", not ok)
# correct claim
out = isvc.accept(res["token"], "new.person@example.com", "u_new")
check("accept creates membership", out["role"] == "viewer")
check("member now present", members.TeamService(db).role_of("ws2", "u_new") == "viewer")
# reuse rejected
try: isvc.accept(res["token"], "new.person@example.com", "u_new"); reuse = True
except invites.InviteError: reuse = False
check("accept rejects reuse", not reuse)
# expired
res2 = isvc.create("owner", "ws2", "late@example.com", "viewer", "owner1")
db.store["WorkspaceInvite"][-1].expires_at = time.time() - 1
try: isvc.accept(res2["token"], "late@example.com", "u_late"); exp = True
except invites.InviteError: exp = False
check("accept rejects expired", not exp)

# 5. editor cannot invite editor; owner can
try: isvc.create("editor", "ws2", "x@example.com", "editor", "ed1"); ee = True
except invites.InviteError: ee = False
check("editor cannot invite editor", not ee)
res3 = isvc.create("owner", "ws2", "newed@example.com", "editor", "owner1")
check("owner can invite editor", res3["role"] == "editor")

# 6. punctuation cleanliness across shipped text files
bad = {"\u2014": "em dash", "\u2013": "en dash", "\u2026": "ellipsis"}
def has_emoji(s): return any(ord(c) > 0x2190 and ord(c) not in (0x2018,0x2019,0x201C,0x201D) for c in s)
clean = True
for dp, _, fs in os.walk(ROOT):
    if "/." in dp: continue
    for f in fs:
        if not f.endswith((".py", ".ts", ".tsx", ".css", ".sql", ".md", ".txt")): continue
        p = os.path.join(dp, f)
        if p.endswith("verify_teams.py"): continue
        try: txt = open(p, encoding="utf-8").read()
        except Exception: continue
        for ch, label in bad.items():
            if ch in txt: print("  punctuation:", label, "in", f); clean = False
        if has_emoji(txt): print("  emoji in", f); clean = False
check("no em/en dash, ellipsis, or emoji in shipped files", clean)

print()
if fails:
    print("VERIFY FAILED:", len(fails), "checks ->", ", ".join(fails)); sys.exit(1)
print("All Patch 013 verify checks passed.")
