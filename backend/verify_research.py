# backend/verify_research.py
"""Quick offline sanity check for Deep Research adapters & service wiring.
Run inside the backend container:  python verify_research.py
Network calls may fail in air-gapped envs - that's fine, it must NOT crash."""
import logging
logging.basicConfig(level=logging.INFO)

from app.services.research.service import DeepResearchService
from app.services.research import jobs

svc = DeepResearchService()
print("[1] adapters loaded:", svc.web.name, svc.arxiv.name, svc.crossref.name)

res = svc.search("net revenue retention B2B SaaS", web=True, academic=True, limit=3)
print(f"[2] search returned {len(res)} results (0 is OK if offline)")
for r in res[:3]:
    print("    -", r["type"], r["source_label"], "|", r["title"][:60])

try:
    jid = jobs.enqueue("search", {"query": "test"})
    print("[3] redis enqueue OK, job_id:", jid, "->", jobs.get_job(jid)["status"])
except Exception as e:
    print("[3] redis not reachable (OK if not running):", e)

print("[OK] Deep Research module imports and runs.")
