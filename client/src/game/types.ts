export interface WeaponDef {
  id: string;
  name: string;
  damage: number;
  range: number;
  projectileColor: string;
  explosionRadius: number;
}

export interface UnitClassDef {
  id: string;
  name: string;
  baseHp: number;
  allowedWeaponIds: string[];
  color: string;
  description: string;
}

export interface UnitConfig {
  id: string;
  archetypeId?: string;
  hp?: number;
  weaponId?: string;
  x: number;
  y: number;
  color?: string;
  side: 'player' | 'enemy';
}

export interface MissionDef {
  id: string;
  name: string;
  units: UnitConfig[];
}

export interface SimpleUnitConfig {
  x: number;
  y: number;
  hp: number;
  weaponId: string;
  color: number;
  name: string;
  weaponName: string;
}
