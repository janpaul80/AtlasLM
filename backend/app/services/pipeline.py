import fitz  # PyMuPDF
import re
import uuid
import logging
import asyncio
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from ..models import Document, DocumentChunk
from ..core.providers import provider_registry

# Configure logger
logger = logging.getLogger("atlaslm.ingestion")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter('[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s'))
if not logger.handlers:
    logger.addHandler(handler)

class DocumentPipeline:
    def __init__(self, db: Session):
        self.db = db

    def extract_text_from_pdf(self, file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        """
        Parses a PDF using PyMuPDF (fitz), returning list of dicts with text and page numbers (1-indexed).
        """
        logger.info(f"Starting PDF text extraction for file: {filename} (size: {len(file_bytes)} bytes)")
        pages_content = []
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            page_count = len(doc)
            logger.info(f"Successfully opened {filename}. Total pages to process: {page_count}")
            
            for page_num in range(page_count):
                page = doc.load_page(page_num)
                text = page.get_text("text")
                logger.debug(f"Extracted page {page_num + 1}/{page_count} - length: {len(text)} chars")
                pages_content.append({
                    "page_number": page_num + 1,
                    "content": text,
                })
            doc.close()
            logger.info(f"Completed PDF parsing for {filename}. Extracted {len(pages_content)} pages.")
        except Exception as e:
            logger.error(f"PDF Parser Failure for {filename}: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to parse PDF {filename}: {str(e)}")
        return pages_content

    def extract_text_from_txt_or_md(self, file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        """
        Parses TXT/MD files, returning a list with a single page content block.
        """
        logger.info(f"Starting text extraction for TXT/MD file: {filename}")
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
            logger.info(f"Successfully loaded text document: {filename} - length: {len(text)} chars")
            return [{"page_number": 1, "content": text}]
        except Exception as e:
            logger.error(f"Text Parser Failure for {filename}: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to parse text document: {str(e)}")

    def recursive_chunk_text(
        self, 
        pages: List[Dict[str, Any]], 
        chunk_size: int = 800, 
        chunk_overlap: int = 150
    ) -> List[Dict[str, Any]]:
        """
        Splits pages of text into overlapping chunks, maintaining character and page lineage.
        """
        logger.info(f"Initializing text chunking: size={chunk_size}, overlap={chunk_overlap}")
        chunks = []
        chunk_idx = 0
        separators = ["\n\n", "\n", " ", ""]
        
        for page_data in pages:
            page_num = page_data["page_number"]
            text = page_data["content"]
            pos = 0
            text_len = len(text)
            
            if text_len == 0:
                continue
                
            while pos < text_len:
                end_pos = min(pos + chunk_size, text_len)
                
                if end_pos < text_len:
                    split_found = False
                    for sep in separators:
                        if sep == "":
                            continue
                        search_start = max(pos, end_pos - chunk_overlap)
                        last_sep = text.rfind(sep, search_start, end_pos)
                        if last_sep != -1:
                            end_pos = last_sep + len(sep)
                            split_found = True
                            break
                    if not split_found:
                        end_pos = pos + chunk_size
                
                chunk_text = text[pos:end_pos].strip()
                if chunk_text:
                    chunks.append({
                        "content": chunk_text,
                        "page_number": page_num,
                        "chunk_index": chunk_idx,
                        "char_start": pos,
                        "char_end": end_pos
                    })
                    chunk_idx += 1
                
                pos = max(end_pos - chunk_overlap, pos + 1)
                if end_pos >= text_len:
                    break
                    
        logger.info(f"Chunking complete. Created {len(chunks)} overlapping document chunks.")
        return chunks

    async def generate_embeddings_with_retry(
        self, 
        contents: List[str], 
        provider_name: str, 
        max_retries: int = 3
    ) -> List[List[float]]:
        """
        Calls the embedding provider registry with automatic backoff retry checks.
        """
        embedding_provider = provider_registry.get_embeddings(provider_name)
        retries = 0
        delay = 1.0 # Initial backoff delay in seconds

        while retries < max_retries:
            try:
                logger.info(f"Generating embeddings using {provider_name} (batch size: {len(contents)})...")
                # Call embedding API
                embeddings = await embedding_provider.embed_documents(contents)
                logger.info(f"Successfully generated vectors for {len(contents)} chunks.")
                return embeddings
            except Exception as e:
                retries += 1
                logger.warning(
                    f"Embedding Failure (Attempt {retries}/{max_retries}) using {provider_name}: {str(e)}. "
                    f"Retrying in {delay}s..."
                )
                if retries >= max_retries:
                    logger.error(f"Critical Embedding Generation Failure after {max_retries} attempts: {str(e)}", exc_info=True)
                    raise e
                await asyncio.sleep(delay)
                delay *= 2.0 # Exponential backoff

        return [[0.0] * 1536 for _ in contents]

    async def ingest_document(
        self,
        workspace_id: uuid.UUID,
        filename: str,
        file_bytes: bytes,
        file_type: str, # 'pdf', 'txt', 'md', 'url'
        source_url: Optional[str] = None,
        provider_name: str = "langdock",
        chunk_size: int = 800,
        chunk_overlap: int = 150
    ) -> Document:
        """
        Ingests a document, chunks it, generates vector embeddings, and persists all elements.
        """
        logger.info(f"Initiating document ingestion for '{filename}' in workspace: {workspace_id}")
        
        # 1. Parse text depending on type
        try:
            if file_type.lower() == "pdf":
                pages_data = self.extract_text_from_pdf(file_bytes, filename)
            else:
                pages_data = self.extract_text_from_txt_or_md(file_bytes, filename)
        except Exception as e:
            logger.error(f"Ingestion Aborted: Document parsing failed for '{filename}': {str(e)}")
            raise e
            
        # 2. Chunk text
        chunks_data = self.recursive_chunk_text(
            pages_data, 
            chunk_size=chunk_size, 
            chunk_overlap=chunk_overlap
        )
        
        # 3. Create document record
        document = Document(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            filename=filename,
            file_type=file_type,
            source_url=source_url
        )
        self.db.add(document)
        self.db.flush()
        
        # 4. Generate embeddings and create chunk records
        if chunks_data:
            contents = [c["content"] for c in chunks_data]
            try:
                # Generate embeddings with backoff checks
                embeddings = await self.generate_embeddings_with_retry(
                    contents=contents, 
                    provider_name=provider_name
                )
                
                logger.info(f"Inserting {len(chunks_data)} vectors in database...")
                for idx, chunk_info in enumerate(chunks_data):
                    chunk = DocumentChunk(
                        id=uuid.uuid4(),
                        document_id=document.id,
                        content=chunk_info["content"],
                        embedding=embeddings[idx],
                        page_number=chunk_info["page_number"],
                        chunk_index=chunk_info["chunk_index"],
                        char_start=chunk_info["char_start"],
                        char_end=chunk_info["char_end"]
                    )
                    self.db.add(chunk)
                logger.info("Successfully persisted chunks and vector embeddings.")
            except Exception as e:
                self.db.rollback()
                logger.error(f"Ingestion Rollback: Failed to generate/store embeddings for '{filename}': {str(e)}")
                raise ValueError(f"Failed to generate embeddings: {str(e)}")
                
        self.db.commit()
        self.db.refresh(document)
        logger.info(f"Ingestion successful! Document '{filename}' is grounded under ID: {document.id}")
        return document
