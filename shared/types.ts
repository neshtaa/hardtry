export interface WeaponDef {
  id: string;
  name: string;
  type: 'projectile' | 'instant' | 'beam';
  damage: number;
  radius: number;
  speed: number;
  ammo: number;
  unlockRequirement?: string;
}

export interface UnitDef {
  id: string;
  name: string;
  hp: number;
  weaponSlots: string[];
  movementRange: number;
  abilities?: string[];
}

export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  terrainSeed?: string; // for procedural generation reference
}

export interface MissionDef {
  id: string;
  name: string;
  mapId: string;
  enemyUnits: { unitId: string; count: number }[];
  playerUnitIds: string[];
  conditions: { type: 'eliminate_all'; target: 'enemy' };
  rewards: { xp: number; currency: number };
}
