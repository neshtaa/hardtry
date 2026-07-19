from fastapi import FastAPI
from app.api.content import router as content_router

app = FastAPI(title="Wormix-Like API")

@app.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(content_router, prefix="/content", tags=["content"])
