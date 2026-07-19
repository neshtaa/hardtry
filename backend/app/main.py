from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.echo import router as echo_router
from app.api.content import router as content_router
from app.config import Settings

settings = Settings()

app = FastAPI(title=settings.app_name)

# Allow all origins during development – restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="", tags=["health"])
app.include_router(echo_router, prefix="", tags=["echo"])
app.include_router(content_router, prefix="", tags=["content"])
