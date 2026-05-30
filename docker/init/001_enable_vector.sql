-- AtlasLM: Enable pgvector extension on database initialization
-- This file is automatically executed by PostgreSQL on first container start
CREATE EXTENSION IF NOT EXISTS vector;
