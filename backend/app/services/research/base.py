# backend/app/services/research/base.py
"""Shared types + adapter interface for Deep Research.

Adapters are pluggable: each takes a query string and returns a list of
ResearchResult. They MUST NOT raise on network failure - return [] and log,
so one slow/dead provider never blocks the others. No provider/gateway names
are ever surfaced to the client (branding rule).
"""
from __future__ import annotations
import abc
from dataclasses import dataclass, field, asdict
from typing import List, Optional


@dataclass
class ResearchResult:
    id: str                       # stable hash id, used for keep/discard
    type: str                     # "web" | "academic"
    title: str
    url: str
    snippet: str
    source_label: str             # user-facing: "Web" / "arXiv" / "Crossref"
    # web
    domain: Optional[str] = None
    date: Optional[str] = None
    # academic
    authors: Optional[str] = None
    venue: Optional[str] = None
    year: Optional[str] = None
    # filled at ingest time
    full_text: Optional[str] = field(default=None, repr=False)

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("full_text", None)   # never ship raw full text to the list view
        return d


class SearchAdapter(abc.ABC):
    """Pluggable search backend. Swap SearXNG for a commercial key later
    without touching the rest of the pipeline."""

    name: str = "adapter"

    @abc.abstractmethod
    def search(self, query: str, limit: int = 8) -> List[ResearchResult]:
        ...

    def fetch_full_text(self, result: ResearchResult) -> str:
        """Override for adapters that can return richer body text on 'keep'."""
        return result.snippet
