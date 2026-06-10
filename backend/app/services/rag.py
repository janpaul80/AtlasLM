import uuid
import json
import logging
import time
import re
from typing import List, Dict, Any, AsyncGenerator, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from ..models import DocumentChunk, Document, ChatMessage
from ..core.providers import provider_registry

# Configure logger
logger = logging.getLogger("atlaslm.rag")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter('[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s'))
if not logger.handlers:
    logger.addHandler(handler)

class RAGService:
    GREETING_PATTERN = re.compile(
        r"^\s*(hi|hello|hey|yo|howdy|good morning|good afternoon|good evening|thanks|thank you|thx)\s*[!.]*\s*$",
        re.IGNORECASE,
    )

    @classmethod
    def get_conversational_response(cls, user_message: str) -> str | None:
        normalized = user_message.strip().lower()
        if not normalized:
            return None

        if normalized in {"thanks", "thank you", "thx"}:
            return "You're welcome. I can help you analyze your sources whenever you're ready."

        if cls.GREETING_PATTERN.match(user_message):
            return "Hello. How can I help you with your research today?"

        return None

    def __init__(self, db: Session):
        self.db = db

    async def retrieve_relevant_chunks(
        self,
        workspace_id: uuid.UUID,
        query: str,
        provider_name: str = "langdock",
        top_k: int = 6
    ) -> List[Dict[str, Any]]:
        """
        Calculates search embedding and queries pgvector for the closest chunks within the workspace's documents.
        """
        logger.info(f"Retrieving context for query: '{query[:60]}...' (workspace: {workspace_id})")
        start_time = time.time()
        
        # 1. Embed query
        try:
            embedding_provider = provider_registry.get_embeddings(provider_name)
            query_vector = await embedding_provider.embed_query(query)
            embed_duration = time.time() - start_time
            logger.info(f"Generated search query vector using {provider_name} in {embed_duration:.2f}s")
        except Exception as e:
            logger.error(f"Failed to generate search vector for query using {provider_name}: {str(e)}", exc_info=True)
            raise e
        
        # 2. Convert vector to string representation for postgres pgvector matching
        vector_str = "[" + ",".join(map(str, query_vector)) + "]"
        
        # 3. Write semantic similarity search query matching pgvector cosine distance <=>
        db_start = time.time()
        sql_query = text("""
            SELECT 
                dc.id, 
                dc.content, 
                dc.page_number, 
                dc.chunk_index,
                d.id as document_id, 
                d.filename,
                (dc.embedding <=> :query_vector) as distance
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE d.workspace_id = :workspace_id
            ORDER BY distance ASC
            LIMIT :top_k
        """)
        
        try:
            results = self.db.execute(sql_query, {
                "query_vector": vector_str,
                "workspace_id": workspace_id,
                "top_k": top_k
            }).fetchall()
            db_duration = time.time() - db_start
            logger.info(f"pgvector query returned {len(results)} matches in {db_duration:.3f}s")
        except Exception as e:
            logger.error(f"pgvector Semantic Search Failure: {str(e)}", exc_info=True)
            raise e
        
        matched_chunks = []
        for idx, row in enumerate(results):
            score = 1.0 - float(row[6]) # Cosine similarity score
            logger.info(
                f"Match #{idx+1}: File='{row[5]}', Page={row[2]}, Distance={float(row[6]):.4f} (Score={score:.4f})"
            )
            matched_chunks.append({
                "chunk_id": row[0],
                "content": row[1],
                "page_number": row[2],
                "chunk_index": row[3],
                "document_id": row[4],
                "filename": row[5],
                "score": score
            })
            
        return matched_chunks

    def construct_system_prompt(self, chunks: List[Dict[str, Any]]) -> Tuple[str, Dict[str, Any]]:
        """
        Assembles the grounding system prompt with source documents, providing a mapping dictionary.
        """
        source_mapping = {}
        context_blocks = []
        
        for idx, chunk in enumerate(chunks):
            tag = f"source_{idx + 1}"
            source_mapping[tag] = {
                "tag": tag,
                "chunk_id": str(chunk["chunk_id"]),
                "document_id": str(chunk["document_id"]),
                "filename": chunk["filename"],
                "page_number": chunk["page_number"],
                "content": chunk["content"]
            }
            
            context_blocks.append(
                f"--- START SOURCE {tag} (File: {chunk['filename']}, Page: {chunk['page_number']}) ---\n"
                f"{chunk['content']}\n"
                f"--- END SOURCE {tag} ---"
            )
            
        context_str = "\n\n".join(context_blocks)
        
        system_prompt = (
            "You are AtlasLM, a highly professional, strictly source-grounded research AI assistant.\n"
            "Your singular mission is to answer user questions using ONLY the provided sources below.\n\n"
            "=== STRICTOR RULES ===\n"
            "1. NEVER hallucinate or use any knowledge outside the provided source blocks.\n"
            "2. If the answer is not fully present or cannot be directly inferred from the sources, "
            "reply exactly with: 'I could not find that information in the uploaded sources.' "
            "Do not make up facts or add general web knowledge under any circumstances.\n"
            "3. For every claim you make or sentence you write, you MUST attach the source tag identifier "
            "in brackets representing where you found the facts (e.g. [source_1] or [source_2]). "
            "If multiple sources apply, cite all (e.g. [source_1][source_3]). Cite at the end of clauses/sentences.\n"
            "4. NEVER mention tags that are not explicitly provided in the list.\n"
            "5. NO emojis. Use professional, clear engineering formatting.\n\n"
            f"=== RETRIEVED SOURCES ===\n{context_str}\n"
        )
        
        logger.info(f"Grounded prompt constructed with {len(chunks)} context sources.")
        return system_prompt, source_mapping

    async def execute_rag_chat_stream(
        self,
        workspace_id: uuid.UUID,
        session_id: uuid.UUID,
        user_message: str,
        provider_name: str = "langdock"
    ) -> AsyncGenerator[str, None]:
        """
        Coordinates RAG semantic retrieval and streams the grounded answer alongside citation metadata.
        """
        logger.info(f"Starting RAG chat stream for session: {session_id} in workspace: {workspace_id}")
        
        # 1. Save user message to database
        user_msg_record = ChatMessage(
            id=uuid.uuid4(),
            session_id=session_id,
            role="user",
            content=user_message
        )
        self.db.add(user_msg_record)
        self.db.commit()

        # 2. Lightweight conversational mode for greetings/thanks
        conversational_response = self.get_conversational_response(user_message)
        if conversational_response:
            yield f"event: data\ndata: {json.dumps({'type': 'chunk', 'content': conversational_response})}\n\n"
            assistant_msg = ChatMessage(
                id=uuid.uuid4(),
                session_id=session_id,
                role="assistant",
                content=conversational_response,
                citations=[]
            )
            self.db.add(assistant_msg)
            self.db.commit()
            yield "event: end\ndata: [DONE]\n\n"
            return

        # 3. Retrieve semantic context
        try:
            chunks = await self.retrieve_relevant_chunks(workspace_id, user_message, provider_name)
        except Exception as e:
            logger.error(f"RAG Aborted: Retrieval failed for session {session_id}: {str(e)}")
            yield f"event: error\ndata: {json.dumps({'error': 'Failed to retrieve context source chunks.'})}\n\n"
            return
        
        if not chunks:
            logger.warning(f"Grounding Failure: No sources available for workspace {workspace_id}. Replying with grounding fallback.")
            no_sources_resp = "I could not find that information in the uploaded sources (no documents ingested)."
            yield f"event: data\ndata: {json.dumps({'type': 'chunk', 'content': no_sources_resp})}\n\n"
            
            assistant_msg = ChatMessage(
                id=uuid.uuid4(),
                session_id=session_id,
                role="assistant",
                content=no_sources_resp,
                citations=[]
            )
            self.db.add(assistant_msg)
            self.db.commit()
            yield "event: end\ndata: [DONE]\n\n"
            return

        # 3. Construct system prompt & source maps
        system_prompt, source_mapping = self.construct_system_prompt(chunks)
        
        # Send citation map metadata to frontend first
        yield f"event: metadata\ndata: {json.dumps({'type': 'metadata', 'sources': source_mapping})}\n\n"
        
        # 4. Stream response from LLM
        try:
            llm = provider_registry.get_llm(provider_name)
            full_content = ""
            stream_start = time.time()
            chunk_count = 0
            
            logger.info(f"Requesting completions stream from {provider_name}...")
            async for chunk in llm.generate_stream(user_message, system_prompt):
                full_content += chunk
                chunk_count += 1
                yield f"event: data\ndata: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
            
            stream_duration = time.time() - stream_start
            logger.info(f"Stream finished. Delivered {chunk_count} tokens in {stream_duration:.2f}s using {provider_name}")
        except Exception as e:
            logger.error(f"LLM Provider Stream Error: {str(e)}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': f'Model streaming failed: {str(e)}'})}\n\n"
            return
            
        # 5. Extract citations actually used in the text to persist in database
        used_citations = []
        for tag, details in source_mapping.items():
            if tag in full_content:
                used_citations.append(details)
        logger.info(f"User response verified grounded. Verified {len(used_citations)} active source citations.")
                
        # 6. Save assistant message and actual citations to database
        try:
            assistant_msg = ChatMessage(
                id=uuid.uuid4(),
                session_id=session_id,
                role="assistant",
                content=full_content,
                citations=used_citations
            )
            self.db.add(assistant_msg)
            self.db.commit()
            logger.info(f"Persisted assistant chat completion with {len(used_citations)} citations.")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to save assistant chat message log: {str(e)}")
        
        yield "event: end\ndata: [DONE]\n\n"
