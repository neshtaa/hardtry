from pydantic import BaseModel
from typing import Optional


class WeaponDef(BaseModel):
    id: str
    name: str
    type: str  # "projectile" | "instant" | "beam"
    damage: int
    radius: int
    speed: int
    ammo: int
    unlockRequirement: Optional[str] = None


class UnitDef(BaseModel):
    id: str
    name: str
    hp: int
    weaponSlots: list[str]
    movementRange: int
    abilities: list[str] = []
