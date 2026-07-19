import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter()

CONTENT_DIR = Path(__file__).resolve().parent.parent.parent.parent / "content"


@router.get("/weapons")
async def get_weapons():
    file_path = CONTENT_DIR / "weapons.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Weapons file not found")
    with open(file_path, "r") as f:
        return json.load(f)


@router.get("/units")
async def get_units():
    file_path = CONTENT_DIR / "units.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Units file not found")
    with open(file_path, "r") as f:
        return json.load(f)
