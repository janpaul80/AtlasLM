import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "AtlasLM"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = Field(
        default="postgresql://atlaslm:atlaspass@localhost:5435/atlaslm_db",
        env="DATABASE_URL"
    )
    
    # JWT Fallback Settings
    JWT_SECRET: str = Field(
        default="ceb184b89d7d6a91f7a1142d6b21fb5f768ecf3db1be5529c865a20784752db82a67957ec826a8bc3f7fbc67bdccba8ba3e5689500c1e55140d4edbe8636089d",
        env="JWT_SECRET"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Supabase (mainly for frontend, but backend can verify tokens if needed)
    SUPABASE_URL: str = Field(default="", env="SUPABASE_URL")
    SUPABASE_ANON_KEY: str = Field(default="", env="SUPABASE_ANON_KEY")
    
    # Model APIs
    LANGDOCK_API_KEY: str = Field(default="", env="LANGDOCK_API_KEY")
    LANGDOCK_ENDPOINT_URL: str = Field(
        default="https://api.langdock.com/openai/eu/v1",
        env="LANGDOCK_ENDPOINT_URL"
    )
    LANGDOCK_WORKSPACE_ID: str = Field(default="", env="LANGDOCK_WORKSPACE_ID")
    
    BLACKBOX_API_KEY: str = Field(default="", env="BLACKBOX_API_KEY")
    
    OPENROUTER_API_KEY: str = Field(default="", env="OPENROUTER_API_KEY")
    OPENROUTER_ENDPOINT_URL: str = Field(
        default="https://openrouter.ai/api/v1",
        env="OPENROUTER_ENDPOINT_URL"
    )
    OPENROUTER_MODEL: str = Field(default="openrouter/auto", env="OPENROUTER_MODEL")
    
    OLLAMA_ENDPOINT_URL: str = Field(
        default="http://localhost:11434",
        env="OLLAMA_ENDPOINT_URL"
    )
    
    OPENAI_API_KEY: str = Field(default="", env="OPENAI_API_KEY")
    GEMINI_API_KEY: str = Field(default="", env="GEMINI_API_KEY")
    
    # RAG Settings
    DEFAULT_CHUNK_SIZE: int = 800
    DEFAULT_CHUNK_OVERLAP: int = 150
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
