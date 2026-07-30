import { MissionDef, WeaponDef, UnitClassDef } from './types';

export const FALLBACK_MISSIONS: MissionDef[] = [
  {
    id: 'fallback_demo',
    name: 'Training Ground',
    units: [
      { id: 'player', archetypeId: 'soldier', weaponId: 'bazooka', x: 150, y: 400, side: 'player' },
      { id: 'ai', archetypeId: 'heavy', weaponId: 'grenade', x: 650, y: 400, side: 'enemy' },
    ],
  },
  {
    id: 'second_fallback',
    name: 'Second Battle',
    units: [
      { id: 'player', archetypeId: 'scout', weaponId: 'shotgun', x: 150, y: 400, side: 'player' },
      { id: 'ai', archetypeId: 'soldier', weaponId: 'bazooka', x: 650, y: 400, side: 'enemy' },
    ],
  },
];

export const FALLBACK_WEAPONS: WeaponDef[] = [
  {
    id: 'bazooka',
    name: 'Bazooka',
    damage: 3,
    range: 200,
    projectileColor: '#ffcc00',
    explosionRadius: 30,
    weaponType: 'bazooka',
    ammo: -1,
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    damage: 2,
    range: 150,
    projectileColor: '#aaaaaa',
    explosionRadius: 15,
    weaponType: 'shotgun',
    ammo: 3,
  },
  {
    id: 'grenade',
    name: 'Grenade',
    damage: 4,
    range: 150,
    projectileColor: '#00ff00',
    explosionRadius: 45,
    weaponType: 'grenade',
    ammo: 2,
  },
];

export const FALLBACK_UNIT_CLASSES: UnitClassDef[] = [
  {
    id: 'soldier',
    name: 'Soldier',
    baseHp: 10,
    allowedWeaponIds: ['bazooka', 'shotgun', 'grenade'],
    color: '0x4488ff',
    description: 'Balanced all-rounder',
  },
  {
    id: 'scout',
    name: 'Scout',
    baseHp: 8,
    allowedWeaponIds: ['bazooka', 'shotgun'],
    color: '0x44ff44',
    description: 'Fast, fragile, accurate',
  },
  {
    id: 'heavy',
    name: 'Heavy',
    baseHp: 15,
    allowedWeaponIds: ['bazooka', 'grenade'],
    color: '0xff4444',
    description: 'Slow but tough, area damage',
  },
];
