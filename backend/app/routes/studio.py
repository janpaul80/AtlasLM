# backend/app/routes/studio.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List

from app.services.studio import generate_studio_output, STUDIO_SPECS

# NOTE TO DEV TEAM: confirm this import path matches the existing Supabase JWT
# dependency. If it lives elsewhere (e.g. app.deps), update this import.
from app.auth import get_current_user

router = APIRouter(prefix="/api/studio", tags=["studio"])


class StudioRequest(BaseModel):
    notebook_id: str
    source_ids: List[str] = []


@router.get("/types")
def list_types():
    return {"types": list(STUDIO_SPECS.keys())}


@router.post("/{output_type}")
def create_output(output_type: str, body: StudioRequest, user=Depends(get_current_user)):
    if output_type not in STUDIO_SPECS:
        raise HTTPException(status_code=404, detail="Unknown output type")
    try:
        return generate_studio_output(
            notebook_id=body.notebook_id,
            output_type=output_type,
            source_ids=body.source_ids,
        )
    except Exception:
        # Never leak provider/internal errors to the client
        raise HTTPException(
            status_code=502,
            detail="AtlasLM Engine could not generate this output. Please retry.",
        )
