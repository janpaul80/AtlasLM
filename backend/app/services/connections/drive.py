# backend/app/services/connections/drive.py
"""Fetch picked Drive files and route their bytes into the existing ingest pipeline.

The user picks files in the browser via the Google Picker (drive.file scope), so
we already have the file ids and a fresh access token. For each id we read its
metadata, download (native Google types are exported to a portable format), then
hand the bytes to the EXISTING Patch-003 loaders by file extension. Sheets export
as .xlsx so they ingest as structured tables, not flattened text.

Network failures on a single file never abort the batch: that file is marked
failed and the rest continue.
"""
from __future__ import annotations
import os
import logging
from dataclasses import dataclass, field
from typing import List, Optional

import httpx

log = logging.getLogger("connections.drive")

FILES_API = "https://www.googleapis.com/drive/v3/files"
HTTP_TIMEOUT = float(os.getenv("ATLAS_CONN_HTTP_TIMEOUT", "30"))

# Native Google types -> (export mime, extension) for the existing loaders.
EXPORT_MAP = {
    "application/vnd.google-apps.document":
        ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"),
    "application/vnd.google-apps.spreadsheet":
        ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"),
    "application/vnd.google-apps.presentation":
        ("application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"),
}
# Already-portable types we download as-is.
BINARY_OK = {".pdf", ".docx", ".xlsx", ".pptx", ".csv"}


@dataclass
class PickedFile:
    id: str
    name: str
    kind: str               # user-facing: Doc | Sheet | Slides | PDF | File
    ok: bool = False
    block_count: int = 0
    error: Optional[str] = None
    source_id: Optional[str] = None


def _label(mime: str, name: str) -> str:
    if mime == "application/vnd.google-apps.document": return "Doc"
    if mime == "application/vnd.google-apps.spreadsheet": return "Sheet"
    if mime == "application/vnd.google-apps.presentation": return "Slides"
    if name.lower().endswith(".pdf") or mime == "application/pdf": return "PDF"
    return "File"


class DriveConnector:
    def __init__(self, access_token: str) -> None:
        self._h = {"Authorization": f"Bearer {access_token}"}

    def metadata(self, file_id: str) -> dict:
        with httpx.Client(timeout=HTTP_TIMEOUT) as c:
            r = c.get(f"{FILES_API}/{file_id}",
                      params={"fields": "id,name,mimeType,size", "supportsAllDrives": "true"},
                      headers=self._h)
        if r.status_code != 200:
            raise ValueError(f"Could not read file metadata ({r.status_code}).")
        return r.json()

    def download(self, meta: dict) -> tuple[bytes, str]:
        """Return (bytes, extension) ready for the existing loaders."""
        mime = meta.get("mimeType", "")
        name = meta.get("name", "file")
        with httpx.Client(timeout=HTTP_TIMEOUT, follow_redirects=True) as c:
            if mime in EXPORT_MAP:
                export_mime, ext = EXPORT_MAP[mime]
                r = c.get(f"{FILES_API}/{meta['id']}/export",
                          params={"mimeType": export_mime}, headers=self._h)
            else:
                ext = os.path.splitext(name)[1].lower() or ".pdf"
                r = c.get(f"{FILES_API}/{meta['id']}",
                          params={"alt": "media", "supportsAllDrives": "true"},
                          headers=self._h)
        if r.status_code != 200:
            raise ValueError(f"Could not download file ({r.status_code}).")
        return r.content, ext

    def ingest_one(self, file_id: str, *, workspace_id: str, persist) -> PickedFile:
        """Fetch one picked file and route it through the existing ingest pipeline.

        `persist(workspace_id, filename, ext, raw_bytes) -> (source_id, block_count)`
        is supplied by the route so this stays decoupled from project internals.
        """
        try:
            meta = self.metadata(file_id)
        except Exception as e:
            return PickedFile(id=file_id, name=file_id, kind="File", error=str(e))
        pf = PickedFile(id=file_id, name=meta.get("name", file_id),
                        kind=_label(meta.get("mimeType", ""), meta.get("name", "")))
        try:
            raw, ext = self.download(meta)
            source_id, blocks = persist(workspace_id, pf.name, ext, raw)
            pf.ok, pf.source_id, pf.block_count = True, source_id, blocks
        except Exception as e:
            log.warning("ingest failed for %s: %s", file_id, e)
            pf.error = str(e)
        return pf

    def ingest_many(self, file_ids: List[str], *, workspace_id: str, persist) -> List[PickedFile]:
        return [self.ingest_one(fid, workspace_id=workspace_id, persist=persist) for fid in file_ids]
