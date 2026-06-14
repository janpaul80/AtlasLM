# AtlasLM Patch 002 — DOCX + CSV Ingestion

## New file (drop-in)
`backend/app/services/parsers.py` — DOCX and CSV extraction. Tested:
DOCX paragraphs + tables preserved, synthetic sections for citations;
CSV header-aware row serialization (each row keeps column names), delimiter
sniffing (comma/semicolon/tab/pipe), encoding fallback, 50 rows per section.

## Dependency
Add to `backend/requirements.txt`:
```
python-docx==1.1.2
```
(CSV uses stdlib only — no new dependency.)

## Edit 1 — `backend/app/services/pipeline.py` (ingest_document, step 1 "Parse")
Replace the parse branch with:

```python
        from .parsers import extract_text_from_docx, extract_text_from_csv

        ft = file_type.lower()
        if ft == "pdf":
            pages_data = self.extract_text_from_pdf(file_bytes, filename)
        elif ft == "docx":
            pages_data = extract_text_from_docx(file_bytes, filename)
        elif ft == "csv":
            pages_data = extract_text_from_csv(file_bytes, filename)
        else:
            pages_data = self.extract_text_from_txt_or_md(file_bytes, filename)
```
(Move the import to the top of the file with the other imports.)

## Edit 2 — `backend/app/api/endpoints.py` (upload_document)
Extend the extension check:

```python
    if filename_lower.endswith(".pdf"):
        file_type = "pdf"
    elif filename_lower.endswith(".md"):
        file_type = "md"
    elif filename_lower.endswith(".txt"):
        file_type = "txt"
    elif filename_lower.endswith(".docx"):
        file_type = "docx"
    elif filename_lower.endswith(".csv"):
        file_type = "csv"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Supported: PDF, DOCX, TXT, MD, CSV.",
        )
```

## Edit 3 — Frontend upload component
Update the file input accept attribute:
```
accept=".pdf,.txt,.md,.docx,.csv"
```
and any UI copy listing supported formats.

## Rebuild
```bash
docker-compose up -d --build backend
```

## Verification (PASS/FAIL)
- [ ] Upload .docx with text + a table -> ingests; ask about table content -> grounded answer with citation
- [ ] Citation drawer for DOCX shows section number + correct text
- [ ] Upload .csv (>50 rows) -> ingests; ask "what is the revenue for X?" -> answer cites the right rows
- [ ] Upload .csv with semicolons -> parses correctly
- [ ] Upload empty/corrupt .docx -> clean 422 error, no stack trace
- [ ] Existing PDF/TXT/MD uploads still work (regression)
