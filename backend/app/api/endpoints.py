import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import re

from ..core.database import get_db
from ..core.config import settings
from ..models import Workspace, Document, ChatSession, ChatMessage
from ..schemas import (
    WorkspaceCreate, WorkspaceOut, DocumentOut, 
    ChatSessionCreate, ChatSessionOut, ChatSessionDetailsOut,
    ChatMessageCreate, URLIngestRequest, TextIngestRequest
)
from ..services.pipeline import DocumentPipeline
from ..services.rag import RAGService
from ..core.providers import provider_registry, ProviderError
from ..services.jobs import enqueue_ingestion_job, enqueue_studio_job, redis_healthy
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.encoders import jsonable_encoder
from ..services.studio import StudioService, OUTPUT_TYPES
from ..models import StudioOutput
from ..schemas import StudioOutputCreate, StudioOutputOut


router = APIRouter()

# ── Helpers ──────────────────────────────────────────────────────────────────

def current_user_id(request: Request) -> str:
    """Extract the authenticated user's sub claim from the request state."""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    uid = getattr(user, "sub", None) or user.get("sub") if isinstance(user, dict) else None
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing sub claim"
        )
    return uid


def _get_owned_workspace(workspace_id: uuid.UUID, user_id: str, db: Session) -> Workspace:
    """Fetch a workspace owned by this user, or raise 404."""
    ws = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == user_id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


# ── Workspace Endpoints ───────────────────────────────────────────────────────

@router.get("/workspaces", response_model=List[WorkspaceOut])
def list_workspaces(request: Request, db: Session = Depends(get_db)):
    """Return only workspaces owned by the authenticated user."""
    uid = current_user_id(request)
    return (
        db.query(Workspace)
        .filter(Workspace.user_id == uid)
        .order_by(Workspace.created_at.desc())
        .all()
    )


@router.post("/workspaces", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
def create_workspace(
    request: Request,
    workspace: WorkspaceCreate,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    db_workspace = Workspace(id=uuid.uuid4(), name=workspace.name, user_id=uid)
    db.add(db_workspace)
    db.commit()
    db.refresh(db_workspace)
    return db_workspace


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    request: Request,
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    # Fetch the workspace owned by this user or raise 404, then delete it.
    workspace = _get_owned_workspace(workspace_id, uid, db)
    db.delete(workspace)
    db.commit()
    return


# ── Document & Ingestion Endpoints ───────────────────────────────────────────

@router.get("/workspaces/{workspace_id}/documents", response_model=List[DocumentOut])
def list_documents(
    request: Request,
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    _get_owned_workspace(workspace_id, uid, db)
    return (
        db.query(Document)
        .filter(Document.workspace_id == workspace_id)
        .order_by(Document.created_at.desc())
        .all()
    )


@router.get("/documents/{document_id}/status")
def get_document_status(
    request: Request,
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Poll ingestion status for a single document."""
    uid = current_user_id(request)
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        _get_owned_workspace(doc.workspace_id, uid, db)
    except HTTPException as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail="Document not found")
        raise
    return {
        "id": str(doc.id),
        "status": doc.status,
        "error_message": doc.error_message,
    }


@router.post(
    "/workspaces/{workspace_id}/documents",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    request: Request,
    workspace_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    _get_owned_workspace(workspace_id, uid, db)

    # Validate file size (50 MB limit)
    MAX_FILE_SIZE = 50 * 1024 * 1024
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the maximum upload limit of 50MB.",
        )

    filename = file.filename
    filename_lower = filename.lower()
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
    elif filename_lower.endswith(".xlsx"):
        file_type = "xlsx"
    elif filename_lower.endswith(".pptx"):
        file_type = "pptx"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Supported: PDF, DOCX, XLSX, PPTX, TXT, MD, CSV.",
        )

    pipeline = DocumentPipeline(db)

    # Async path: create placeholder doc, enqueue job, return 202.
    if redis_healthy():
        doc = pipeline.create_pending_document(
            workspace_id=workspace_id,
            filename=filename,
            file_type=file_type,
        )
        try:
            enqueue_ingestion_job(
                document_id=doc.id,
                workspace_id=workspace_id,
                filename=filename,
                file_type=file_type,
                file_bytes=file_bytes,
            )
        except Exception:
            # Queue push failed after doc creation - fall back to sync.
            db.delete(doc)
            db.commit()
        else:
            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content=jsonable_encoder(DocumentOut.model_validate(doc)),
            )

    # Sync fallback (Redis down): original behavior.
    try:
        doc = await pipeline.ingest_document(
            workspace_id=workspace_id,
            filename=filename,
            file_bytes=file_bytes,
            file_type=file_type,
        )
        return doc
    except ProviderError as e:
        raise HTTPException(status_code=503, detail=e.public_message)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/workspaces/{workspace_id}/documents/url",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
)
async def ingest_url(
    request: Request,
    workspace_id: uuid.UUID,
    body: URLIngestRequest,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    _get_owned_workspace(workspace_id, uid, db)

    url = str(body.url).strip()
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    filename = url.replace("https://", "").replace("http://", "").split("/")[0] + " (Web)"

    import httpx
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                url,
                timeout=15.0,
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; AtlasLM/1.0; +https://atlaslm.app)",
                    "Accept": "text/html,application/xhtml+xml",
                },
            )
            res.raise_for_status()
            content_type = res.headers.get("content-type", "")
            if "text/html" not in content_type and "xml" not in content_type and content_type:
                raise HTTPException(
                    status_code=422,
                    detail="The URL did not return a web page. Only HTML pages are supported for now.",
                )
            html_text = res.text
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="AtlasLM could not reach that URL. Check the address and try again.",
        )

    MAX_HTML_SIZE = 10 * 1024 * 1024
    html_bytes = html_text.encode("utf-8")[:MAX_HTML_SIZE]

    pipeline = DocumentPipeline(db)

    # Async path (same pattern as upload_document)
    if redis_healthy():
        doc = pipeline.create_pending_document(
            workspace_id=workspace_id,
            filename=filename,
            file_type="url",
            source_url=url,
        )
        try:
            enqueue_ingestion_job(
                document_id=doc.id,
                workspace_id=workspace_id,
                filename=filename,
                file_type="url",
                file_bytes=html_bytes,
                source_url=url,
            )
        except Exception:
            db.delete(doc)
            db.commit()
        else:
            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content=jsonable_encoder(DocumentOut.model_validate(doc)),
            )

    # Sync fallback
    try:
        doc = await pipeline.ingest_document(
            workspace_id=workspace_id,
            filename=filename,
            file_bytes=html_bytes,
            file_type="url",
            source_url=url,
        )
        return doc
    except ProviderError as e:
        raise HTTPException(status_code=503, detail=e.public_message)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/workspaces/{workspace_id}/documents/text",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
)
async def ingest_text(
    request: Request,
    workspace_id: uuid.UUID,
    body: TextIngestRequest,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    _get_owned_workspace(workspace_id, uid, db)

    title = body.title.strip()
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Pasted text content cannot be empty.")

    MAX_TEXT_SIZE = 2 * 1024 * 1024
    file_bytes = content.encode("utf-8")
    if len(file_bytes) > MAX_TEXT_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pasted text exceeds the maximum limit of 2MB.",
        )

    pipeline = DocumentPipeline(db)
    try:
        doc = await pipeline.ingest_document(
            workspace_id=workspace_id,
            filename=f"{title} (Pasted Text)",
            file_bytes=file_bytes,
            file_type="text",
        )
        return doc
    except ProviderError as e:
        raise HTTPException(status_code=503, detail=e.public_message)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    request: Request,
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Verify ownership via workspace, but do not leak workspace existence.
    try:
        _get_owned_workspace(doc.workspace_id, uid, db)
    except HTTPException as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail="Document not found")
        raise
    db.delete(doc)
    db.commit()
    return


# ── Chat Session Endpoints ────────────────────────────────────────────────────

@router.get("/workspaces/{workspace_id}/sessions", response_model=List[ChatSessionOut])
def list_sessions(
    request: Request,
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    _get_owned_workspace(workspace_id, uid, db)
    return (
        db.query(ChatSession)
        .filter(ChatSession.workspace_id == workspace_id)
        .order_by(ChatSession.created_at.desc())
        .all()
    )


@router.post("/workspaces/{workspace_id}/sessions", response_model=ChatSessionOut)
def create_session(
    request: Request,
    workspace_id: uuid.UUID,
    session: ChatSessionCreate,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    _get_owned_workspace(workspace_id, uid, db)

    db_session = ChatSession(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        title=session.title or "New Chat",
        user_id=uid,
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@router.get("/sessions/{session_id}", response_model=ChatSessionDetailsOut)
def get_session_details(
    request: Request,
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    # Verify ownership via the owning workspace but do not leak workspace existence.
    try:
        _get_owned_workspace(session.workspace_id, uid, db)
    except HTTPException as exc:
        if exc.status_code == 404:
            # Either the workspace does not exist or it is not owned by this user.
            raise HTTPException(status_code=404, detail="Chat session not found")
        raise
    return session


# ── Streaming RAG Chat Endpoint ───────────────────────────────────────────────

@router.post("/sessions/{session_id}/chat/stream")
async def chat_stream(
    request: Request,
    session_id: uuid.UUID,
    message: ChatMessageCreate,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    # Verify ownership via the owning workspace but do not leak workspace existence.
    try:
        _get_owned_workspace(session.workspace_id, uid, db)
    except HTTPException as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail="Chat session not found")
        raise

    rag = RAGService(db)
    return StreamingResponse(
        rag.execute_rag_chat_stream(
            workspace_id=session.workspace_id,
            session_id=session_id,
            user_message=message.content,
        ),
        media_type="text/event-stream",
    )


# ── Contact / Captcha ─────────────────────────────────────────────────────────

@router.post("/contact")
async def verify_contact(
    name: str = Form(...),
    email: str = Form(...),
    message: str = Form(...),
    captcha_answer: int = Form(...),
    captcha_expected: int = Form(...),
):
    """Mathematical captcha check."""
    if captcha_answer != captcha_expected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect Captcha answer. Please try again.",
        )
    return {"status": "success", "message": "Thank you! Your message has been received."}


# ── Settings ──────────────────────────────────────────────────────────────────

@router.get("/settings/providers")
def get_available_providers():
    """Returns AtlasLM engine availability. Internal provider names are never exposed."""
    cloud_active = bool(
        settings.LANGDOCK_API_KEY
        or settings.OPENROUTER_API_KEY
        or settings.OPENAI_API_KEY
        or settings.BLACKBOX_API_KEY
    )
    return {
        "providers": [
            {"id": "atlas-cloud", "name": "AtlasLM Cloud Engine",
             "status": "active" if cloud_active else "inactive"},
            {"id": "atlas-local", "name": "AtlasLM Local Engine",
             "status": "active"},
        ]
    }


# ── AtlasLM Studio Endpoints ────────────────────────────────────────────────

@router.get("/studio/types")
def list_studio_types():
    """Available Studio output types (drives the frontend Studio panel)."""
    return {
        "types": [
            {"id": k, "label": v["label"]} for k, v in OUTPUT_TYPES.items()
        ]
    }


@router.get(
    "/workspaces/{workspace_id}/studio",
    response_model=List[StudioOutputOut],
)
def list_studio_outputs(
    request: Request,
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    _get_owned_workspace(workspace_id, uid, db)
    return (
        db.query(StudioOutput)
        .filter(StudioOutput.workspace_id == workspace_id)
        .order_by(StudioOutput.created_at.desc())
        .all()
    )


@router.post(
    "/workspaces/{workspace_id}/studio",
    response_model=StudioOutputOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_studio_output(
    request: Request,
    workspace_id: uuid.UUID,
    body: StudioOutputCreate,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    ws = _get_owned_workspace(workspace_id, uid, db)

    if body.output_type not in OUTPUT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown output type. Supported: {', '.join(OUTPUT_TYPES)}.",
        )

    ready_docs = (
        db.query(Document)
        .filter(Document.workspace_id == workspace_id, Document.status == "ready")
        .count()
    )
    if ready_docs == 0:
        raise HTTPException(
            status_code=400,
            detail="Add at least one source to this notebook before generating "
                   "a Studio output.",
        )

    spec = OUTPUT_TYPES[body.output_type]
    out = StudioOutput(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        output_type=body.output_type,
        title=body.title or spec["title_template"].format(workspace=ws.name),
        document_ids=[str(d) for d in body.document_ids] if body.document_ids else None,
        status="pending",
    )
    db.add(out)
    db.commit()
    db.refresh(out)

    # Async path
    if redis_healthy():
        try:
            enqueue_studio_job(output_id=out.id, workspace_id=workspace_id)
        except Exception:
            pass  # fall through to sync
        else:
            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content=jsonable_encoder(StudioOutputOut.model_validate(out)),
            )

    # Sync fallback (Redis down): generate inline.
    service = StudioService(db)
    out = await service.generate(out.id)
    if out.status == "failed":
        raise HTTPException(status_code=422, detail=out.error_message)
    return out


@router.get("/studio/{output_id}", response_model=StudioOutputOut)
def get_studio_output(
    request: Request,
    output_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    out = db.query(StudioOutput).filter(StudioOutput.id == output_id).first()
    if not out:
        raise HTTPException(status_code=404, detail="Studio output not found")
    try:
        _get_owned_workspace(out.workspace_id, uid, db)
    except HTTPException as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail="Studio output not found")
        raise
    return out


@router.delete("/studio/{output_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_studio_output(
    request: Request,
    output_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    uid = current_user_id(request)
    out = db.query(StudioOutput).filter(StudioOutput.id == output_id).first()
    if not out:
        raise HTTPException(status_code=404, detail="Studio output not found")
    try:
        _get_owned_workspace(out.workspace_id, uid, db)
    except HTTPException as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail="Studio output not found")
        raise
    db.delete(out)
    db.commit()
    return

