import Phaser from 'phaser';
import {
  WeaponDef,
  UnitClassDef,
  UnitConfig,
  MissionDef,
} from '../types';
import { SimpleUnit } from '../SimpleUnit';
import { TerrainManager } from '../TerrainManager';
import {
  getProjectileStateAtTime,
  calculateAIAim,
  calculateTargetDirection,
  checkContinuousTerrainCollision,
} from '../ballistics';
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
  private terrainManager!: TerrainManager;
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

  // --- movement, aiming, wind ---
  private moveBudget: number = 10000; // effectively unlimited
  private playerMoved: number = 0;
  private aimAngle: number = 45;          // degrees (0-90)
  private aimPower: number = 1.0;          // multiplier (0.5-1.5)
  private wind: number = 0;
  private aimLineGraphic!: Phaser.GameObjects.Graphics;
  private windText!: Phaser.GameObjects.Text;
  private paramText!: Phaser.GameObjects.Text;

  // key handlers
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
      this.input.keyboard!.removeAllListeners();
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

    this.terrainManager = new TerrainManager(this);
    this.terrainManager.init();
    this.children.removeAll(true);
    this.terrainManager.build();
    this.createOverlay();
    this.setupGameObjects();
    this.createAimAndWindUI();
    this.showStartOverlay();
  }

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
    if (!this.player || !this.player.isAlive() || !this.ai) return;

    const startX = this.player.body.x;
    const startY = this.player.body.y - 25;
    const dirX = calculateTargetDirection(startX, this.ai.body.x);

    const steps = 25;
    const dt = 0.04;

    this.aimLineGraphic.lineStyle(1, 0xffff00, 0.6);
    let t = 0;
    for (let i = 0; i < steps; i++) {
      t += dt;
      const state = getProjectileStateAtTime(
        {
          startX,
          startY,
          angleDeg: this.aimAngle,
          powerMult: this.aimPower,
          dirX,
          wind: this.wind,
        },
        t
      );
      this.aimLineGraphic.fillStyle(0xffff00, 0.6);
      this.aimLineGraphic.fillCircle(state.x, state.y, 2);
    }
  }

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

  private applyGravity(unit: SimpleUnit): void {
    const x = Math.round(unit.body.x);
    if (x < 0 || x >= 800) return;
    const groundY = this.terrainManager.getGroundHeight(x);
    const standY = groundY - 25;
    unit.setY(standY);
  }

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

    // Force team colors: player green, enemy red
    playerResolved.color = 0x44ff44;
    aiResolved.color = 0xff4444;

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

    const playerGround = this.terrainManager.getGroundHeight(playerCfg.x);
    const aiGround = this.terrainManager.getGroundHeight(aiCfg.x);
    this.player.setY(playerGround - 25);
    this.ai.setY(aiGround - 25);

    this.missionNameText = this.add.text(400, 20, this.mission.name, { fontSize: '20px', color: '#cccccc' }).setOrigin(0.5);
    this.turnText = this.add.text(400, 60, '', { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5);
    this.statusText = this.add.text(400, 100, '', { fontSize: '18px', color: '#cccccc' }).setOrigin(0.5);
  }

  private startBattle(): void {
    this.generateWind();
    this.playerMoved = 0; // fresh budget

    this.input.keyboard!.on('keydown-LEFT', () => {
      if (this.isPlayerTurn && !this.isAnimating && this.player.isAlive()) {
        const newX = Math.max(0, this.player.body.x - 6);
        const moved = this.player.body.x - newX;
        if (this.playerMoved + moved <= this.moveBudget) {
          this.player.setX(newX);
          this.playerMoved += moved;
          this.applyGravity(this.player);
          this.redrawAimLine();
        }
      }
    });

    this.input.keyboard!.on('keydown-RIGHT', () => {
      if (this.isPlayerTurn && !this.isAnimating && this.player.isAlive()) {
        const newX = Math.min(800, this.player.body.x + 6);
        const moved = newX - this.player.body.x;
        if (this.playerMoved + moved <= this.moveBudget) {
          this.player.setX(newX);
          this.playerMoved += moved;
          this.applyGravity(this.player);
          this.redrawAimLine();
        }
      }
    });

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

  update() {
    if (!this.battleStarted || this.gameOver) return;
    if (!this.isPlayerTurn || this.isAnimating || !this.player.isAlive()) return;

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

  private computeAIAim(from: SimpleUnit, to: SimpleUnit): { angle: number; power: number; dirX: number } {
    const aiAim = calculateAIAim(from.body.x, from.body.y, to.body.x, to.body.y, this.wind);
    const skillVariance = Phaser.Math.FloatBetween(-4, 4);
    return {
      angle: Phaser.Math.Clamp(aiAim.angle + skillVariance, 5, 80),
      power: Phaser.Math.Clamp(aiAim.power * Phaser.Math.FloatBetween(0.95, 1.05), 0.5, 1.5),
      dirX: aiAim.dirX,
    };
  }

  private playerAttack() {
    this.isAnimating = true;

    if (this.damageTween) {
      this.damageTween.stop();
      this.damageTween = null;
    }
    this.statusText.setAlpha(0);
    this.statusText.setText('');

    this.turnText.setText('AI Turn – thinking…');

    const angle = this.aimAngle;
    const power = this.aimPower;
    const damage = this.getWeaponDamage(this.player.weaponId);
    const dirX = calculateTargetDirection(this.player.body.x, this.ai.body.x);

    this.fireProjectile(this.player, this.ai, damage, angle, power, dirX, () => {
      this.playerMoved = 0;
      if (!this.player.isAlive() || !this.ai.isAlive()) {
        this.showResultOverlay(this.player.isAlive());
        return;
      }
      this.time.delayedCall(500, () => this.aiTurn());
    });
  }

  private aiTurn() {
    this.aimLineGraphic.clear();

    this.isPlayerTurn = false;

    if (this.damageTween) {
      this.damageTween.stop();
      this.damageTween = null;
    }
    this.statusText.setAlpha(0);
    this.statusText.setText('');

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

      const { angle, power, dirX } = this.computeAIAim(this.ai, target);
      const aimPoint = this.getAIAimPoint(target);

      this.fireProjectile(
        this.ai,
        target,
        damage,
        angle,
        power,
        dirX,
        () => {
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
        },
        aimPoint.x,
        aimPoint.y
      );
    });
  }

  private fireProjectile(
    from: SimpleUnit,
    to: SimpleUnit,
    damage: number,
    angleDeg: number,
    powerMult: number,
    dirX: number,
    onComplete: () => void,
    targetAimX?: number,
    targetAimY?: number
  ) {
    const color = this.getProjectileColor(from.weaponId);
    const weaponDef = this.getWeaponDef(from.weaponId);
    const explosionRadius = weaponDef ? weaponDef.explosionRadius : 30;

    const startX = from.body.x;
    const startY = from.body.y - 25;

    const projectile = this.add.circle(startX, startY, 6, color);
    this.playSound('shoot');

    const projectileParams = {
      startX,
      startY,
      angleDeg,
      powerMult,
      dirX,
      wind: this.wind,
    };

    let elapsedSec = 0;
    let prevPos = { x: startX, y: startY };

    const maxFlightSec = 4.0;
    const timeStepSec = 0.016;

    const timer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        elapsedSec += timeStepSec;
        const currentPos = getProjectileStateAtTime(projectileParams, elapsedSec);
        projectile.setPosition(currentPos.x, currentPos.y);

        // 1. Continuous Terrain Collision Check
        const terrainHit = checkContinuousTerrainCollision(
          prevPos,
          currentPos,
          (x) => this.terrainManager.getGroundHeight(x),
          2
        );

        // 2. Target Hit Check
        const targetCenterY = targetAimY !== undefined ? targetAimY : to.body.y - 25;
        const targetCenterX = targetAimX !== undefined ? targetAimX : to.body.x;
        const distToTarget = Phaser.Math.Distance.Between(
          currentPos.x,
          currentPos.y,
          targetCenterX,
          targetCenterY
        );
        const unitHit = distToTarget < 25;

        // 3. Bounds Check
        const outOfBounds = currentPos.x < -50 || currentPos.x > 850 || currentPos.y > 650;

        if (terrainHit.hit || unitHit || outOfBounds || elapsedSec >= maxFlightSec) {
          timer.remove();
          projectile.destroy();

          const impactX =
            terrainHit.hit && terrainHit.impactPoint ? terrainHit.impactPoint.x : currentPos.x;
          const impactY =
            terrainHit.hit && terrainHit.impactPoint ? terrainHit.impactPoint.y : currentPos.y;

          // Explosion visuals
          const explosion = this.add.circle(impactX, impactY, 6, 0xffff00, 0.6);
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
          this.terrainManager.destroyTerrain(impactX, impactY, explosionRadius);

          // Explosion damage check
          const distToTo = Phaser.Math.Distance.Between(impactX, impactY, to.body.x, to.body.y - 25);
          const hitTarget = distToTo <= explosionRadius + 15;

          if (hitTarget) {
            to.takeDamage(damage);
            this.statusText.setText(`${from.name} dealt ${damage} damage`);
          } else {
            this.statusText.setText(`${from.name} missed!`);
          }

          this.statusText.setAlpha(1);
          if (this.damageTween) {
            this.damageTween.stop();
            this.damageTween = null;
          }
          this.damageTween = this.tweens.add({
            targets: this.statusText,
            alpha: 0,
            delay: 1200,
            duration: 600,
            onComplete: () => {
              this.damageTween = null;
            },
          });

          this.applyGravity(this.player);
          this.applyGravity(this.ai);

          const targetDead = hitTarget && !to.isAlive();
          if (targetDead) {
            to.playDeathAnimation(() => {
              onComplete();
            });
          } else {
            onComplete();
          }
          return;
        }

        prevPos = { x: currentPos.x, y: currentPos.y };
      },
    });
  }

  private generateWind() {
    this.wind = Phaser.Math.FloatBetween(-3, 3);
    this.windText.setText(`Wind: ${this.wind.toFixed(1)}`);
  }

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
