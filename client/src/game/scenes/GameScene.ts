import Phaser from 'phaser';
import {
  WeaponDef,
  UnitClassDef,
  UnitConfig,
  MissionDef,
} from '../types';
import { SimpleUnit } from '../SimpleUnit';
import {
  FALLBACK_MISSIONS,
  FALLBACK_WEAPONS,
  FALLBACK_UNIT_CLASSES,
} from '../fallbackData';

// ---- GameScene class --------------------------------------------------------

export class GameScene extends Phaser.Scene {
  private player!: SimpleUnit;
  private ai!: SimpleUnit;
  private turnText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private damageTween: Phaser.Tweens.Tween | null = null;
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

  // Reference to the combat SPACE handler so it can be cleaned up
  private spaceHandler: (() => void) | null = null;

  // --- NEW: movement, aiming, wind ---
  private moveBudget: number = 60;
  private playerMoved: number = 0;
  private aimAngle: number = 45;          // degrees (0-90)
  private aimPower: number = 1.0;          // multiplier (0.5-1.5)
  private wind: number = 0;
  private aimLineGraphic!: Phaser.GameObjects.Graphics;
  private windText!: Phaser.GameObjects.Text;
  private paramText!: Phaser.GameObjects.Text;

  // key handlers (to remove later)
  private moveLeftKey: Phaser.Input.Keyboard.Key | null = null;
  private moveRightKey: Phaser.Input.Keyboard.Key | null = null;
  private aimUpKey: Phaser.Input.Keyboard.Key | null = null;
  private aimDownKey: Phaser.Input.Keyboard.Key | null = null;
  private powerUpKey: Phaser.Input.Keyboard.Key | null = null;
  private powerDownKey: Phaser.Input.Keyboard.Key | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  async create(data?: { missionIndex?: number }) {
    this.resetState();
    this.input.keyboard!.removeAllListeners();
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
    this.missionList = missions.length ? missions : FALLBACK_MISSIONS;
    this.currentMissionIndex = Phaser.Math.Clamp(requestedIndex, 0, this.missionList.length - 1);
    this.mission = this.missionList[this.currentMissionIndex];

    this.initTerrain();
    this.children.removeAll(true);
    this.buildTerrain();
    this.createOverlay();
    this.setupGameObjects();
    this.createAimAndWindUI();
    this.showStartOverlay();
  }

  // ── new UI elements ──
  private createAimAndWindUI() {
    this.aimLineGraphic = this.add.graphics();

    this.windText = this.add.text(700, 20, 'Wind: 0', {
      fontSize: '14px', color: '#ffffff',
    }).setOrigin(1, 0);

    this.paramText = this.add.text(700, 40, 'Angle: 45°  Pow: 1.0', {
      fontSize: '14px', color: '#ffffff',
    }).setOrigin(1, 0);
  }

  private updateAimUI() {
    this.paramText.setText(`Angle: ${this.aimAngle}°  Pow: ${this.aimPower.toFixed(1)}`);
    this.redrawAimLine();
  }

  private redrawAimLine() {
    this.aimLineGraphic.clear();
    if (!this.player || !this.player.isAlive()) return;

    const startX = this.player.body.x;
    const startY = this.player.body.y - 25;

    // Use the exact same constants as the actual projectile
    const angleRad = Phaser.Math.DegToRad(this.aimAngle);
    const speed = 400 * this.aimPower;
    const g = 400;
    const windFactor = 20;

    const vx = Math.cos(angleRad) * speed;
    const vy = -Math.sin(angleRad) * speed;

    const steps = 20;
    const dt = 0.04;

    this.aimLineGraphic.lineStyle(1, 0xffff00, 0.6);
    let t = 0;
    for (let i = 0; i < steps; i++) {
      const nextT = t + dt;
      const x = startX + vx * nextT + this.wind * nextT * windFactor;
      const y = startY + vy * nextT + 0.5 * g * nextT * nextT;
      this.aimLineGraphic.fillStyle(0xffff00, 0.6);
      this.aimLineGraphic.fillCircle(x, y, 2);
      t = nextT;
    }
  }

  // ---- Reset all combat / scene state to defaults ──
  private resetState(): void {
    this.isPlayerTurn = true;
    this.isAnimating = false;
    this.battleStarted = false;
    this.gameOver = false;
    this.spaceHandler = null;
    this.damageTween = null;
    this.playerMoved = 0;
    this.aimAngle = 45;
    this.aimPower = 1.0;
    this.wind = 0;

    this.overlayContainer = undefined as unknown as Phaser.GameObjects.Container;
    this.overlayBg = undefined as unknown as Phaser.GameObjects.Rectangle;
    this.overlayTitle = undefined as unknown as Phaser.GameObjects.Text;
    this.overlaySubtitle = undefined as unknown as Phaser.GameObjects.Text;

    this.player = undefined as unknown as SimpleUnit;
    this.ai = undefined as unknown as SimpleUnit;
  }

  // ---- Load methods (unchanged) --------------------------------------------
  private async loadWeapons(): Promise<Map<string, WeaponDef>> {
    const backendUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const url = `${backendUrl}/weapons`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch weapons: ${res.statusText}`);
      const weapons: WeaponDef[] = await res.json();
      return new Map(weapons.map(w => [w.id, w]));
    } catch (err) {
      console.warn('Could not reach backend – using fallback weapon definitions', err);
      return new Map(FALLBACK_WEAPONS.map(w => [w.id, w]));
    }
  }

  private async loadUnitClasses(): Promise<Map<string, UnitClassDef>> {
    const backendUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const url = `${backendUrl}/unit_classes`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch unit classes: ${res.statusText}`);
      const classes: UnitClassDef[] = await res.json();
      return new Map(classes.map(c => [c.id, c]));
    } catch (err) {
      console.warn('Could not reach backend – using fallback unit classes', err);
      return new Map(FALLBACK_UNIT_CLASSES.map(c => [c.id, c]));
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
      return FALLBACK_MISSIONS;
    }
  }

  // ---- Terrain (unchanged) -------------------------------------------------
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

  // ---- Overlay system (unchanged) ------------------------------------------
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

    this.input.keyboard!.once('keydown-SPACE', () => {
      if (!this.battleStarted && this.overlayContainer.visible) {
        this.battleStarted = true;
        this.overlayContainer.setVisible(false);
        this.startBattle();
      }
    });
  }

  private showResultOverlay(victory: boolean): void {
    // Clear aim line graphic before showing result
    this.aimLineGraphic.clear();

    this.turnText.setVisible(false);
    if (this.damageTween) {
      this.damageTween.stop();
      this.damageTween = null;
    }
    this.statusText.setAlpha(1);
    this.statusText.setText('');

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

    if (this.spaceHandler) {
      this.input.keyboard!.off('keydown-SPACE', this.spaceHandler);
      this.spaceHandler = null;
    }

    // play sound
    this.playSound(victory ? 'victory' : 'defeat');

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

  // ---- Unit resolution (unchanged) -----------------------------------------
  private parseColor(colorStr: string): number {
    if (!colorStr) return 0xffffff;
    if (colorStr.startsWith('#'))
      return Phaser.Display.Color.HexStringToColor(colorStr).color;
    return Number(colorStr);
  }

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
    const color = this.parseColor(colorStr);

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

    if (aiCfg.color === undefined) {
      aiResolved.color = 0xff4444;
    }

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

    this.missionNameText = this.add.text(400, 20, this.mission.name, { fontSize: '20px', color: '#cccccc' }).setOrigin(0.5);
    this.turnText = this.add.text(400, 60, '', { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
    this.statusText = this.add.text(400, 100, '', { fontSize: '18px', color: '#cccccc' }).setOrigin(0.5);
  }

  // ---- startBattle (set up keys) -------------------------------------------
  private startBattle(): void {
    this.generateWind();

    this.moveLeftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.moveRightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.aimUpKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.aimDownKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.powerUpKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.powerDownKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.spaceHandler = () => {
      if (this.isPlayerTurn && !this.isAnimating && this.player.isAlive()) {
        this.playerAttack();
      }
    };
    this.input.keyboard!.on('keydown-SPACE', this.spaceHandler);
    this.turnText.setText('Player Turn – move arrows, aim up/down, Q/E power, SPACE fire');
  }

  // ---- movement / aim update (called each frame if needed) ------------------
  update() {
    if (!this.battleStarted || this.gameOver) return;
    if (!this.isPlayerTurn || this.isAnimating || !this.player.isAlive()) return;

    // movement
    const moveStep = 6; // pixels per key press (frame)
    if (Phaser.Input.Keyboard.JustDown(this.moveLeftKey!)) {
      const newX = Math.max(0, this.player.body.x - moveStep);
      const moved = this.player.body.x - newX;
      if (this.playerMoved + moved <= this.moveBudget) {
        this.player.setX(newX);
        this.playerMoved += moved;
        this.applyGravity(this.player);
        this.redrawAimLine();
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.moveRightKey!)) {
      const newX = Math.min(800, this.player.body.x + moveStep);
      const moved = newX - this.player.body.x;
      if (this.playerMoved + moved <= this.moveBudget) {
        this.player.setX(newX);
        this.playerMoved += moved;
        this.applyGravity(this.player);
        this.redrawAimLine();
      }
    }

    // aim angle
    if (Phaser.Input.Keyboard.JustDown(this.aimUpKey!)) {
      this.aimAngle = Math.min(90, this.aimAngle + 3);
      this.updateAimUI();
    }
    if (Phaser.Input.Keyboard.JustDown(this.aimDownKey!)) {
      this.aimAngle = Math.max(0, this.aimAngle - 3);
      this.updateAimUI();
    }

    // power
    if (Phaser.Input.Keyboard.JustDown(this.powerUpKey!)) {
      this.aimPower = Math.min(1.5, this.aimPower + 0.1);
      this.updateAimUI();
    }
    if (Phaser.Input.Keyboard.JustDown(this.powerDownKey!)) {
      this.aimPower = Math.max(0.5, this.aimPower - 0.1);
      this.updateAimUI();
    }
  }

  // ---- AI helpers ----------------------------------------------------------
  private getAITargets(): SimpleUnit[] {
    const targets: SimpleUnit[] = [];
    if (this.player.isAlive()) targets.push(this.player);
    return targets;
  }

  private getAIAimPoint(target: SimpleUnit): { x: number; y: number } {
    return {
      x: target.body.x + Phaser.Math.Between(-35, 35),
      y: target.body.y - 25,
    };
  }

  // new: compute AI aim angle and power
  private computeAIAim(from: SimpleUnit, to: SimpleUnit): { angle: number; power: number } {
    const dx = to.body.x - from.body.x;
    const dy = (from.body.y - 25) - (to.body.y - 25); // source higher is negative
    // rough angle (ignoring wind) – we'll just aim directly then add skill variance
    const baseAngle = Phaser.Math.RadToDeg(Math.atan2(-dy, dx)); // angle above horizontal
    // clamp to 5-85
    const clamped = Phaser.Math.Clamp(baseAngle, 5, 85);
    const skillVariance = Phaser.Math.FloatBetween(-8, 8); // AI skill
    return {
      angle: Phaser.Math.Clamp(clamped + skillVariance, 5, 85),
      power: Phaser.Math.FloatBetween(0.9, 1.1),
    };
  }

  // ---- Turn logic ----------------------------------------------------------
  private playerAttack() {
    this.isAnimating = true;

    if (this.damageTween) {
      this.damageTween.stop();
      this.damageTween = null;
    }
    this.statusText.setAlpha(0);
    this.statusText.setText('');

    this.turnText.setText('AI Turn – thinking…');

    // use current aim & power
    const angle = this.aimAngle;
    const power = this.aimPower;
    const damage = this.getWeaponDamage(this.player.weaponId);

    this.fireProjectile(this.player, this.ai, damage, angle, power, () => {
      this.playerMoved = 0;
      if (!this.player.isAlive() || !this.ai.isAlive()) {
        this.showResultOverlay(this.player.isAlive());
        return;
      }
      this.time.delayedCall(500, () => this.aiTurn());
    });
  }

  private aiTurn() {
    // Clear aim line during AI turn
    this.aimLineGraphic.clear();

    this.isPlayerTurn = false;

    if (this.damageTween) {
      this.damageTween.stop();
      this.damageTween = null;
    }
    this.statusText.setAlpha(0);
    this.statusText.setText('');

    // AI movement (simple random shift within budget)
    const aiMoveBudget = 40;
    const shift = Phaser.Math.Between(0, aiMoveBudget);
    const direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    const newX = Phaser.Math.Clamp(this.ai.body.x + shift * direction, 0, 800);
    this.ai.body.x = newX;
    this.applyGravity(this.ai);

    this.time.delayedCall(800, () => {
      const targets = this.getAITargets();
      if (targets.length === 0) {
        this.showResultOverlay(true);
        return;
      }
      const target = targets[0];
      const damage = this.getWeaponDamage(this.ai.weaponId);

      // AI uses computed aim
      const { angle, power } = this.computeAIAim(this.ai, target);
      const aimPoint = this.getAIAimPoint(target);

      this.fireProjectile(this.ai, target, damage, angle, power, () => {
        if (!this.player.isAlive() || !this.ai.isAlive()) {
          this.showResultOverlay(this.player.isAlive());
          return;
        }
        this.time.delayedCall(500, () => {
          this.isPlayerTurn = true;
          this.isAnimating = false;
          this.playerMoved = 0;
          this.generateWind();
          this.updateAimUI();
          this.turnText.setText('Player Turn – move arrows, aim up/down, Q/E power, SPACE fire');
        });
      }, aimPoint.x, aimPoint.y);
    });
  }

  // ---- Projectile physics --------------------------------------------------
  private fireProjectile(
    from: SimpleUnit, to: SimpleUnit,
    damage: number,
    angleDeg: number, powerMult: number,
    onComplete: () => void,
    targetAimX?: number, targetAimY?: number,
  ) {
    const color = this.getProjectileColor(from.weaponId);
    const weaponDef = this.getWeaponDef(from.weaponId);
    const explosionRadius = weaponDef ? weaponDef.explosionRadius : 30;

    const startX = from.body.x;
    const startY = from.body.y - 25;

    // determine target position (used only for collision detection? we'll just land on target)
    const destX = targetAimX !== undefined ? targetAimX : to.body.x;
    const destY = targetAimY !== undefined ? targetAimY : to.body.y - 25;

    const projectile = this.add.circle(startX, startY, 6, color);

    // Play shoot sound at launch
    this.playSound('shoot');

    // physics parameters
    const angleRad = Phaser.Math.DegToRad(angleDeg);
    const baseSpeed = 400; // pixels/s
    const vx0 = Math.cos(angleRad) * baseSpeed * powerMult;
    const vy0 = -Math.sin(angleRad) * baseSpeed * powerMult; // upward negative
    const gravity = 400; // pixels/s²
    const windFactor = 20;

    // flight time from vertical motion? We'll just animate over 800ms
    const duration = 800;
    const totalTime = duration / 1000; // seconds

    // We'll compute position using t from 0 to totalTime, mapping tween progress to time
    const tweenData = { t: 0 };

    this.tweens.add({
      targets: tweenData,
      t: totalTime,
      duration: duration,
      ease: 'Linear',
      onUpdate: () => {
        const t = tweenData.t;
        const x = startX + vx0 * t + this.wind * t * windFactor; // wind horizontal drift
        const y = startY + vy0 * t + 0.5 * gravity * t * t;
        projectile.setPosition(x, y);
      },
      onComplete: () => {
        projectile.destroy();

        // check if projectile lands near enemy (simple: distance to destX, destY < 20)
        const landX = startX + vx0 * totalTime + this.wind * totalTime * windFactor;
        const landY = startY + vy0 * totalTime + 0.5 * gravity * totalTime * totalTime;
        const distToTarget = Phaser.Math.Distance.Between(landX, landY, destX, destY);
        const hit = distToTarget < 30; // hit radius

        if (hit) {
          to.takeDamage(damage);
          this.statusText.setText(`${from.name} dealt ${damage} damage`);
          this.statusText.setAlpha(1);
          if (this.damageTween) {
            this.damageTween.stop();
            this.damageTween = null;
          }
          this.damageTween = this.tweens.add({
            targets: this.statusText,
            alpha: 0,
            delay: 1000,
            duration: 600,
            onComplete: () => { this.damageTween = null; },
          });
        } else {
          this.statusText.setText(`${from.name} missed!`);
          this.statusText.setAlpha(1);
          if (this.damageTween) {
            this.damageTween.stop();
            this.damageTween = null;
          }
          this.damageTween = this.tweens.add({
            targets: this.statusText,
            alpha: 0,
            delay: 1500,
            duration: 600,
            onComplete: () => { this.damageTween = null; },
          });
        }

        // explosion always at impact point
        const explosionX = landX;
        const explosionY = landY;
        const explosion = this.add.circle(explosionX, explosionY, 6, 0xffff00, 0.6);
        this.tweens.add({
          targets: explosion,
          scaleX: explosionRadius / 6,
          scaleY: explosionRadius / 6,
          alpha: 0,
          duration: 200,
          ease: 'Quad.easeOut',
          onComplete: () => explosion.destroy(),
        });

        this.playSound('explosion');

        this.destroyTerrain(explosionX, explosionY, explosionRadius);
        this.applyGravity(this.player);
        this.applyGravity(this.ai);

        // death animation
        const targetDead = hit && !to.isAlive();
        if (targetDead) {
          to.playDeathAnimation(() => {
            onComplete();
          });
        } else {
          onComplete();
        }
      },
    });
  }

  // ---- Wind generation -----------------------------------------------------
  private generateWind() {
    this.wind = Phaser.Math.FloatBetween(-3, 3);
    this.windText.setText(`Wind: ${this.wind.toFixed(1)}`);
  }

  // ---- Sound effects (simple Web Audio) ------------------------------------
  private playSound(type: 'shoot' | 'explosion' | 'victory' | 'defeat') {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      switch (type) {
        case 'shoot':
          osc.frequency.setValueAtTime(300, now);
          osc.type = 'square';
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        case 'explosion':
          osc.frequency.setValueAtTime(80, now);
          osc.type = 'sawtooth';
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        case 'victory':
          osc.frequency.setValueAtTime(523, now);
          osc.frequency.setValueAtTime(659, now + 0.15);
          osc.frequency.setValueAtTime(784, now + 0.3);
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
          break;
        case 'defeat':
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.linearRampToValueAtTime(100, now + 0.4);
          osc.type = 'sawtooth';
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
          break;
      }
    } catch {
      // audio not available – silently ignore
    }
  }

  // ---- Weapon lookups (unchanged) ------------------------------------------
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
