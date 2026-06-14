# backend/app/services/research/service.py
"""DeepResearchService - orchestrates adapters, ranking, and ingestion.

Mirrors the Patch 005 StudioService class style. Search runs all enabled
adapters concurrently (thread pool, since adapters are sync httpx). Kept
results are pushed through the EXISTING DocumentPipeline.ingest_extracted_blocks
so they are chunked, embedded into pgvector, and become citation-backed exactly
like uploaded sources. External sources are labeled 'Deep Research'.
"""
from __future__ import annotations
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List

from .base import ResearchResult
from .web_searxng import SearxngAdapter
from .academic_arxiv import ArxivAdapter, CrossrefAdapter

log = logging.getLogger("atlas.research.service")


class DeepResearchService:
    def __init__(self) -> None:
        self.web = SearxngAdapter()
        self.arxiv = ArxivAdapter()
        self.crossref = CrossrefAdapter()

    # ---- search -----------------------------------------------------------
    def search(self, query: str, *, web: bool = True, academic: bool = True,
               limit: int = 8) -> List[Dict]:
        tasks = []
        if web:
            tasks.append((self.web.search, query, limit))
        if academic:
            tasks.append((self.arxiv.search, query, 5))
            tasks.append((self.crossref.search, query, 5))

        results: List[ResearchResult] = []
        with ThreadPoolExecutor(max_workers=4) as ex:
            futs = [ex.submit(fn, q, n) for (fn, q, n) in tasks]
            for f in as_completed(futs):
                try:
                    results.extend(f.result() or [])
                except Exception as e:               # noqa: BLE001
                    log.warning("adapter failed: %s", e)

        # de-dupe by id, simple rank: web first then academic, stable order
        seen, deduped = set(), []
        for r in results:
            if r.id in seen:
                continue
            seen.add(r.id)
            deduped.append(r)
        deduped.sort(key=lambda r: 0 if r.type == "web" else 1)
        return [r.to_dict() for r in deduped]

    # ---- ingest kept results ---------------------------------------------
    def ingest(self, db, workspace_id: str, query: str, picks: List[Dict],
               *, fetch_full_text: bool = True) -> List[Dict]:
        """Persist chosen results as labeled Deep Research sources.

        Reuses DocumentPipeline.ingest_extracted_blocks (Patch 003) so chunking,
        offsets, and embeddings are identical to uploaded sources.
        """
        from app.services.pipeline import DocumentPipeline  # local import: avoid cycle

        pipeline = DocumentPipeline(db)
        adapters = {"web": self.web, "arxiv": self.arxiv, "crossref": self.crossref}
        created = []

        for p in picks:
            rid = p.get("id", "")
            adapter = self.web if rid.startswith("w_") else (
                self.crossref if rid.startswith("c_") else self.arxiv)
            # rebuild a minimal ResearchResult to allow full-text fetch
            rr = ResearchResult(
                id=rid, type=p.get("type", "web"), title=p.get("title", ""),
                url=p.get("url", ""), snippet=p.get("snippet", ""),
                source_label=p.get("source_label", "Web"),
                domain=p.get("domain"), date=p.get("date"),
                authors=p.get("authors"), venue=p.get("venue"), year=p.get("year"),
            )
            body = adapter.fetch_full_text(rr) if fetch_full_text else rr.snippet
            display = rr.title or rr.domain or rr.url

            block = {
                "text": body,
                "page": None,
                "char_offset": 0,
                "sheet": None,
                "timestamp": None,
                # metadata carried so citationLabel can show the origin nicely
                "meta": {
                    "origin": "deep_research",
                    "label": "Deep Research",
                    "source_label": rr.source_label,
                    "url": rr.url,
                    "query": query,
                },
            }
            doc = pipeline.ingest_extracted_blocks(
                workspace_id=workspace_id,
                filename=display[:120],
                source_type="deep_research",
                blocks=[block],
            )
            created.append({
                "id": getattr(doc, "id", None),
                "name": display[:120],
                "type": rr.type,
                "label": "Deep Research",
                "source_label": rr.source_label,
                "url": rr.url,
            })
        return created
