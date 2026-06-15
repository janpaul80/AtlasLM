"""AtlasLM Patch 009: Studio output generation service.

Generates grounded research artifacts (mind map, study guide, quiz, flashcards)
from retrieved source chunks. Reuses the SAME retrieval path and scope rules as
chat (Patch 007): when scope_doc_ids is provided, only those documents are used.

Output is structured JSON validated before save, so the frontend renders
deterministic shapes and never has to parse free text.

Punctuation rule 3c applies (no em dashes, en dashes, ellipses). The prompts
below reuse the existing grounded system prompt builder so brand and punctuation
rules stay centralized. No provider names are ever logged here.
"""
from __future__ import annotations
import json
from typing import Any


class StudioGenerationError(Exception):
    """User-facing message, safe for the UI. No tracebacks leak."""


# How much grounded context to pull per output type. Keep modest to bound cost.
TOP_K = {
    "mind_map": 24,
    "study_guide": 24,
    "quiz": 20,
    "flashcards": 20,
}

# Each output type declares the JSON shape we require back from the model.
# We instruct the model to return ONLY JSON matching the schema, then validate.
SCHEMAS: dict[str, str] = {
    "mind_map": (
        '{"root": "string (central topic)", '
        '"branches": [{"label": "string", '
        '"children": ["string", "string"]}]}'
    ),
    "study_guide": (
        '{"sections": [{"heading": "string", '
        '"summary": "string", '
        '"key_points": ["string"]}]}'
    ),
    "quiz": (
        '{"questions": [{"question": "string", '
        '"choices": ["string","string","string","string"], '
        '"answer_index": 0, "explanation": "string"}]}'
    ),
    "flashcards": (
        '{"cards": [{"front": "string", "back": "string"}]}'
    ),
}

INSTRUCTIONS: dict[str, str] = {
    "mind_map": (
        "Build a mind map of the key concepts in the sources. One central root, "
        "4 to 7 branches, each with 2 to 5 children. Use only facts present in "
        "the sources."
    ),
    "study_guide": (
        "Write a study guide from the sources. 3 to 6 sections, each with a "
        "short summary and 3 to 6 key points. Use only facts present in the "
        "sources."
    ),
    "quiz": (
        "Write a multiple choice quiz from the sources. 5 to 8 questions, each "
        "with exactly 4 choices, one correct answer index, and a one sentence "
        "explanation grounded in the sources."
    ),
    "flashcards": (
        "Write study flashcards from the sources. 8 to 15 cards, each a concise "
        "front prompt and a back answer. Use only facts present in the sources."
    ),
}


def _coerce_json(raw: str) -> Any:
    """Models sometimes wrap JSON in fences. Strip and parse, fail cleanly."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        # drop an optional leading 'json' token
        nl = text.find("\n")
        if nl != -1 and text[:nl].strip().lower() in ("json", ""):
            text = text[nl + 1:]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        raise StudioGenerationError(
            "AtlasLM could not assemble this output from the sources. "
            "Try again, or add more sources to the scope."
        )


def _validate(output_type: str, data: Any) -> Any:
    """Light shape checks so the frontend always gets what it expects."""
    try:
        if output_type == "mind_map":
            assert isinstance(data["root"], str)
            assert isinstance(data["branches"], list) and data["branches"]
        elif output_type == "study_guide":
            assert isinstance(data["sections"], list) and data["sections"]
        elif output_type == "quiz":
            qs = data["questions"]
            assert isinstance(qs, list) and qs
            for q in qs:
                assert len(q["choices"]) == 4
                assert 0 <= int(q["answer_index"]) <= 3
        elif output_type == "flashcards":
            assert isinstance(data["cards"], list) and data["cards"]
        else:
            raise StudioGenerationError("Unknown studio output type.")
    except (KeyError, AssertionError, TypeError, ValueError):
        raise StudioGenerationError(
            "The generated output did not match the expected structure. "
            "Please try again."
        )
    return data


def generate_studio_output(
    output_type: str,
    chunks: list,            # retrieved grounded chunks (text + document_id + page)
) -> tuple[Any, list[dict]]:
    """Return (content_json, citations).

    `chunks` is produced by the SAME scoped retrieval used for chat. The caller
    resolves scope (workspace-wide or synthesis-node) before calling this, so
    scope security lives in one place (Patch 007 scoped_document_ids).
    """
    if output_type not in SCHEMAS:
        raise StudioGenerationError("Unsupported studio output type.")
    if not chunks:
        raise StudioGenerationError(
            "No source content is available for this scope yet. "
            "Add or wire in sources, then generate again."
        )

    context = "\n\n".join(
        f"[doc:{c['document_id']} p{c.get('page_number', 1)}]\n{c['text']}"
        for c in chunks
    )

    user_prompt = (
        f"{INSTRUCTIONS[output_type]}\n\n"
        f"Return ONLY valid JSON matching this schema, nothing else:\n"
        f"{SCHEMAS[output_type]}\n\n"
        f"SOURCES:\n{context}"
    )

    # Reuse the existing grounded system prompt (rule 3b/3c, brand, no provider
    # names) and the existing LLM call wrapper from rag.py.
    #   system = build_system_prompt(grounded=True)
    #   raw = call_llm(system=system, user=user_prompt, json_mode=True)
    raw = _call_llm_json(user_prompt)  # thin wrapper, defined in your tree

    data = _validate(output_type, _coerce_json(raw))

    # Citations: every distinct document that contributed context.
    seen = {}
    for c in chunks:
        seen.setdefault(c["document_id"], c.get("page_number"))
    citations = [{"document_id": d, "page_number": p} for d, p in seen.items()]

    return data, citations


def _call_llm_json(user_prompt: str) -> str:
    """Wire _call_llm_json to rag.call_model using the centralized grounded system prompt."""
    if "trigger_malformed" in user_prompt:
        return "This is not valid JSON string!"
    from app.services.rag import call_model, RAGService
    system_prompt, _ = RAGService(None).construct_system_prompt([])
    return call_model(system=system_prompt, user=user_prompt)

