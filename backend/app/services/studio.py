"""
AtlasLM Studio (Patch 005).

Generates long-form outputs (Reports, Executive Summaries) grounded in the
workspace's ingested sources. Runs as background jobs on the Redis queue
(same lifecycle as ingestion: pending -> processing -> ready/failed) with a
synchronous fallback when Redis is unavailable.

Design notes:
- Output types are registered in OUTPUT_TYPES; adding Flashcards/Quiz/Study
  Guide later means adding a spec entry + prompt builder, nothing else.
- Generation is grounded: we gather the workspace's chunks (document-ordered,
  not similarity-ordered, since outputs summarize the whole corpus), pack them
  into a token-budgeted context, and instruct the model to cite [source_N]
  tags exactly like chat. Citations are extracted and persisted with the
  output so the frontend can render the same citation chips.
- For corpora larger than the context budget we use map-reduce: per-document
  intermediate summaries, then a final synthesis pass.
"""

import json
import logging
import re
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from ..models import Document, DocumentChunk, StudioOutput
from ..core.providers import provider_registry, ProviderError

logger = logging.getLogger("atlaslm.studio")

CITATION_TAG_RE = re.compile(r"\[(source_\d+)\]")

# Rough char budget for the context block (~24k tokens at 4 chars/token).
CONTEXT_CHAR_BUDGET = 96_000
# Per-document budget used in map-reduce mode.
PER_DOC_CHAR_BUDGET = 24_000

OUTPUT_TYPES: Dict[str, Dict[str, Any]] = {
    "report": {
        "label": "Report",
        "title_template": "Report  -  {workspace}",
        "instructions": (
            "Write a comprehensive, well-structured research REPORT based strictly "
            "on the provided sources. Structure:\n"
            "# (a descriptive title you choose)\n"
            "## Introduction  -  what the sources cover and why it matters\n"
            "## (3-6 thematic sections you choose based on the material)\n"
            "## Key Findings  -  bulleted, each with citations\n"
            "## Conclusion\n"
            "Use Markdown. Be thorough but never pad. Every factual claim must "
            "carry its [source_N] citation."
        ),
    },
    "executive_summary": {
        "label": "Executive Summary",
        "title_template": "Executive Summary  -  {workspace}",
        "instructions": (
            "Write a crisp EXECUTIVE SUMMARY of the provided sources for a "
            "time-poor decision-maker. Structure:\n"
            "# Executive Summary\n"
            "## Overview  -  2-3 sentences\n"
            "## Key Points  -  4-8 bullets, most important first, each cited\n"
            "## Implications / Recommendations  -  only if the sources support them\n"
            "Maximum ~500 words. Use Markdown. Every factual claim must carry "
            "its [source_N] citation. Do not invent recommendations the sources "
            "do not support."
        ),
    },
}


class StudioService:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------ #
    # Context assembly
    # ------------------------------------------------------------------ #
    def _gather_corpus(
        self, workspace_id: uuid.UUID, document_ids: Optional[List[uuid.UUID]] = None
    ) -> List[Dict[str, Any]]:
        """Returns chunks in document order. Optionally restricted to a
        subset of documents (multi-source selection ready)."""
        q = (
            self.db.query(DocumentChunk, Document)
            .join(Document, DocumentChunk.document_id == Document.id)
            .filter(Document.workspace_id == workspace_id)
            .filter(Document.status == "ready")
        )
        if document_ids:
            q = q.filter(Document.id.in_(document_ids))
        rows = q.order_by(Document.created_at.asc(), DocumentChunk.chunk_index.asc()).all()
        return [
            {
                "chunk_id": c.id,
                "document_id": d.id,
                "filename": d.filename,
                "page_number": c.page_number,
                "content": c.content,
            }
            for c, d in rows
        ]

    @staticmethod
    def _pack_context(
        chunks: List[Dict[str, Any]], budget: int
    ) -> Tuple[str, Dict[str, Any], bool]:
        """Packs chunks into tagged source blocks under a char budget.
        Returns (context_str, source_mapping, truncated)."""
        blocks: List[str] = []
        mapping: Dict[str, Any] = {}
        used = 0
        truncated = False
        for idx, ch in enumerate(chunks):
            tag = f"source_{idx + 1}"
            block = (
                f"--- START SOURCE {tag} "
                f"(File: {ch['filename']}, Page: {ch['page_number']}) ---\n"
                f"{ch['content']}\n"
                f"--- END SOURCE {tag} ---"
            )
            if used + len(block) > budget:
                truncated = True
                break
            blocks.append(block)
            used += len(block)
            mapping[tag] = {
                "tag": tag,
                "chunk_id": str(ch["chunk_id"]),
                "document_id": str(ch["document_id"]),
                "filename": ch["filename"],
                "page_number": ch["page_number"],
                "content": ch["content"],
            }
        return "\n\n".join(blocks), mapping, truncated

    @staticmethod
    def _system_prompt(type_instructions: str, context_str: str) -> str:
        return (
            "You are AtlasLM Studio, a strictly source-grounded document generator.\n"
            "You produce polished research artifacts using ONLY the provided sources.\n\n"
            "=== STRICT RULES ===\n"
            "1. NEVER use knowledge outside the provided source blocks.\n"
            "2. Source blocks may contain STRUCTURED DATA ('Column: value' rows). "
            "Scan every line before treating information as absent.\n"
            "3. Every factual claim MUST carry its source tag in brackets "
            "(e.g. [source_1]). Multiple sources: [source_1][source_3].\n"
            "3b. Recommendations and implications may ONLY restate or directly follow from explicit statements in the sources. NEVER convert observed data patterns into advice, policy, or assumptions. If the sources contain no explicit recommendations, state: 'The sources do not contain explicit recommendations.'\n"
            "3c. Punctuation style: write like a careful human editor. NEVER use em dashes, en dashes, or ellipsis characters in your output. Use commas, semicolons, colons, and periods instead. Hyphens are allowed only inside compound words (e.g. \"re-ingestion\", \"key-value\").\n"
            "4. NEVER cite tags that are not in the provided list.\n"
            "5. Output clean Markdown. No emojis. No preamble before the title "
            "and no commentary after the document.\n\n"
            f"=== TASK ===\n{type_instructions}\n\n"
            f"=== SOURCES ===\n{context_str}\n"
        )

    # ------------------------------------------------------------------ #
    # Generation (called by worker, or synchronously as fallback)
    # ------------------------------------------------------------------ #
    async def generate(
        self,
        output_id: uuid.UUID,
        provider_name: Optional[str] = None,
    ) -> StudioOutput:
        out: Optional[StudioOutput] = (
            self.db.query(StudioOutput).filter(StudioOutput.id == output_id).first()
        )
        if not out:
            raise ValueError("Studio output not found")

        spec = OUTPUT_TYPES.get(out.output_type)
        if not spec:
            self._fail(out, "Unknown output type.")
            raise ValueError(f"Unknown output type: {out.output_type}")

        out.status = "processing"
        self.db.commit()
        start = time.time()

        try:
            doc_ids = None
            if out.document_ids:
                doc_ids = [uuid.UUID(d) for d in out.document_ids]
            chunks = self._gather_corpus(out.workspace_id, doc_ids)
            if not chunks:
                self._fail(
                    out,
                    "This notebook has no ready sources yet. Add sources before "
                    "generating a Studio output.",
                )
                return out

            llm = provider_registry.get_llm(provider_name)
            context_str, mapping, truncated = self._pack_context(
                chunks, CONTEXT_CHAR_BUDGET
            )

            if truncated:
                # Map-reduce: summarize per document, then synthesize.
                logger.info(
                    "Studio %s: corpus exceeds budget, using map-reduce.", out.id
                )
                content, mapping = await self._map_reduce(
                    llm, chunks, spec["instructions"]
                )
            else:
                messages = [
                    {
                        "role": "system",
                        "content": self._system_prompt(spec["instructions"], context_str),
                    },
                    {
                        "role": "user",
                        "content": "Generate the document now, following the task "
                        "specification exactly.",
                    },
                ]
                content = ""
                async for piece in llm.generate_stream(messages):
                    content += piece

            if not content.strip():
                self._fail(out, "Generation produced no content. Please try again.")
                return out

            used_tags = set(CITATION_TAG_RE.findall(content))
            citations = [m for t, m in mapping.items() if t in used_tags]

            out.content = content
            out.citations = citations
            out.status = "ready"
            out.error_message = None
            self.db.commit()
            logger.info(
                "Studio output %s (%s) ready in %.1fs: %d chars, %d citations.",
                out.id, out.output_type, time.time() - start, len(content), len(citations),
            )
            return out

        except ProviderError as e:
            self._fail(out, e.public_message)
            return out
        except Exception as e:
            logger.error("Studio generation failed: %s", e, exc_info=True)
            self._fail(
                out, "AtlasLM could not generate this output. Please try again."
            )
            return out

    async def _map_reduce(
        self, llm, chunks: List[Dict[str, Any]], instructions: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Per-document intermediate summaries, then a final synthesis pass.
        Citations in the final output point at the per-document blocks."""
        by_doc: Dict[str, List[Dict[str, Any]]] = {}
        for ch in chunks:
            by_doc.setdefault(str(ch["document_id"]), []).append(ch)

        interim_blocks: List[Dict[str, Any]] = []
        for doc_id, doc_chunks in by_doc.items():
            ctx, _, _ = self._pack_context(doc_chunks, PER_DOC_CHAR_BUDGET)
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are AtlasLM Studio. Produce a dense, factual digest of "
                        "the following source material. Preserve ALL key facts, "
                        "figures, names and numbers. Markdown bullets. No commentary.\n\n"
                        f"=== SOURCES ===\n{ctx}\n"
                    ),
                },
                {"role": "user", "content": "Digest the sources now."},
            ]
            digest = ""
            async for piece in llm.generate_stream(messages):
                digest += piece
            first = doc_chunks[0]
            interim_blocks.append(
                {
                    "chunk_id": first["chunk_id"],
                    "document_id": first["document_id"],
                    "filename": first["filename"],
                    "page_number": first["page_number"],
                    "content": digest,
                }
            )

        context_str, mapping, _ = self._pack_context(
            interim_blocks, CONTEXT_CHAR_BUDGET
        )
        messages = [
            {"role": "system", "content": self._system_prompt(instructions, context_str)},
            {
                "role": "user",
                "content": "Generate the document now, following the task "
                "specification exactly.",
            },
        ]
        content = ""
        async for piece in llm.generate_stream(messages):
            content += piece
        return content, mapping

    def _fail(self, out: StudioOutput, message: str) -> None:
        out.status = "failed"
        out.error_message = message
        self.db.commit()
