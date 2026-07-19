from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.echo import router as echo_router
from app.config import Settings

settings = Settings()

app = FastAPI(title=settings.app_name)

app.include_router(health_router, prefix="", tags=["health"])
app.include_router(echo_router, prefix="", tags=["echo"])
