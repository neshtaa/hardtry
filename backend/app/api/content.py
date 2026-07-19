import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter()

CONTENT_DIR = Path(__file__).parent.parent.parent / "content"

def load_json(filename: str):
    filepath = CONTENT_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"{filename} not found")
    with open(filepath, "r") as f:
        return json.load(f)

@router.get("/weapons")
async def get_weapons():
    return load_json("weapons.json")

@router.get("/units")
async def get_units():
    return load_json("units.json")

@router.get("/missions")
async def get_missions():
    return load_json("missions.json")
