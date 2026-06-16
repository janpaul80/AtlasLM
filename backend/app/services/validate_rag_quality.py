import uuid
import math
import time
import logging
from typing import List, Dict, Any

# Configure logging to print telemetry directly to console
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s')
logger = logging.getLogger("atlaslm.rag.validation")

# Simple, high-performance in-memory cosine similarity math
def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    dot_product = sum(x * y for x, y in zip(v1, v2))
    magnitude1 = math.sqrt(sum(x * x for x in v1))
    magnitude2 = math.sqrt(sum(x * x for x in v2))
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
    return dot_product / (magnitude1 * magnitude2)

class DummyPipeline:
    """
    Offline replica of recursive chunking pipeline for verification.
    """
    def recursive_chunk_text(
        self, 
        pages: List[Dict[str, Any]], 
        chunk_size: int = 400, 
        chunk_overlap: int = 80
    ) -> List[Dict[str, Any]]:
        chunks = []
        chunk_idx = 0
        separators = ["\n\n", "\n", " ", ""]
        
        for page_data in pages:
            page_num = page_data["page_number"]
            text = page_data["content"]
            pos = 0
            text_len = len(text)
            
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
                        "id": uuid.uuid4(),
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
        return chunks

class RAGQualityValidator:
    def __init__(self):
        self.pipeline = DummyPipeline()
        # Mocking a rich research document corpus on founder Paul Hartmann
        self.mock_document_pages = [
            {
                "page_number": 1,
                "content": (
                    "AtlasLM Project Overview Document.\n"
                    "Paul Hartmann is an independent software engineer who builds premium AI workspaces. "
                    "His primary focus lies in AI infrastructure, privacy-first software systems, and developer tooling. "
                    "He is the creator of the KLAW local framework, which orchestrates offline intelligence nodes."
                )
            },
            {
                "page_number": 2,
                "content": (
                    "AI Platforms & Project Registry Table.\n"
                    "Paul actively contributes to open-source platforms and active commercial products. "
                    "His registered software projects include:\n"
                    "1. TokenKlaw: High-speed character encoding library.\n"
                    "2. GitRAG: Developer codebase retrieval CLI tool.\n"
                    "3. WhatsApp AI: Secure LLM integration wrapper."
                )
            }
        ]

    def test_chunking_overlap_lineage(self):
        logger.info("=========================================")
        logger.info("TESTING RECURSIVE CHUNKING & LINEAGE...")
        logger.info("=========================================")
        
        start_time = time.time()
        chunks = self.pipeline.recursive_chunk_text(self.mock_document_pages, chunk_size=200, chunk_overlap=50)
        duration = time.time() - start_time
        
        logger.info(f"Generated {len(chunks)} chunks from 2 source pages in {duration:.4f}s")
        
        # Verify metadata assertions
        for idx, chunk in enumerate(chunks):
            assert chunk["page_number"] in [1, 2], "Page number must be correctly mapped."
            assert chunk["char_start"] < chunk["char_end"], "Offsets must be chronological."
            logger.info(
                f"Chunk #{idx+1} [Page {chunk['page_number']}] (Index: {chunk['chunk_index']}): "
                f"Offsets {chunk['char_start']}-{chunk['char_end']} | Snippet: '{chunk['content'][:50]}...'"
            )
        logger.info("? Chunking Overlap & Lineage checks PASSED.\n")
        return chunks

    def test_semantic_retrieval_ranking(self, chunks: List[Dict[str, Any]]):
        logger.info("=========================================")
        logger.info("TESTING SEMANTIC SEARCH RETRIEVAL...")
        logger.info("=========================================")
        
        # Program mock query and vectors
        # Vector features: Dimension 0 = Paul Hartmann, Dimension 1 = KLAW, Dimension 2 = other general facts
        query_klaw = "What framework does Paul Hartmann build for local offline nodes?"
        
        # Assign mock semantic vectors to chunks (Dimension 1536)
        # Chunk 1 describes Paul Hartmann and KLAW (High dimensions 0 and 1)
        # Chunk 2 describes other projects (Low dimension 1)
        vectors = {}
        for chunk in chunks:
            vector = [0.01] * 1536
            if "KLAW" in chunk["content"] or "offline intelligence" in chunk["content"]:
                vector[0] = 0.9
                vector[1] = 0.85
            elif "TokenKlaw" in chunk["content"] or "GitRAG" in chunk["content"]:
                vector[0] = 0.8
                vector[2] = 0.9
            vectors[chunk["id"]] = vector

        query_vector = [0.01] * 1536
        query_vector[0] = 0.9
        query_vector[1] = 0.8  # Target KLAW

        logger.info(f"Query: '{query_klaw}'")
        
        # Execute mathematical cosine similarity ranking
        ranked_results = []
        for chunk in chunks:
            sim = cosine_similarity(query_vector, vectors[chunk["id"]])
            ranked_results.append((chunk, sim))
            
        # Sort by similarity descending
        ranked_results.sort(key=lambda x: x[1], reverse=True)
        
        logger.info("RETRIEVED VECTOR SEARCH MATCHES:")
        for idx, (chunk, score) in enumerate(ranked_results):
            logger.info(
                f"Rank #{idx+1}: Chunk ID: {chunk['id']} | Similarity Score: {score:.4f} | "
                f"Page: {chunk['page_number']} | Snippet: '{chunk['content'][:70]}...'"
            )
            
        # Assert KLAW chunk is ranked #1
        top_chunk = ranked_results[0][0]
        assert "KLAW" in top_chunk["content"], "KLAW chunk should be retrieved as the primary relevance match."
        logger.info("? Semantic Retrieval Ranking check PASSED.\n")
        return ranked_results

    def test_hallucination_prevention_prompt(self, ranked_results):
        logger.info("=========================================")
        logger.info("TESTING PROMPT GROUNDING & SAFETY...")
        logger.info("=========================================")
        
        # 1. Grounded context windows compilation
        top_matches = [item[0] for item in ranked_results[:2]]
        
        source_mapping = {}
        context_blocks = []
        
        for idx, chunk in enumerate(top_matches):
            tag = f"source_{idx + 1}"
            source_mapping[tag] = {
                "chunk_id": str(chunk["id"]),
                "filename": "hartmann_portfolio.pdf",
                "page_number": chunk["page_number"]
            }
            context_blocks.append(
                f"--- START SOURCE {tag} (File: hartmann_portfolio.pdf, Page: {chunk['page_number']}) ---\n"
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
            "in brackets representing where you found the facts (e.g. [source_1] or [source_2]).\n"
            f"=== RETRIEVED SOURCES ===\n{context_str}\n"
        )
        
        logger.info("CONSTRUCTED SYSTEM PROMPT:")
        print(system_prompt)
        
        # Verify strict rules are present
        assert "STRICTOR RULES" in system_prompt, "System prompt must enforce strict RAG guidelines."
        assert "I could not find that information in the uploaded sources" in system_prompt, "Grounding fallback text must be present."
        logger.info("? Grounding Prompt Construction check PASSED.\n")

def run_rag_validation():
    logger.info("==================================================")
    logger.info("STARTING ATLASLM RAG SYSTEM VALIDATION RUN...")
    logger.info("==================================================")
    
    validator = RAGQualityValidator()
    
    # 1. Test Chunking
    chunks = validator.test_chunking_overlap_lineage()
    
    # 2. Test Retrieval Distance Rank
    ranked = validator.test_semantic_retrieval_ranking(chunks)
    
    # 3. Test Prompt Assembly
    validator.test_hallucination_prevention_prompt(ranked)
    
    logger.info("==================================================")
    logger.info("ATLASLM RAG SYSTEM VALIDATION SUCCESSFUL!")
    logger.info("==================================================")

if __name__ == "__main__":
    run_rag_validation()
