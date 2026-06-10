from pydantic import BaseModel, Field
from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime

# Workspace schemas
class WorkspaceBase(BaseModel):
    name: str

class WorkspaceCreate(WorkspaceBase):
    pass

class WorkspaceUpdate(WorkspaceBase):
    pass

class WorkspaceOut(WorkspaceBase):
    id: UUID
    created_at: datetime
    user_id: Optional[str] = None
    
    class Config:
        from_attributes = True

# Document schemas
class DocumentOut(BaseModel):
    id: UUID
    workspace_id: UUID
    filename: str
    file_type: str
    source_url: Optional[str] = None
    status: str = "ready"
    error_message: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Document Chunk details (for citations)
class CitationChunk(BaseModel):
    chunk_id: UUID
    document_id: UUID
    filename: str
    page_number: Optional[int] = None
    content: str
    score: Optional[float] = None

# ChatMessage schemas
class ChatMessageBase(BaseModel):
    role: str
    content: str

class ChatMessageCreate(BaseModel):
    content: str

class ChatMessageOut(ChatMessageBase):
    id: UUID
    session_id: UUID
    citations: Optional[List[Any]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# ChatSession schemas
class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Chat"

class ChatSessionOut(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChatSessionDetailsOut(ChatSessionOut):
    messages: List[ChatMessageOut] = []
    
    class Config:
        from_attributes = True

# Ingestion URL Schema
class URLIngestRequest(BaseModel):
    url: str
    provider: Optional[str] = None

class TextIngestRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    content: str = Field(..., min_length=1)
    provider: Optional[str] = None
