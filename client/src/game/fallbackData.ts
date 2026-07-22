import { MissionDef, WeaponDef, UnitClassDef } from './types';

export const FALLBACK_MISSIONS: MissionDef[] = [
  {
    id: 'fallback_demo',
    name: 'Training Ground',
    units: [
      { id: 'player', archetypeId: 'soldier', weaponId: 'basic_cannon', x: 150, y: 400, side: 'player' },
      { id: 'ai', archetypeId: 'heavy', weaponId: 'cluster_bomb', x: 650, y: 400, side: 'enemy' },
    ],
  },
  {
    id: 'second_fallback',
    name: 'Second Battle',
    units: [
      { id: 'player', archetypeId: 'scout', weaponId: 'sniper_cannon', x: 150, y: 400, side: 'player' },
      { id: 'ai', archetypeId: 'soldier', weaponId: 'basic_cannon', x: 650, y: 400, side: 'enemy' },
    ],
  },
];

export const FALLBACK_WEAPONS: WeaponDef[] = [
  {
    id: 'basic_cannon',
    name: 'Basic Cannon',
    damage: 3,
    range: 200,
    projectileColor: '#ffcc00',
    explosionRadius: 30,
  },
  {
    id: 'sniper_cannon',
    name: 'Sniper Cannon',
    damage: 5,
    range: 400,
    projectileColor: '#ff4444',
    explosionRadius: 10,
  },
  {
    id: 'cluster_bomb',
    name: 'Cluster Bomb',
    damage: 1,
    range: 150,
    projectileColor: '#ff8800',
    explosionRadius: 60,
  },
];

export const FALLBACK_UNIT_CLASSES: UnitClassDef[] = [
  {
    id: 'soldier',
    name: 'Soldier',
    baseHp: 10,
    allowedWeaponIds: ['basic_cannon', 'sniper_cannon'],
    color: '0x4488ff',
    description: 'Balanced all-rounder',
  },
  {
    id: 'scout',
    name: 'Scout',
    baseHp: 8,
    allowedWeaponIds: ['sniper_cannon'],
    color: '0x44ff44',
    description: 'Fast, fragile, accurate',
  },
  {
    id: 'heavy',
    name: 'Heavy',
    baseHp: 15,
    allowedWeaponIds: ['basic_cannon', 'cluster_bomb'],
    color: '0xff4444',
    description: 'Slow but tough, area damage',
  },
];
