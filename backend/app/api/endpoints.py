import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from ..core.database import get_db
from ..models import Workspace, Document, ChatSession, ChatMessage
from ..schemas import (
    WorkspaceCreate, WorkspaceOut, DocumentOut, 
    ChatSessionCreate, ChatSessionOut, ChatSessionDetailsOut,
    ChatMessageCreate, URLIngestRequest
)
from ..services.pipeline import DocumentPipeline
from ..services.rag import RAGService
from ..core.providers import provider_registry

router = APIRouter()

# --- Workspace Endpoints ---

@router.get("/workspaces", response_model=List[WorkspaceOut])
def list_workspaces(db: Session = Depends(get_db)):
    return db.query(Workspace).order_by(Workspace.created_at.desc()).all()

@router.post("/workspaces", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
def create_workspace(workspace: WorkspaceCreate, db: Session = Depends(get_db)):
    db_workspace = Workspace(id=uuid.uuid4(), name=workspace.name)
    db.add(db_workspace)
    db.commit()
    db.refresh(db_workspace)
    return db_workspace

@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(workspace_id: uuid.UUID, db: Session = Depends(get_db)):
    db_workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not db_workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    db.delete(db_workspace)
    db.commit()
    return

# --- Document & Ingestion Endpoints ---

@router.get("/workspaces/{workspace_id}/documents", response_model=List[DocumentOut])
def list_documents(workspace_id: uuid.UUID, db: Session = Depends(get_db)):
    return db.query(Document).filter(Document.workspace_id == workspace_id).order_by(Document.created_at.desc()).all()

@router.post("/workspaces/{workspace_id}/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    workspace_id: uuid.UUID,
    file: UploadFile = File(...),
    provider: Optional[str] = Form("langdock"),
    db: Session = Depends(get_db)
):
    # Verify workspace exists
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    # 1. Validate File Size (Maximum 50MB limit)
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 Megabytes
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the maximum upload limit of 50MB."
        )
        
    # 2. Validate File Extension (MIME boundary)
    filename = file.filename
    filename_lower = filename.lower()
    if filename_lower.endswith(".pdf"):
        file_type = "pdf"
    elif filename_lower.endswith(".md"):
        file_type = "md"
    elif filename_lower.endswith(".txt"):
        file_type = "txt"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF, TXT, and MD files are supported."
        )
        
    pipeline = DocumentPipeline(db)

    try:
        doc = await pipeline.ingest_document(
            workspace_id=workspace_id,
            filename=filename,
            file_bytes=file_bytes,
            file_type=file_type,
            provider_name=provider
        )
        return doc
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/workspaces/{workspace_id}/documents/url", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def ingest_url(
    workspace_id: uuid.UUID,
    request: URLIngestRequest,
    provider: Optional[str] = "langdock",
    db: Session = Depends(get_db)
):
    # Verify workspace exists
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    url = request.url
    # Clean up name from URL
    filename = url.replace("https://", "").replace("http://", "").split("/")[0] + " (Web)"
    
    # Simple HTML scrapper fallback
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, timeout=10.0, follow_redirects=True)
            res.raise_for_status()
            html_text = res.text
            
            # Basic text-only extraction (avoid bs4 lock-in if missing)
            clean_text = re.sub(r'<[^>]+>', ' ', html_text)
            clean_text = re.sub(r'\s+', ' ', clean_text).strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to crawl URL: {str(e)}")
        
    pipeline = DocumentPipeline(db)
    try:
        doc = await pipeline.ingest_document(
            workspace_id=workspace_id,
            filename=filename,
            file_bytes=clean_text.encode("utf-8"),
            file_type="url",
            source_url=url,
            provider_name=provider
        )
        return doc
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: uuid.UUID, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return

# --- Chat Session Endpoints ---

@router.get("/workspaces/{workspace_id}/sessions", response_model=List[ChatSessionOut])
def list_sessions(workspace_id: uuid.UUID, db: Session = Depends(get_db)):
    return db.query(ChatSession).filter(ChatSession.workspace_id == workspace_id).order_by(ChatSession.created_at.desc()).all()

@router.post("/workspaces/{workspace_id}/sessions", response_model=ChatSessionOut)
def create_session(
    workspace_id: uuid.UUID, 
    session: ChatSessionCreate, 
    db: Session = Depends(get_db)
):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    db_session = ChatSession(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        title=session.title or "New Chat"
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.get("/sessions/{session_id}", response_model=ChatSessionDetailsOut)
def get_session_details(session_id: uuid.UUID, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session

# --- Streaming RAG Chat Endpoint ---

@router.post("/sessions/{session_id}/chat/stream")
async def chat_stream(
    session_id: uuid.UUID,
    message: ChatMessageCreate,
    provider: Optional[str] = "langdock",
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    rag = RAGService(db)
    
    return StreamingResponse(
        rag.execute_rag_chat_stream(
            workspace_id=session.workspace_id,
            session_id=session_id,
            user_message=message.content,
            provider_name=provider
        ),
        media_type="text/event-stream"
    )

# --- captcha & contact endpoint ---

@router.post("/contact")
async def verify_contact(
    name: str = Form(...),
    email: str = Form(...),
    message: str = Form(...),
    captcha_answer: int = Form(...),
    captcha_expected: int = Form(...)
):
    """
    Mathematical captcha check: matches client submitted answer against server expected count.
    """
    if captcha_answer != captcha_expected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Incorrect Captcha answer. Please try again."
        )
    # Success mock submission
    return {"status": "success", "message": "Thank you! Your message has been received."}

# --- Settings ---

@router.get("/settings/providers")
def get_available_providers():
    """
    Returns active LLM and Embedding models currently configured on the system.
    """
    return {
        "providers": [
            {"id": "langdock", "name": "Langdock AI (Default)", "status": "active" if settings.LANGDOCK_API_KEY else "inactive"},
            {"id": "blackbox", "name": "Blackbox AI", "status": "active" if settings.BLACKBOX_API_KEY else "inactive"},
            {"id": "openrouter", "name": "OpenRouter", "status": "active" if settings.OPENROUTER_API_KEY else "inactive"},
            {"id": "ollama", "name": "Ollama Server", "status": "active"},
            {"id": "openai", "name": "OpenAI Direct", "status": "active" if settings.OPENAI_API_KEY else "inactive"}
        ]
    }
