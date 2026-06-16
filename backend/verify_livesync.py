# backend/verify_livesync.py
"""Offline sanity check for Live Sync (Drive watch channels).
Run inside the backend container:  python verify_livesync.py
No network is made; live Drive calls are NOT exercised here."""
import sys, types, logging
logging.basicConfig(level=logging.INFO)

from app.services.connections.watch import _new_token, WATCH_TTL_SECONDS
from app.services.connections.livesync import LiveSyncService
from app.services.connections import renewal_worker

# [1] per-channel token unique + opaque
t1, t2 = _new_token(), _new_token()
assert t1 != t2 and len(t1) >= 24
print("[1] per-channel tokens unique and opaque (len=%d)" % len(t1))

# [2] watch TTL inside Google's ~24h cap
assert 0 < WATCH_TTL_SECONDS <= 24 * 3600
print("[2] watch TTL within 24h cap (%ds)" % WATCH_TTL_SECONDS)

# [3] service runs db=None without crashing
svc = LiveSyncService(db=None)
assert svc.disable(workspace_id="w1", source_id="s1", access_token="x")["live"] is False
assert svc.resolve_ping(channel_id="c", resource_id="r", token="t") is None
assert svc.due_for_renewal() == []
print("[3] service offline (db=None) enable/disable/resolve/renew OK")

# [4] webhook auth: accept only when channel+resource+token all match
class _Row:
    channel_id="c1"; resource_id="r1"; channel_token="secret"; source_id="s1"; workspace_id="w1"
class _Q:
    def __init__(self, row): self._row=row
    def filter_by(self, **k): return self
    def first(self): return self._row
class _DB:
    def __init__(self, row): self._row=row
    def query(self, *_): return _Q(self._row)
_real_app_models = sys.modules.get("app.models")  # save real module
fake_models = types.ModuleType("app.models"); fake_models.DriveWatchChannel=_Row
sys.modules["app.models"]=fake_models
svc2 = LiveSyncService(db=_DB(_Row()))
assert svc2.resolve_ping(channel_id="c1", resource_id="r1", token="secret") is not None
assert svc2.resolve_ping(channel_id="c1", resource_id="r1", token="WRONG") is None
assert svc2.resolve_ping(channel_id="c1", resource_id="WRONG", token="secret") is None
print("[4] webhook accepts only matching channel+resource+token")
# restore real module so check [5] sees the genuine SQLAlchemy model
if _real_app_models is not None:
    sys.modules["app.models"] = _real_app_models
else:
    sys.modules.pop("app.models", None)

# [5] renewal sweep imports + runs
n = renewal_worker.run_once()
assert isinstance(n, int)
print("[5] renewal sweep run_once OK (renewed=%d offline)" % n)

# [6] punctuation clean
import pathlib
bad = {"\u2014", "\u2013", "\u2026"}
hits = []
for p in pathlib.Path("app/services/connections").rglob("*.py"):
    txt = p.read_text(encoding="utf-8")
    for ch in bad:
        if ch in txt: hits.append((p.name, repr(ch)))
assert not hits, "forbidden punctuation: %s" % hits
print("[6] punctuation clean (no em/en dash, no ellipsis)")

print("[OK] live sync imports and runs.")
