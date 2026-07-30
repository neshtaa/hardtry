import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  getInitialVelocity,
  getProjectileStateAtTime,
  calculateTargetDirection,
  calculateAIAim,
  checkContinuousTerrainCollision,
} from './ballistics.js';

describe('Ballistics & AI Shooting Tests', () => {
  test('Bazooka initial velocity forms upward parabolic arc', () => {
    const params = {
      startX: 150,
      startY: 400,
      angleDeg: 45,
      powerMult: 1.0,
      dirX: 1,
      wind: 0,
    };
    const { vx0, vy0 } = getInitialVelocity(params);
    assert.strictEqual(vx0 > 0, true, 'vx0 should be positive when dirX=1');
    assert.strictEqual(vy0 < 0, true, 'vy0 should be negative (upward) in canvas coords');

    const stateAtHalfSec = getProjectileStateAtTime(params, 0.5);
    assert.strictEqual(stateAtHalfSec.x > 150, true, 'Projectile should move right');
    assert.strictEqual(stateAtHalfSec.y < 400, true, 'Projectile peak should be higher than launch point');
  });

  test('Wind accelerates projectile horizontally over time', () => {
    const noWindParams = { startX: 150, startY: 400, angleDeg: 45, powerMult: 1.0, dirX: 1, wind: 0 };
    const tailWindParams = { startX: 150, startY: 400, angleDeg: 45, powerMult: 1.0, dirX: 1, wind: 3.0 };

    const posNoWind = getProjectileStateAtTime(noWindParams, 1.0);
    const posTailWind = getProjectileStateAtTime(tailWindParams, 1.0);

    assert.strictEqual(
      posTailWind.x > posNoWind.x,
      true,
      'Tailwind should push projectile further right than no wind'
    );
  });

  test('AI bot direction calculation points correctly towards target', () => {
    // AI at 650 shooting player at 150 (player is to the left)
    const dirLeft = calculateTargetDirection(650, 150);
    assert.strictEqual(dirLeft, -1, 'AI should aim left (-1) when target is behind/left of AI');

    const aiAimLeft = calculateAIAim(650, 400, 150, 400, 0);
    assert.strictEqual(aiAimLeft.dirX, -1, 'AI aim should specify dirX = -1');

    const { vx0 } = getInitialVelocity({
      startX: 650,
      startY: 400,
      angleDeg: aiAimLeft.angle,
      powerMult: aiAimLeft.power,
      dirX: aiAimLeft.dirX,
      wind: 0,
    });
    assert.strictEqual(vx0 < 0, true, 'AI horizontal velocity must be negative towards player');
  });

  test('Continuous collision detection stops projectile at terrain surface without tunneling', () => {
    // Flat ground at y = 450
    const mockGroundHeight = (_x: number) => 450;

    // Movement segment from y=400 to y=500 passing through ground at y=450
    const p1 = { x: 300, y: 400 };
    const p2 = { x: 320, y: 500 };

    const result = checkContinuousTerrainCollision(p1, p2, mockGroundHeight, 2);
    assert.strictEqual(result.hit, true, 'CCD should detect ground collision');
    assert.strictEqual(result.impactPoint !== undefined, true);
    assert.strictEqual(result.impactPoint!.y <= 450, true, 'Impact point y must not exceed ground y=450');
  });
});
