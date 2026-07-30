export interface Point {
  x: number;
  y: number;
}

export interface TrajectoryPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface ProjectileParams {
  startX: number;
  startY: number;
  angleDeg: number;
  powerMult: number;
  dirX: number; // +1 for right, -1 for left
  wind: number; // e.g. -3.0 to +3.0
  baseSpeed?: number; // default 450
  gravity?: number; // default 450
  windFactor?: number; // default 25
}

/**
 * Calculates initial velocity components (vx0, vy0) for a projectile.
 */
export function getInitialVelocity(params: ProjectileParams): { vx0: number; vy0: number } {
  const baseSpeed = params.baseSpeed ?? 450;
  const angleRad = (params.angleDeg * Math.PI) / 180;
  const speed = baseSpeed * params.powerMult;
  const vx0 = params.dirX * Math.cos(angleRad) * speed;
  const vy0 = -Math.sin(angleRad) * speed; // Negative is UP in screen/canvas coordinates
  return { vx0, vy0 };
}

/**
 * Calculates projectile position and velocity at time t (in seconds).
 */
export function getProjectileStateAtTime(params: ProjectileParams, t: number): TrajectoryPoint {
  const { vx0, vy0 } = getInitialVelocity(params);
  const gravity = params.gravity ?? 450;
  const windFactor = params.windFactor ?? 25;

  const x = params.startX + vx0 * t + 0.5 * params.wind * windFactor * t * t;
  const y = params.startY + vy0 * t + 0.5 * gravity * t * t;
  const vx = vx0 + params.wind * windFactor * t;
  const vy = vy0 + gravity * t;

  return { x, y, vx, vy };
}

/**
 * Calculates target direction (-1 for left, +1 for right).
 */
export function calculateTargetDirection(startX: number, targetX: number): number {
  return targetX >= startX ? 1 : -1;
}

/**
 * Calculates AI aim angle, power and direction to hit a target.
 */
export function calculateAIAim(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  wind: number = 0
): { angle: number; power: number; dirX: number } {
  const dirX = calculateTargetDirection(fromX, toX);
  const dx = Math.abs(toX - fromX);
  const dy = (fromY - 25) - (toY - 25);

  let baseAngle = 45;
  if (dx > 0) {
    const elevationFactor = Math.atan2(dy, dx) * (180 / Math.PI);
    baseAngle = Math.min(75, Math.max(15, 45 + elevationFactor * 0.3));
  }

  const angleRad = (baseAngle * Math.PI) / 180;
  const sin2Theta = Math.sin(2 * angleRad);
  const g = 450;
  const baseSpeed = 450;

  const estimatedFlightTime = 1.0;
  const windOffset = wind * 25 * 0.5 * estimatedFlightTime * estimatedFlightTime;
  const adjustedDx = Math.max(20, dx - dirX * windOffset);

  const requiredSpeed = Math.sqrt((g * adjustedDx) / Math.max(0.2, sin2Theta));
  let power = requiredSpeed / baseSpeed;
  power = Math.min(1.5, Math.max(0.5, power));

  return { angle: baseAngle, power, dirX };
}

/**
 * Continuous collision detection helper: samples points along segment (p1 -> p2)
 * to check if any point dips below ground height function or hits target.
 */
export function checkContinuousTerrainCollision(
  p1: Point,
  p2: Point,
  getGroundHeight: (x: number) => number,
  stepSize: number = 2
): { hit: boolean; impactPoint?: Point } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(distance / stepSize));

  for (let i = 1; i <= steps; i++) {
    const ratio = i / steps;
    const sampleX = p1.x + dx * ratio;
    const sampleY = p1.y + dy * ratio;

    const groundY = getGroundHeight(sampleX);
    if (sampleY >= groundY) {
      return {
        hit: true,
        impactPoint: { x: sampleX, y: Math.min(sampleY, groundY) },
      };
    }
  }

  return { hit: false };
}
