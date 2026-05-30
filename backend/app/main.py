import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .core.config import settings
from .core.database import engine, Base
from .api.endpoints import router as api_router

# Initialize tables if not already present
# (In production development, migrations like Alembic are preferred,
# but for local bootstrap, dynamic metadata create works perfectly)
try:
    # Try importing models to register them with metadata
    from . import models
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")
except Exception as e:
    print(f"WARNING: Could not connect to database or create tables: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/openapi.json"
)

# Set up CORS rules
# Allows connection from Next.js dev server, production port 3010, and cloud domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3010",
        "https://atlaslm.cloud",
        "https://www.atlaslm.cloud"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["system"])
def read_root():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "docs_url": "/docs"
    }

@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
