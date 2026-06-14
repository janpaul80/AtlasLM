# backend/app/services/research/academic_arxiv.py
"""Academic search via arXiv (Atom API) + Crossref (REST). No API key needed."""
from __future__ import annotations
import hashlib
import logging
import xml.etree.ElementTree as ET
from typing import List

import httpx

from .base import SearchAdapter, ResearchResult

log = logging.getLogger("atlas.research.academic")
TIMEOUT = 12.0
_ATOM = "{http://www.w3.org/2005/Atom}"


def _hid(prefix: str, s: str) -> str:
    return prefix + hashlib.sha1(s.encode("utf-8")).hexdigest()[:12]


class ArxivAdapter(SearchAdapter):
    name = "arxiv"

    def search(self, query: str, limit: int = 5) -> List[ResearchResult]:
        try:
            r = httpx.get(
                "https://export.arxiv.org/api/query",
                params={"search_query": f"all:{query}", "start": 0, "max_results": limit},
                timeout=TIMEOUT,
            )
            r.raise_for_status()
            root = ET.fromstring(r.text)
        except Exception as e:                       # noqa: BLE001
            log.warning("arXiv unavailable: %s", e)
            return []

        out: List[ResearchResult] = []
        for entry in root.findall(f"{_ATOM}entry"):
            title = (entry.findtext(f"{_ATOM}title") or "").strip().replace("\n", " ")
            summary = (entry.findtext(f"{_ATOM}summary") or "").strip().replace("\n", " ")
            url = (entry.findtext(f"{_ATOM}id") or "").strip()
            published = (entry.findtext(f"{_ATOM}published") or "")[:4]
            authors = ", ".join(
                (a.findtext(f"{_ATOM}name") or "").strip()
                for a in entry.findall(f"{_ATOM}author")
            )[:200]
            arxiv_id = url.split("/abs/")[-1] if "/abs/" in url else url
            out.append(ResearchResult(
                id=_hid("a_", url), type="academic", title=title, url=url,
                snippet=summary[:600], source_label="arXiv",
                authors=authors, venue=f"arXiv:{arxiv_id}", year=published,
            ))
        return out

    def fetch_full_text(self, result: ResearchResult) -> str:
        # Abstract is the grounded body for arXiv (full PDF parse is optional later).
        return result.snippet


class CrossrefAdapter(SearchAdapter):
    name = "crossref"

    def search(self, query: str, limit: int = 5) -> List[ResearchResult]:
        try:
            r = httpx.get(
                "https://api.crossref.org/works",
                params={"query": query, "rows": limit, "select":
                        "DOI,title,abstract,author,container-title,issued,URL"},
                timeout=TIMEOUT,
                headers={"User-Agent": "AtlasLM-Research/1.0 (mailto:research@atlaslm.cloud)"},
            )
            r.raise_for_status()
            items = r.json().get("message", {}).get("items", [])
        except Exception as e:                       # noqa: BLE001
            log.warning("Crossref unavailable: %s", e)
            return []

        out: List[ResearchResult] = []
        for it in items:
            title = " ".join(it.get("title") or []) or "(untitled)"
            doi = it.get("DOI", "")
            url = it.get("URL") or (f"https://doi.org/{doi}" if doi else "")
            if not url:
                continue
            abstract = (it.get("abstract") or "").replace("<jats:p>", "").replace("</jats:p>", "")
            authors = ", ".join(
                f"{a.get('given','')} {a.get('family','')}".strip()
                for a in (it.get("author") or [])
            )[:200]
            venue = " ".join(it.get("container-title") or []) or "Journal"
            year = ""
            issued = it.get("issued", {}).get("date-parts", [[None]])
            if issued and issued[0] and issued[0][0]:
                year = str(issued[0][0])
            out.append(ResearchResult(
                id=_hid("c_", url), type="academic", title=title[:300], url=url,
                snippet=(abstract or title)[:600], source_label="Crossref",
                authors=authors, venue=venue[:120], year=year,
            ))
        return out

    def fetch_full_text(self, result: ResearchResult) -> str:
        return result.snippet
