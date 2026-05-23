import httpx
import json
from typing import List, AsyncGenerator
from .config import settings

class EmbeddingProvider:
    async def embed_query(self, text: str) -> List[float]:
        raise NotImplementedError
        
    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        raise NotImplementedError

class LLMProvider:
    async def generate(self, prompt: str, system_prompt: str = "") -> str:
        raise NotImplementedError
        
    async def generate_stream(self, prompt: str, system_prompt: str = "") -> AsyncGenerator[str, None]:
        raise NotImplementedError

# --- Embedding Implementations ---

class OpenAICompatibleEmbedding(EmbeddingProvider):
    def __init__(self, base_url: str, api_key: str, model: str = "text-embedding-3-small"):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.model = model

    async def embed_query(self, text: str) -> List[float]:
        res = await self.embed_documents([text])
        return res[0]

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not self.api_key:
            # Fallback mock/random vector to prevent crash during development if no key
            print("WARNING: No API key for Embedding Provider! Returning mock vectors.")
            return [[0.0] * 1536 for _ in texts]
            
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
            payload = {"input": texts, "model": self.model}
            try:
                response = await client.post(
                    f"{self.base_url}/embeddings",
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                # If embeddings returned successfully, parse them
                return [item["embedding"] for item in data["data"]]
            except Exception as e:
                print(f"Error calling embedding API: {e}")
                # Return standard padded vector as fallback
                return [[0.0] * 1536 for _ in texts]

class OllamaEmbedding(EmbeddingProvider):
    def __init__(self, base_url: str, model: str = "nomic-embed-text"):
        self.base_url = base_url.rstrip('/')
        self.model = model

    async def embed_query(self, text: str) -> List[float]:
        res = await self.embed_documents([text])
        return res[0]

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        async with httpx.AsyncClient() as client:
            embeddings = []
            for text in texts:
                try:
                    payload = {"model": self.model, "prompt": text}
                    response = await client.post(
                        f"{self.base_url}/api/embeddings",
                        json=payload,
                        timeout=10.0
                    )
                    response.raise_for_status()
                    data = response.json()
                    vector = data["embedding"]
                    # Pad or truncate to 1536 dimension for schema consistency
                    if len(vector) < 1536:
                        vector = vector + [0.0] * (1536 - len(vector))
                    elif len(vector) > 1536:
                        vector = vector[:1536]
                    embeddings.append(vector)
                except Exception as e:
                    print(f"Ollama embedding error: {e}")
                    embeddings.append([0.0] * 1536)
            return embeddings

# --- LLM Implementations ---

class OpenAICompatibleLLM(LLMProvider):
    def __init__(self, base_url: str, api_key: str, model: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.model = model

    async def generate(self, prompt: str, system_prompt: str = "") -> str:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": 0.1, # Keep it highly precise for grounded RAG
            }
            try:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except Exception as e:
                print(f"LLM API generation error: {e}")
                return "Error contacting the LLM API provider."

    async def generate_stream(self, prompt: str, system_prompt: str = "") -> AsyncGenerator[str, None]:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": 0.1,
                "stream": True
            }
            
            try:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60.0
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                delta = chunk["choices"][0]["delta"]
                                if "content" in delta:
                                    yield delta["content"]
                            except Exception:
                                continue
            except Exception as e:
                print(f"LLM API streaming error: {e}")
                yield f"Error during streaming generation: {e}"

class OllamaLLM(LLMProvider):
    def __init__(self, base_url: str, model: str = "llama3"):
        self.base_url = base_url.rstrip('/')
        self.model = model

    async def generate(self, prompt: str, system_prompt: str = "") -> str:
        async with httpx.AsyncClient() as client:
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "options": {"temperature": 0.1},
                "stream": False
            }
            try:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                data = response.json()
                return data["message"]["content"]
            except Exception as e:
                print(f"Ollama generation error: {e}")
                return "Error contacting Ollama model on the server."

    async def generate_stream(self, prompt: str, system_prompt: str = "") -> AsyncGenerator[str, None]:
        async with httpx.AsyncClient() as client:
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "options": {"temperature": 0.1},
                "stream": True
            }
            try:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json=payload,
                    timeout=60.0
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            yield chunk["message"]["content"]
                        except Exception:
                            continue
            except Exception as e:
                print(f"Ollama streaming error: {e}")
                yield f"Ollama streaming error: {e}"

# --- Provider Registry ---

class ProviderRegistry:
    def __init__(self):
        self._llms = {}
        self._embeddings = {}
        
        # 1. Initialize Langdock (using OpenAI Compatible endpoint)
        if settings.LANGDOCK_API_KEY:
            self._llms["langdock"] = OpenAICompatibleLLM(
                base_url=settings.LANGDOCK_ENDPOINT_URL,
                api_key=settings.LANGDOCK_API_KEY,
                model="gpt-4o" # default model mapping or custom
            )
            self._embeddings["langdock"] = OpenAICompatibleEmbedding(
                base_url=settings.LANGDOCK_ENDPOINT_URL,
                api_key=settings.LANGDOCK_API_KEY,
                model="text-embedding-3-small"
            )
            
        # 2. Initialize Blackbox AI
        if settings.BLACKBOX_API_KEY:
            self._llms["blackbox"] = OpenAICompatibleLLM(
                base_url="https://api.blackbox.ai/api/v1",
                api_key=settings.BLACKBOX_API_KEY,
                model="blackboxai"
            )
            
        # 3. Initialize OpenRouter
        if settings.OPENROUTER_API_KEY:
            self._llms["openrouter"] = OpenAICompatibleLLM(
                base_url=settings.OPENROUTER_ENDPOINT_URL,
                api_key=settings.OPENROUTER_API_KEY,
                model=settings.OPENROUTER_MODEL
            )
            self._embeddings["openrouter"] = OpenAICompatibleEmbedding(
                base_url=settings.OPENROUTER_ENDPOINT_URL,
                api_key=settings.OPENROUTER_API_KEY,
                model="text-embedding-3-small"
            )

        # 4. Initialize Ollama
        self._llms["ollama"] = OllamaLLM(
            base_url=settings.OLLAMA_ENDPOINT_URL,
            model="llama3"
        )
        self._embeddings["ollama"] = OllamaEmbedding(
            base_url=settings.OLLAMA_ENDPOINT_URL,
            model="nomic-embed-text"
        )
        
        # 5. Direct OpenAI fallbacks
        if settings.OPENAI_API_KEY:
            self._llms["openai"] = OpenAICompatibleLLM(
                base_url="https://api.openai.com/v1",
                api_key=settings.OPENAI_API_KEY,
                model="gpt-4o"
            )
            self._embeddings["openai"] = OpenAICompatibleEmbedding(
                base_url="https://api.openai.com/v1",
                api_key=settings.OPENAI_API_KEY,
                model="text-embedding-3-small"
            )

    def get_llm(self, provider_name: str = "langdock") -> LLMProvider:
        # Fallback sequence: requested provider -> first available -> ollama as offline fallback
        if provider_name in self._llms:
            return self._llms[provider_name]
        for name in ["langdock", "openrouter", "openai", "blackbox"]:
            if name in self._llms:
                return self._llms[name]
        return self._llms["ollama"]

    def get_embeddings(self, provider_name: str = "langdock") -> EmbeddingProvider:
        if provider_name in self._embeddings:
            return self._embeddings[provider_name]
        for name in ["langdock", "openrouter", "openai"]:
            if name in self._embeddings:
                return self._embeddings[name]
        return self._embeddings["ollama"]

provider_registry = ProviderRegistry()
