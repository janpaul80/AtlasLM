# backend/app/services/ingest/xlsx_loader.py
"""Excel/CSV loader -> per-sheet row text. Requires openpyxl + pandas."""
from __future__ import annotations
from typing import List
import os
import pandas as pd
from .base import ExtractedBlock, block


def load_spreadsheet(path: str) -> List[ExtractedBlock]:
    blocks: List[ExtractedBlock] = []
    ext = os.path.splitext(path)[1].lower()
    if ext == ".csv":
        sheets = {"Sheet1": pd.read_csv(path)}
    else:
        sheets = pd.read_excel(path, sheet_name=None)  # all sheets
    for name, df in sheets.items():
        df = df.fillna("")
        header = " | ".join(str(c) for c in df.columns)
        if header.strip():
            blocks.append(block(f"Columns: {header}", sheet=name))
        for _, row in df.iterrows():
            cells = [f"{col}: {val}" for col, val in row.items() if str(val).strip()]
            if cells:
                blocks.append(block(" | ".join(cells), sheet=name))
    return blocks
