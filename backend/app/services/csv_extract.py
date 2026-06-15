"""AtlasLM Patch 007: CSV extraction service.

Treats a CSV as a single-sheet table, mirroring the XLSX path from Patch 005.
Each row is anchored so chunks keep their row reference for citations.

Robust to delimiter (comma/semicolon/tab) and to encoding. No network.
"""
from __future__ import annotations
import csv
import io


class CsvExtractError(Exception):
    """User-facing message, safe to display. No tracebacks leak to client."""


def _decode(file_bytes: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return file_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("utf-8", errors="replace")


def extract_csv_markdown(file_bytes: bytes) -> str:
    text = _decode(file_bytes)
    if not text.strip():
        raise CsvExtractError("This CSV file is empty.")

    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        class _D(csv.Dialect):
            delimiter = ","; quotechar = '"'; doublequote = True
            skipinitialspace = True; lineterminator = "\n"
            quoting = csv.QUOTE_MINIMAL
        dialect = _D()

    reader = csv.reader(io.StringIO(text), dialect)
    rows = [r for r in reader if any(cell.strip() for cell in r)]
    if not rows:
        raise CsvExtractError("This CSV file has no readable rows.")

    header = rows[0]
    ncols = len(header)
    lines: list[str] = []
    lines.append("| " + " | ".join(h.strip() for h in header) + " |")
    lines.append("| " + " | ".join("---" for _ in header) + " |")
    for r in rows[1:]:
        # pad/truncate ragged rows to header width
        cells = (r + [""] * ncols)[:ncols]
        lines.append("| " + " | ".join(c.strip().replace("\n", " ") for c in cells) + " |")

    return "\n".join(lines)
