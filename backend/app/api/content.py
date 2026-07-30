import json
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

CONTENT_DIR = Path(__file__).parent.parent.parent / "content"

class WeaponSchema(BaseModel):
    id: str
    name: str
    damage: float
    range: float
    projectileColor: str
    explosionRadius: float

class UnitClassSchema(BaseModel):
    id: str
    name: str
    baseHp: int
    allowedWeaponIds: List[str]
    color: str
    description: str

class UnitConfigSchema(BaseModel):
    id: str
    archetypeId: Optional[str] = None
    hp: Optional[int] = None
    weaponId: Optional[str] = None
    x: float
    y: float
    color: Optional[str] = None
    side: str

class MissionSchema(BaseModel):
    id: str
    name: str
    units: List[UnitConfigSchema]

def load_json(filename: str):
    filepath = CONTENT_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"{filename} not found")
    with open(filepath, "r") as f:
        return json.load(f)

@router.get("/weapons", response_model=List[WeaponSchema])
async def get_weapons():
    data = load_json("weapons.json")
    return [WeaponSchema.model_validate(item) for item in data]

@router.get("/units")
async def get_units():
    return load_json("units.json")

@router.get("/missions", response_model=List[MissionSchema])
async def get_missions():
    data = load_json("missions.json")
    return [MissionSchema.model_validate(item) for item in data]

@router.get("/unit_classes", response_model=List[UnitClassSchema])
async def get_unit_classes():
    data = load_json("unit_classes.json")
    return [UnitClassSchema.model_validate(item) for item in data]

