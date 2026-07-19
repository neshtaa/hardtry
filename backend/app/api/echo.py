from typing import Any
from fastapi import APIRouter

router = APIRouter()


@router.post("/echo")
async def echo(payload: Any):
    return payload
