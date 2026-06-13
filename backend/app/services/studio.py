# backend/app/services/studio.py
"""
AtlasLM Studio - turns the grounded knowledge base into finished outputs.
Reuses the existing RAG retrieval pipeline so every output stays source-grounded
and citation-backed. No provider names are ever exposed to the client.
"""
from __future__ import annotations
import json
from typing import Any, Dict, List

# NOTE TO DEV TEAM: confirm these names match backend/app/services/rag.py.
# If different, alias them here or send rag.py to the build lead.
from app.services.rag import (
    retrieve_chunks,      # (notebook_id, query, source_ids, k) -> List[chunk]
    call_model,           # (system, user, stream=False) -> str
    build_citation_map,   # chunks -> {source_n: {filename, page, text}}
)

STUDIO_SPECS: Dict[str, Dict[str, Any]] = {
    "report": {
        "retrieve_query": "key findings, metrics, risks, recommendations across all sources",
        "k": 14,
        "instruction": (
            "Write a structured executive report with these sections: "
            "Executive Summary, Key Findings, Analysis, Risks, Recommendations. "
            "Cite every factual claim with [source_N] tokens. "
            "Return STRICT JSON: {\"title\": str, \"sections\": [{\"h\": str, \"b\": str, \"cites\": [int]}]}"
        ),
    },
    "mindmap": {
        "retrieve_query": "main themes, relationships and structure of the sources",
        "k": 12,
        "instruction": (
            "Build a mind map of the sources. Return STRICT JSON: "
            "{\"root\": str, \"branches\": [{\"label\": str, \"kids\": [str]}]}. "
            "3-5 branches, 2-5 kids each."
        ),
    },
    "flashcards": {
        "retrieve_query": "important facts, definitions and figures worth memorizing",
        "k": 12,
        "instruction": (
            "Create study flashcards. Return STRICT JSON: "
            "{\"cards\": [{\"q\": str, \"a\": str, \"cite\": int}]}. 8-12 cards."
        ),
    },
    "quiz": {
        "retrieve_query": "testable facts and concepts in the sources",
        "k": 12,
        "instruction": (
            "Create a quiz. Return STRICT JSON: "
            "{\"questions\": [{\"q\": str, \"opts\": [str], \"correct\": int, \"cite\": int}]}. "
            "6-10 questions, 4 options each."
        ),
    },
    "table": {
        "retrieve_query": "metrics, numbers, comparisons and findings to tabulate",
        "k": 14,
        "instruction": (
            "Extract a comparison data table. Return STRICT JSON: "
            "{\"cols\": [str], \"rows\": [[str]]}. Last column of each row is the source number."
        ),
    },
    "slides": {
        "retrieve_query": "narrative arc, key points and conclusions for a presentation",
        "k": 14,
        "instruction": (
            "Create a slide deck outline. Return STRICT JSON: "
            "{\"slides\": [{\"t\": str, \"s\": str, \"cites\": [int]}]}. 5-9 slides."
        ),
    },
    "audio": {
        "retrieve_query": "narrative summary suitable for a spoken podcast overview",
        "k": 14,
        "instruction": (
            "Write a two-host podcast script summarizing the sources conversationally. "
            "Return STRICT JSON: {\"title\": str, \"script\": [{\"speaker\": str, \"line\": str}]}."
        ),
    },
}

SYSTEM = (
    "You are AtlasLM Research, a source-grounded research engine. "
    "Use ONLY the provided context chunks. Never invent facts. "
    "Reference sources strictly as [source_N]. Output ONLY the requested JSON, nothing else."
)


def _coerce_json(raw: str) -> Dict[str, Any]:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip("` \n")
    try:
        return json.loads(raw)
    except Exception:
        start, end = raw.find("{"), raw.rfind("}")
        return json.loads(raw[start : end + 1])


def generate_studio_output(
    notebook_id: str,
    output_type: str,
    source_ids: List[str],
) -> Dict[str, Any]:
    if output_type not in STUDIO_SPECS:
        raise ValueError(f"Unknown studio output type: {output_type}")

    spec = STUDIO_SPECS[output_type]
    chunks = retrieve_chunks(
        notebook_id=notebook_id,
        query=spec["retrieve_query"],
        source_ids=source_ids,
        k=spec["k"],
    )
    if not chunks:
        return {
            "type": output_type,
            "empty": True,
            "message": "No source content available. Add or select sources first.",
        }

    context = "\n\n".join(
        f"[source_{i+1}] ({c.get('filename','source')} p.{c.get('page','?')}):\n{c.get('text','')}"
        for i, c in enumerate(chunks)
    )
    user_prompt = f"CONTEXT:\n{context}\n\nTASK:\n{spec['instruction']}"

    raw = call_model(system=SYSTEM, user=user_prompt, stream=False)
    payload = _coerce_json(raw)

    return {
        "type": output_type,
        "empty": False,
        "data": payload,
        "citations": build_citation_map(chunks),
    }
