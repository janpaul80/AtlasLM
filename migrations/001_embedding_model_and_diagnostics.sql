-- ============================================================
-- AtlasLM migration 001
-- 1) Track which embedding model produced each document's vectors
-- 2) Diagnostics for zero-vector corruption caused by the old
--    silent fallback in providers.py
-- ============================================================

-- 1. Add embedding_model column (idempotent)
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(120);

-- 2. DIAGNOSTIC: count corrupted (zero-vector) chunks per document.
--    Run this and review output. Any rows returned = corrupted data
--    that MUST be re-ingested.
SELECT d.id            AS document_id,
       d.filename,
       d.workspace_id,
       COUNT(*)        AS zero_vector_chunks
FROM document_chunks dc
JOIN documents d ON d.id = dc.document_id
WHERE dc.embedding IS NOT NULL
  AND dc.embedding <#> dc.embedding = 0          -- inner product of zero vector with itself is 0
  AND dc.embedding::text LIKE '[0,0,0%'          -- cheap guard for literal zero vectors
GROUP BY d.id, d.filename, d.workspace_id
ORDER BY zero_vector_chunks DESC;

-- 3. CLEANUP (run ONLY after reviewing the diagnostic above):
--    delete corrupted documents so users can re-upload them cleanly.
DELETE FROM documents
WHERE id IN (
    SELECT DISTINCT d.id
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.embedding::text LIKE '[0,0,0%'
);

-- 4. Recommended index if not present (speeds cosine search):
-- CREATE INDEX IF NOT EXISTS idx_chunks_embedding
--     ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_documents_workspace_id ON documents (workspace_id);
