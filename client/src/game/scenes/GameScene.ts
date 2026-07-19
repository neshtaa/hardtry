import Phaser from 'phaser';

interface WeaponDef {
  id: string;
  name: string;
  damage: number;
  range: number;
  projectileColor: string;
  explosionRadius: number;
}

interface UnitConfig {
  id: string;
  hp: number;
  weaponId: string;
  x: number;
  y: number;
  color: string;
  side: "player" | "enemy";
}

interface MissionDef {
  id: string;
  name: string;
  units: UnitConfig[];
}

interface SimpleUnitConfig {
  x: number;
  y: number;
  hp: number;
  weaponId: string;
  color: number;
  name: string;
}

class SimpleUnit {
  scene: Phaser.Scene;
  body: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Graphics;
  hp: number;
  maxHp: number;
  weaponId: string;
  name: string;
  color: number;

  constructor(scene: Phaser.Scene, config: SimpleUnitConfig) {
    this.scene = scene;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.weaponId = config.weaponId;
    this.name = config.name;
    this.color = config.color;

    this.body = scene.add.rectangle(config.x, config.y, 40, 50, this.color);
    this.hpBar = scene.add.graphics();
    this.drawHpBar();
  }

  drawHpBar() {
    this.hpBar.clear();
    const barWidth = 40;
    const barHeight = 8;
    const x = this.body.x - barWidth / 2;
    const y = this.body.y - 40;
    this.hpBar.fillStyle(0x333333);
    this.hpBar.fillRect(x, y, barWidth, barHeight);
    const ratio = Math.max(0, this.hp / this.maxHp);
    const barColor = ratio > 0.5 ? 0x00ff00 : ratio > 0.25 ? 0xffaa00 : 0xff0000;
    this.hpBar.fillStyle(barColor);
    this.hpBar.fillRect(x, y, barWidth * ratio, barHeight);
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);
    this.drawHpBar();
  }

  isAlive() {
    return this.hp > 0;
  }

  setY(y: number) {
    this.body.y = y;
    this.drawHpBar();
  }

  destroy() {
    this.body.destroy();
    this.hpBar.destroy();
  }
}

export class GameScene extends Phaser.Scene {
  private player!: SimpleUnit;
  private ai!: SimpleUnit;
  private turnText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private isPlayerTurn: boolean = true;
  private isAnimating: boolean = false;
  private weaponMap: Map<string, WeaponDef> = new Map();
  private missionList: MissionDef[] = [];
  private currentMissionIndex: number = 0;
  private mission!: MissionDef;
  private terrainHeights!: number[];
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private missionNameText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  async create() {
    const loadText = this.add
      .text(400, 300, 'Loading…', { fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5);

    const [weaponMap, missions] = await Promise.all([
      this.loadWeapons(),
      this.loadMissions(),
    ]);
    this.weaponMap = weaponMap;
    this.missionList = missions.length ? missions : [this.getFallbackMission()];
    this.currentMissionIndex = 0;
    this.mission = this.missionList[this.currentMissionIndex];

    // Build initial terrain height map (flat + hills)
    this.initTerrain();

    this.children.removeAll(true);
    this.buildTerrain();
    this.setupGame();
  }

  private async loadWeapons(): Promise<Map<string, WeaponDef>> {
    const backendUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const url = `${backendUrl}/weapons`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch weapons: ${res.statusText}`);
      }
      const weapons: WeaponDef[] = await res.json();
      const map = new Map<string, WeaponDef>();
      for (const w of weapons) {
        map.set(w.id, w);
      }
      return map;
    } catch (err) {
      console.warn('Could not reach backend – using fallback weapon definitions', err);
      const map = new Map<string, WeaponDef>();
      map.set('basic_cannon', {
        id: 'basic_cannon',
        name: 'Basic Cannon',
        damage: 3,
        range: 200,
        projectileColor: '#ffcc00',
        explosionRadius: 30,
      });
      map.set('sniper_cannon', {
        id: 'sniper_cannon',
        name: 'Sniper Cannon',
        damage: 5,
        range: 400,
        projectileColor: '#ff4444',
        explosionRadius: 10,
      });
      map.set('cluster_bomb', {
        id: 'cluster_bomb',
        name: 'Cluster Bomb',
        damage: 1,
        range: 150,
        projectileColor: '#ff8800',
        explosionRadius: 60,
      });
      return map;
    }
  }

  private async loadMissions(): Promise<MissionDef[]> {
    const backendUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const url = `${backendUrl}/missions`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch missions: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      console.warn('Could not reach backend – using fallback mission list', err);
      return [this.getFallbackMission(), this.getSecondMission()];
    }
  }

  private getFallbackMission(): MissionDef {
    return {
      id: 'fallback_demo',
      name: 'Fallback Demo',
      units: [
        { id: 'player', hp: 10, weaponId: 'basic_cannon', x: 150, y: 400, color: '0x4488ff', side: 'player' },
        { id: 'ai', hp: 10, weaponId: 'cluster_bomb', x: 650, y: 400, color: '0xff4444', side: 'enemy' },
      ],
    };
  }

  private getSecondMission(): MissionDef {
    return {
      id: 'second_demo',
      name: 'Second Battle',
      units: [
        { id: 'player', hp: 12, weaponId: 'sniper_cannon', x: 150, y: 400, color: '0x4488ff', side: 'player' },
        { id: 'ai', hp: 15, weaponId: 'basic_cannon', x: 650, y: 400, color: '0xff4444', side: 'enemy' },
      ],
    };
  }

  private initTerrain(): void {
    this.terrainHeights = new Array(800);
    for (let x = 0; x < 800; x++) {
      let h = 450; // base ground
      // first hill (x: 200..399)
      if (x >= 200 && x < 400) {
        if (x <= 300) {
          h = 450 - ((x - 200) / 100) * 70;
        } else {
          h = 450 - ((400 - x) / 100) * 70;
        }
      }
      // second hill (x: 400..600)
      if (x >= 400 && x <= 600) {
        if (x <= 500) {
          h = 450 - ((x - 400) / 100) * 70;
        } else {
          h = 450 - ((600 - x) / 100) * 70;
        }
      }
      this.terrainHeights[x] = Math.max(0, Math.min(600, h));
    }
  }

  private buildTerrain(): void {
    this.terrainGraphics = this.add.graphics();
    this.redrawTerrain();
  }

  private redrawTerrain(): void {
    this.terrainGraphics.clear();
    this.terrainGraphics.fillStyle(0x446644);
    for (let x = 0; x < 800; x++) {
      const h = this.terrainHeights[x];
      this.terrainGraphics.fillRect(x, h, 1, 600 - h);
    }
  }

  private destroyTerrain(cx: number, cy: number, radius: number = 30): void {
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(799, Math.ceil(cx + radius));
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = this.terrainHeights[x] - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        const craterY = cy + Math.sqrt(radius * radius - dx * dx);
        if (craterY > this.terrainHeights[x]) {
          this.terrainHeights[x] = Math.min(600, craterY);
        }
      }
    }
    this.redrawTerrain();
  }

  private applyGravity(unit: SimpleUnit): void {
    const x = Math.round(unit.body.x);
    if (x < 0 || x >= 800) return;
    const groundY = this.terrainHeights[x];
    const standY = groundY - 25; // half of unit height (50)
    if (unit.body.y < standY) {
      unit.setY(standY);
    }
  }

  private setupGame() {
    const playerCfg = this.mission.units.find((u) => u.side === 'player');
    const aiCfg = this.mission.units.find((u) => u.side === 'enemy');

    if (!playerCfg || !aiCfg) {
      throw new Error('Mission must have exactly one player and one enemy unit');
    }

    this.player = new SimpleUnit(this, {
      x: playerCfg.x,
      y: playerCfg.y,
      hp: playerCfg.hp,
      weaponId: playerCfg.weaponId,
      color: parseInt(playerCfg.color),
      name: 'Player',
    });

    this.ai = new SimpleUnit(this, {
      x: aiCfg.x,
      y: aiCfg.y,
      hp: aiCfg.hp,
      weaponId: aiCfg.weaponId,
      color: parseInt(aiCfg.color),
      name: 'AI',
    });

    // Place units on terrain
    const playerGround = this.terrainHeights[Math.round(playerCfg.x)];
    const aiGround = this.terrainHeights[Math.round(aiCfg.x)];
    this.player.setY(playerGround - 25);
    this.ai.setY(aiGround - 25);

    // UI texts
    this.missionNameText = this.add
      .text(400, 20, this.mission.name, { fontSize: '20px', color: '#cccccc' })
      .setOrigin(0.5);

    this.turnText = this.add
      .text(400, 60, '', { fontSize: '28px', color: '#ffffff' })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(400, 100, '', { fontSize: '18px', color: '#cccccc' })
      .setOrigin(0.5);

    // Input – space fires for the player
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (this.isPlayerTurn && !this.isAnimating && this.player.isAlive()) {
        this.playerAttack();
      }
    });

    this.turnText.setText('Player Turn – press SPACE to fire');
  }

  private getWeaponDef(id: string): WeaponDef | undefined {
    return this.weaponMap.get(id);
  }

  private getWeaponDamage(weaponId: string): number {
    const w = this.getWeaponDef(weaponId);
    return w ? w.damage : 3;
  }

  private getProjectileColor(weaponId: string): number {
    const w = this.getWeaponDef(weaponId);
    const colorStr = w ? w.projectileColor : '#ffcc00';
    return Phaser.Display.Color.HexStringToColor(colorStr).color;
  }

  private playerAttack() {
    this.isAnimating = true;
    const damage = this.getWeaponDamage(this.player.weaponId);
    this.fireProjectile(this.player, this.ai, damage, () => {
      if (!this.player.isAlive() || !this.ai.isAlive()) {
        this.showGameOver(!this.player.isAlive() ? 'AI Wins!' : 'Player Wins!');
        return;
      }
      this.time.delayedCall(500, () => {
        this.aiTurn();
      });
    });
  }

  // --------------------------------------------------------------------------
  // AI decision helpers – extensible for future difficulty/unit types
  // --------------------------------------------------------------------------

  /** Returns all currently alive enemy units */
  private getAITargets(): SimpleUnit[] {
    const targets: SimpleUnit[] = [];
    if (this.player.isAlive()) {
      targets.push(this.player);
    }
    // future: add more enemy units from mission
    return targets;
  }

  /** Returns the point the AI will aim at (deterministic – easy to improve later) */
  private getAIAimPoint(target: SimpleUnit): { x: number; y: number } {
    // currently aims at the centre of the target's top edge
    return { x: target.body.x, y: target.body.y - 25 };
  }

  /** AI turn logic */
  private aiTurn() {
    this.isPlayerTurn = false;
    this.turnText.setText('AI Turn');
    this.statusText.setText('');

    this.time.delayedCall(800, () => {
      const targets = this.getAITargets();
      if (targets.length === 0) {
        this.showGameOver('Player Wins!');
        return;
      }

      const target = targets[0]; // pick first alive enemy
      const damage = this.getWeaponDamage(this.ai.weaponId);
      const aimPoint = this.getAIAimPoint(target);

      this.fireProjectile(this.ai, target, damage, () => {
        if (!this.player.isAlive() || !this.ai.isAlive()) {
          this.showGameOver(!this.player.isAlive() ? 'AI Wins!' : 'Player Wins!');
          return;
        }
        this.time.delayedCall(500, () => {
          this.isPlayerTurn = true;
          this.isAnimating = false;
          this.turnText.setText('Player Turn – press SPACE to fire');
        });
      }, aimPoint.x, aimPoint.y);
    });
  }

  // --------------------------------------------------------------------------
  // Projectile & combat core
  // --------------------------------------------------------------------------

  /**
   * Fires a projectile from one unit to another.
   * If targetX/targetY are provided they override the destination,
   * enabling explicit aiming (used by AI).
   */
  private fireProjectile(
    from: SimpleUnit,
    to: SimpleUnit,
    damage: number,
    onComplete: () => void,
    targetX?: number,
    targetY?: number,
  ) {
    const color = this.getProjectileColor(from.weaponId);
    const weaponDef = this.getWeaponDef(from.weaponId);
    const explosionRadius = weaponDef ? weaponDef.explosionRadius : 30;
    const projectile = this.add.circle(from.body.x, from.body.y - 25, 6, color);
    const destX = targetX !== undefined ? targetX : to.body.x;
    const destY = targetY !== undefined ? targetY : to.body.y - 25;

    this.tweens.add({
      targets: projectile,
      x: destX,
      y: destY,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        projectile.destroy();
        to.takeDamage(damage);
        this.statusText.setText(`${from.name} dealt ${damage} damage`);

        // Destructible terrain at impact point – radius driven by weapon definition
        this.destroyTerrain(destX, destY, explosionRadius);

        // Both units fall after terrain change
        this.applyGravity(this.player);
        this.applyGravity(this.ai);

        onComplete();
      },
    });
  }

  private showGameOver(message: string) {
    this.isAnimating = true;
    this.isPlayerTurn = false;
    this.turnText.setText(message);

    const hasNext = this.currentMissionIndex + 1 < this.missionList.length;
    const restartText = 'R to restart';
    const nextText = hasNext ? ' | N for next mission' : '';
    this.statusText.setText(`${restartText}${nextText}`);

    // Handle restart (R key)
    this.input.keyboard!.on('keydown-R', () => {
      this.scene.restart();
    });

    // Handle next mission (N key) – only if available
    if (hasNext) {
      this.input.keyboard!.on('keydown-N', () => {
        this.currentMissionIndex++;
        this.scene.restart();
      });
    }
  }

  /**
   * Override init to propagate currentMissionIndex on scene restart.
   * This ensures the scene uses the correct mission after restart/next.
   */
  init(data?: { missionIndex?: number }) {
    if (data && data.missionIndex !== undefined) {
      this.currentMissionIndex = data.missionIndex;
    }
  }

  /**
   * Override scene.restart() to pass the current mission index.
   * We do this by overriding the default restart method.
   */
  restart() {
    this.scene.restart({ missionIndex: this.currentMissionIndex });
  }
}
