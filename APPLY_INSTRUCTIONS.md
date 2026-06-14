# AtlasLM Patch 001 — Core RAG Stabilization

## What this patch fixes
1. **Zero-vector corruption (CRITICAL):** embedding failures now RAISE instead of
   silently storing fake `[0,0,0...]` vectors. This was corrupting retrieval quality.
2. **Conversation history:** the LLM now receives prior turns, so follow-up
   questions ("what about that section?") work.
3. **Citation extraction:** exact regex matching (`[source_N]`) — no more
   source_1 / source_10 substring collisions.
4. **Provider leakage:** all client-facing error messages are AtlasLM-branded.
   Raw provider errors go to server logs only. Streaming errors are no longer
   injected into the chat transcript.
5. **Empty-notebook UX:** friendly "add a source to get started" message instead
   of a grounding-failure message.
6. **Embedding model tracking:** each document records which embedding model
   produced its vectors; queries only match same-model documents (prevents
   cross-model vector-space garbage, e.g. Ollama 768-dim padded vs cloud 1536-dim).
7. **Connection pooling:** shared httpx clients per provider (lower latency).
8. **Batched embeddings** (64/batch) with real exponential backoff.
9. Prompt typo fixed ("STRICTOR RULES" -> "STRICT RULES").

## Files to replace (drop-in)
| Patch file | Replaces |
|---|---|
| `backend/app/core/providers.py` | `backend/app/core/providers.py` |
| `backend/app/services/rag.py` | `backend/app/services/rag.py` |
| `backend/app/services/pipeline.py` | `backend/app/services/pipeline.py` |

## Manual edits required (2 small ones)

### A) `backend/app/models.py` — add one column to `Document`
```python
class Document(Base):
    __tablename__ = "documents"
    # ... existing columns ...
    source_url = Column(String(2083), nullable=True)
    embedding_model = Column(String(120), nullable=True)   # <-- ADD THIS LINE
```

### B) `backend/app/core/config.py` — two changes
1. Add the server-side provider selector (clients must never choose providers):
```python
    # Active engine routing (server-side only; never exposed to clients)
    ATLAS_ACTIVE_PROVIDER: str = Field(default="langdock", env="ATLAS_ACTIVE_PROVIDER")
```
2. **SECURITY — remove the hardcoded JWT secret default.** Replace:
```python
    JWT_SECRET: str = Field(default="ceb184...", env="JWT_SECRET")
```
with:
```python
    JWT_SECRET: str = Field(..., env="JWT_SECRET")  # required, no default
```
and remove the default from `docker-compose.yaml` too (`JWT_SECRET=${JWT_SECRET}`)
then set it in `.env`. Rotate the old secret — it is in git history.

### C) Callers of `RAGService` / `DocumentPipeline` (routers)
- Any router passing `provider` from the request body should STOP doing so:
  call `execute_rag_chat_stream(workspace_id, session_id, user_message)` and
  `ingest_document(...)` without `provider_name`. Routing is now controlled by
  `ATLAS_ACTIVE_PROVIDER` in `.env`.
- You can keep accepting the `provider` field in `URLIngestRequest` for backward
  compatibility, but ignore it (or remove the field from `schemas.py`).
- NOTE the LLM interface changed: `generate_stream(messages: List[dict])` now takes
  a full message list instead of `(prompt, system_prompt)`. `rag.py` in this patch
  already uses the new signature. If anything else calls `generate_stream`, update it.

## Database migration
Run `migrations/001_embedding_model_and_diagnostics.sql` against your DB:
```bash
docker exec -i atlaslm-db-1 psql -U atlaslm -d atlaslm_db < migrations/001_embedding_model_and_diagnostics.sql
```
The SELECT in it reports corrupted zero-vector documents. If it returns rows,
uncomment and run the DELETE block, then re-upload those documents.

## Deploy
```bash
docker-compose up -d --build backend
docker logs -f atlaslm-backend-1
```

## Retest checklist (strict PASS/FAIL)
- [ ] "hi" -> conversational greeting (no grounding failure)
- [ ] Question in empty notebook -> "add a source" guidance
- [ ] Upload PDF -> ingestion completes; failure shows a clean AtlasLM error (no provider names)
- [ ] Ask grounded question -> streamed answer with [source_N] pills
- [ ] Follow-up question referencing previous answer works
- [ ] Kill the provider key temporarily -> chat shows branded error, transcript stays clean
- [ ] `SELECT embedding_model FROM documents` shows model id on new uploads
