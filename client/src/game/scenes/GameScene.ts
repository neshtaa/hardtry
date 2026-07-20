import Phaser from 'phaser';

// ---- Interfaces -------------------------------------------------------------

interface WeaponDef {
  id: string;
  name: string;
  damage: number;
  range: number;
  projectileColor: string;
  explosionRadius: number;
}

interface UnitClassDef {
  id: string;
  name: string;
  baseHp: number;
  allowedWeaponIds: string[];
  color: string;
  description: string;
}

interface UnitConfig {
  id: string;
  archetypeId?: string;
  hp?: number;
  weaponId?: string;
  x: number;
  y: number;
  color?: string;
  side: 'player' | 'enemy';
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
  weaponName: string;
}

// ---- SimpleUnit class -------------------------------------------------------

class SimpleUnit {
  scene: Phaser.Scene;
  body: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Graphics;
  hp: number;
  maxHp: number;
  weaponId: string;
  name: string;
  color: number;
  weaponNameText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, config: SimpleUnitConfig) {
    this.scene = scene;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.weaponId = config.weaponId;
    this.name = config.name;
    this.color = config.color;

    this.body = scene.add.rectangle(config.x, config.y, 40, 50, this.color);
    this.body.setStrokeStyle(2, 0xffffff);

    this.hpBar = scene.add.graphics();
    this.drawHpBar();

    this.weaponNameText = scene.add.text(config.x, config.y - 55, config.weaponName, {
      fontSize: '12px',
      color: '#cccccc',
    }).setOrigin(0.5);
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
    this.weaponNameText.y = y - 55;
    this.drawHpBar();
  }

  destroy() {
    this.body.destroy();
    this.hpBar.destroy();
    this.weaponNameText.destroy();
  }
}

// ---- GameScene class --------------------------------------------------------

export class GameScene extends Phaser.Scene {
  private player!: SimpleUnit;
  private ai!: SimpleUnit;
  private turnText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private isPlayerTurn: boolean = true;
  private isAnimating: boolean = false;
  private weaponMap: Map<string, WeaponDef> = new Map();
  private unitClassMap: Map<string, UnitClassDef> = new Map();
  private missionList: MissionDef[] = [];
  private currentMissionIndex: number = 0;
  private mission!: MissionDef;
  private terrainHeights!: number[];
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private missionNameText!: Phaser.GameObjects.Text;

  // Overlay containers (for start and result)
  private overlayContainer!: Phaser.GameObjects.Container;
  private overlayBg!: Phaser.GameObjects.Rectangle;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlaySubtitle!: Phaser.GameObjects.Text;

  private battleStarted: boolean = false;
  private gameOver: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  async create(data?: { missionIndex?: number }) {
    // ── Reset all state that may have survived from a previous life ──
    this.resetState();

    // Clear stale keyboard listeners from previous runs
    this.input.keyboard!.removeAllListeners();

    // Ensure all listeners are removed when the scene is shut down
    this.events.once('shutdown', () => {
      this.input.keyboard!.removeAllListeners(true);
    });

    const requestedIndex = data?.missionIndex ?? 0;

    const loadText = this.add
      .text(400, 300, 'Loading…', { fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5);

    const [weaponMap, unitClassMap, missions] = await Promise.all([
      this.loadWeapons(),
      this.loadUnitClasses(),
      this.loadMissions(),
    ]);

    this.weaponMap = weaponMap;
    this.unitClassMap = unitClassMap;
    this.missionList = missions.length ? missions : [this.getFallbackMission()];
    // Clamp index
    this.currentMissionIndex = Phaser.Math.Clamp(requestedIndex, 0, this.missionList.length - 1);
    this.mission = this.missionList[this.currentMissionIndex];

    // Build terrain (always same for now)
    this.initTerrain();

    // Clear loading text and build permanent objects
    this.children.removeAll(true);
    this.buildTerrain();

    // Create overlay (will be shown before battle starts)
    this.createOverlay();

    // Setup units and UI (they exist but hidden until battle starts)
    this.setupGameObjects();

    // Show start overlay
    this.showStartOverlay();
  }

  // ── Reset all combat / scene state to defaults ──
  private resetState(): void {
    this.isPlayerTurn = true;
    this.isAnimating = false;
    this.battleStarted = false;
    this.gameOver = false;

    // Clear the overlay references (they will be re‑created in create)
    // (For safety, destroy if they exist from a previous run)
    // They are re‑assigned in createOverlay anyway.
    this.overlayContainer = undefined as unknown as Phaser.GameObjects.Container;
    this.overlayBg = undefined as unknown as Phaser.GameObjects.Rectangle;
    this.overlayTitle = undefined as unknown as Phaser.GameObjects.Text;
    this.overlaySubtitle = undefined as unknown as Phaser.GameObjects.Text;

    // Clear any unit references (they will be re‑created in setupGameObjects)
    // The old SimpleUnit instances are destroyed when children are removed
    this.player = undefined as unknown as SimpleUnit;
    this.ai = undefined as unknown as SimpleUnit;
  }

  // ---- Load methods (unchanged structure) -----------------------------------

  private async loadWeapons(): Promise<Map<string, WeaponDef>> {
    const backendUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const url = `${backendUrl}/weapons`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch weapons: ${res.statusText}`);
      const weapons: WeaponDef[] = await res.json();
      const map = new Map<string, WeaponDef>();
      for (const w of weapons) map.set(w.id, w);
      return map;
    } catch (err) {
      console.warn('Could not reach backend – using fallback weapon definitions', err);
      const map = new Map<string, WeaponDef>();
      map.set('basic_cannon', {
        id: 'basic_cannon', name: 'Basic Cannon', damage: 3, range: 200,
        projectileColor: '#ffcc00', explosionRadius: 30,
      });
      map.set('sniper_cannon', {
        id: 'sniper_cannon', name: 'Sniper Cannon', damage: 5, range: 400,
        projectileColor: '#ff4444', explosionRadius: 10,
      });
      map.set('cluster_bomb', {
        id: 'cluster_bomb', name: 'Cluster Bomb', damage: 1, range: 150,
        projectileColor: '#ff8800', explosionRadius: 60,
      });
      return map;
    }
  }

  private async loadUnitClasses(): Promise<Map<string, UnitClassDef>> {
    const backendUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const url = `${backendUrl}/unit_classes`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch unit classes: ${res.statusText}`);
      const classes: UnitClassDef[] = await res.json();
      const map = new Map<string, UnitClassDef>();
      for (const c of classes) map.set(c.id, c);
      return map;
    } catch (err) {
      console.warn('Could not reach backend – using fallback unit classes', err);
      const map = new Map<string, UnitClassDef>();
      map.set('soldier', { id: 'soldier', name: 'Soldier', baseHp: 10,
        allowedWeaponIds: ['basic_cannon', 'sniper_cannon'], color: '0x4488ff', description: 'Balanced all-rounder' });
      map.set('scout', { id: 'scout', name: 'Scout', baseHp: 8,
        allowedWeaponIds: ['sniper_cannon'], color: '0x44ff44', description: 'Fast, fragile, accurate' });
      map.set('heavy', { id: 'heavy', name: 'Heavy', baseHp: 15,
        allowedWeaponIds: ['basic_cannon', 'cluster_bomb'], color: '0xff4444', description: 'Slow but tough, area damage' });
      return map;
    }
  }

  private async loadMissions(): Promise<MissionDef[]> {
    const backendUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const url = `${backendUrl}/missions`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch missions: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.warn('Could not reach backend – using fallback mission list', err);
      return [this.getFallbackMission(), this.getSecondMission()];
    }
  }

  private getFallbackMission(): MissionDef {
    return {
      id: 'fallback_demo', name: 'Training Ground',
      units: [
        { id: 'player', archetypeId: 'soldier', weaponId: 'basic_cannon', x: 150, y: 400, side: 'player' },
        { id: 'ai', archetypeId: 'heavy', weaponId: 'cluster_bomb', x: 650, y: 400, side: 'enemy' },
      ],
    };
  }

  private getSecondMission(): MissionDef {
    return {
      id: 'second_fallback', name: 'Second Battle',
      units: [
        { id: 'player', archetypeId: 'scout', weaponId: 'sniper_cannon', x: 150, y: 400, side: 'player' },
        { id: 'ai', archetypeId: 'soldier', weaponId: 'basic_cannon', x: 650, y: 400, side: 'enemy' },
      ],
    };
  }

  // ---- Terrain ---------------------------------------------------------------

  private initTerrain(): void {
    this.terrainHeights = new Array(800);
    for (let x = 0; x < 800; x++) {
      let h = 450;
      if (x >= 200 && x < 400) {
        if (x <= 300) h = 450 - ((x - 200) / 100) * 70;
        else h = 450 - ((400 - x) / 100) * 70;
      }
      if (x >= 400 && x <= 600) {
        if (x <= 500) h = 450 - ((x - 400) / 100) * 70;
        else h = 450 - ((600 - x) / 100) * 70;
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
    const standY = groundY - 25;
    if (unit.body.y < standY) unit.setY(standY);
  }

  // ---- Overlay system --------------------------------------------------------

  private createOverlay(): void {
    this.overlayBg = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
    this.overlayTitle = this.add.text(400, 250, '', { fontSize: '36px', color: '#ffffff' }).setOrigin(0.5);
    this.overlaySubtitle = this.add.text(400, 320, '', { fontSize: '20px', color: '#cccccc' }).setOrigin(0.5);
    this.overlayContainer = this.add.container(0, 0, [
      this.overlayBg, this.overlayTitle, this.overlaySubtitle,
    ]);
  }

  private showStartOverlay(): void {
    this.overlayBg.setVisible(true);
    this.overlayTitle.setText(this.mission.name);
    this.overlaySubtitle.setText('Press SPACE to start');
    this.overlayContainer.setVisible(true);
    this.battleStarted = false;
    this.gameOver = false;

    // Use an `on` listener instead of `once` to ensure it works after scene restarts
    // It will be removed later when battle starts or when scene is destroyed.
    const startHandler = () => {
      if (!this.battleStarted && this.overlayContainer.visible) {
        this.battleStarted = true;
        this.overlayContainer.setVisible(false);
        this.startBattle();
        // Remove this specific listener to prevent double firing
        this.input.keyboard!.off('keydown-SPACE', startHandler);
      }
    };
    this.input.keyboard!.on('keydown-SPACE', startHandler);
  }

  private showResultOverlay(victory: boolean): void {
    this.overlayBg.setVisible(true);
    this.overlayTitle.setText(victory ? 'VICTORY!' : 'DEFEAT!');
    const hasNext = this.currentMissionIndex + 1 < this.missionList.length;
    let subtitle = 'R  Restart | M  Menu';
    if (hasNext) subtitle += ' | N  Next';
    this.overlaySubtitle.setText(subtitle);
    this.overlayContainer.setVisible(true);
    this.gameOver = true;
    this.isAnimating = true;
    this.isPlayerTurn = false;

    // Handle keyboard inputs after game over
    this.input.keyboard!.once('keydown-R', () => {
      this.scene.restart({ missionIndex: this.currentMissionIndex });
    });
    if (hasNext) {
      this.input.keyboard!.once('keydown-N', () => {
        this.scene.restart({ missionIndex: this.currentMissionIndex + 1 });
      });
    }
    this.input.keyboard!.once('keydown-M', () => {
      this.scene.start('MenuScene');
    });
  }

  // ---- Unit resolution -------------------------------------------------------

  private resolveUnitConfig(cfg: UnitConfig): { hp: number; weaponId: string; color: number; weaponName: string } {
    const archetypeId = cfg.archetypeId || 'soldier';
    const archetype = this.unitClassMap.get(archetypeId);
    if (!archetype) {
      console.warn(`Unknown archetype "${archetypeId}" – falling back to soldier`);
      return this.resolveUnitConfig({ ...cfg, archetypeId: 'soldier' });
    }

    const hp = cfg.hp !== undefined ? cfg.hp : archetype.baseHp;
    let weaponId = cfg.weaponId || archetype.allowedWeaponIds[0];
    if (archetype.allowedWeaponIds.indexOf(weaponId) === -1) {
      console.warn(`Weapon "${weaponId}" not allowed for archetype "${archetypeId}" – falling back`);
      weaponId = archetype.allowedWeaponIds[0];
    }

    const colorStr = cfg.color || archetype.color;
    const color = parseInt(colorStr);

    // Look up weapon name
    const weaponDef = this.weaponMap.get(weaponId);
    const weaponName = weaponDef ? weaponDef.name : weaponId;

    return { hp, weaponId, color, weaponName };
  }

  private setupGameObjects(): void {
    const playerCfg = this.mission.units.find((u) => u.side === 'player');
    const aiCfg = this.mission.units.find((u) => u.side === 'enemy');

    if (!playerCfg || !aiCfg) {
      throw new Error('Mission must have exactly one player and one enemy unit');
    }

    const playerResolved = this.resolveUnitConfig(playerCfg);
    const aiResolved = this.resolveUnitConfig(aiCfg);

    this.player = new SimpleUnit(this, {
      x: playerCfg.x, y: playerCfg.y,
      hp: playerResolved.hp,
      weaponId: playerResolved.weaponId,
      color: playerResolved.color,
      name: 'Player',
      weaponName: playerResolved.weaponName,
    });

    this.ai = new SimpleUnit(this, {
      x: aiCfg.x, y: aiCfg.y,
      hp: aiResolved.hp,
      weaponId: aiResolved.weaponId,
      color: aiResolved.color,
      name: 'AI',
      weaponName: aiResolved.weaponName,
    });

    const playerGround = this.terrainHeights[Math.round(playerCfg.x)];
    const aiGround = this.terrainHeights[Math.round(aiCfg.x)];
    this.player.setY(playerGround - 25);
    this.ai.setY(aiGround - 25);

    // UI texts (hidden until battle start)
    this.missionNameText = this.add.text(400, 20, this.mission.name, { fontSize: '20px', color: '#cccccc' }).setOrigin(0.5);
    this.turnText = this.add.text(400, 60, '', { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
    this.statusText = this.add.text(400, 100, '', { fontSize: '18px', color: '#cccccc' }).setOrigin(0.5);
  }

  private startBattle(): void {
    // Enable input for firing
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (this.isPlayerTurn && !this.isAnimating && this.player.isAlive()) {
        this.playerAttack();
      }
    });
    this.turnText.setText('Player Turn – press SPACE to fire');
  }

  // ---- AI helpers ------------------------------------------------------------

  private getAITargets(): SimpleUnit[] {
    const targets: SimpleUnit[] = [];
    if (this.player.isAlive()) targets.push(this.player);
    return targets;
  }

  private getAIAimPoint(target: SimpleUnit): { x: number; y: number } {
    return { x: target.body.x, y: target.body.y - 25 };
  }

  // ---- Turn logic ------------------------------------------------------------

  private playerAttack() {
    this.isAnimating = true;
    const damage = this.getWeaponDamage(this.player.weaponId);
    this.fireProjectile(this.player, this.ai, damage, () => {
      if (!this.player.isAlive() || !this.ai.isAlive()) {
        this.showResultOverlay(this.player.isAlive());
        return;
      }
      this.time.delayedCall(500, () => this.aiTurn());
    });
  }

  private aiTurn() {
    this.isPlayerTurn = false;
    this.turnText.setText('AI Turn');
    this.statusText.setText('');
    this.time.delayedCall(800, () => {
      const targets = this.getAITargets();
      if (targets.length === 0) {
        this.showResultOverlay(true);
        return;
      }
      const target = targets[0];
      const damage = this.getWeaponDamage(this.ai.weaponId);
      const aimPoint = this.getAIAimPoint(target);
      this.fireProjectile(this.ai, target, damage, () => {
        if (!this.player.isAlive() || !this.ai.isAlive()) {
          this.showResultOverlay(this.player.isAlive());
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

  // ---- Projectile / damage ---------------------------------------------------

  private fireProjectile(
    from: SimpleUnit, to: SimpleUnit, damage: number,
    onComplete: () => void, targetX?: number, targetY?: number,
  ) {
    const color = this.getProjectileColor(from.weaponId);
    const weaponDef = this.getWeaponDef(from.weaponId);
    const explosionRadius = weaponDef ? weaponDef.explosionRadius : 30;
    const projectile = this.add.circle(from.body.x, from.body.y - 25, 6, color);
    const destX = targetX !== undefined ? targetX : to.body.x;
    const destY = targetY !== undefined ? targetY : to.body.y - 25;

    this.tweens.add({
      targets: projectile,
      x: destX, y: destY,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        projectile.destroy();
        to.takeDamage(damage);
        this.statusText.setText(`${from.name} dealt ${damage} damage`);

        // Explosion effect
        const explosion = this.add.circle(destX, destY, 6, 0xffff00, 0.6);
        this.tweens.add({
          targets: explosion,
          scaleX: explosionRadius / 6,
          scaleY: explosionRadius / 6,
          alpha: 0,
          duration: 200,
          ease: 'Quad.easeOut',
          onComplete: () => explosion.destroy(),
        });

        this.destroyTerrain(destX, destY, explosionRadius);
        this.applyGravity(this.player);
        this.applyGravity(this.ai);
        onComplete();
      },
    });
  }

  // ---- Weapon lookups -------------------------------------------------------

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
}
