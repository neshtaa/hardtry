from fastapi import APIRouter

router = APIRouter()


@router.post("/echo")
async def echo(payload: dict):
    return payload
