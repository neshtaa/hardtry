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
    this.missionList = missions.length ? missions : FALLBACK_MISSIONS;
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
    this.spaceHandler = null;
    this.damageTween = null;

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
      const map = new Map<string, UnitClassDef>();
      for (const c of classes) map.set(c.id, c);
      return map;
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

    // Use once so it auto-removes after being pressed
    this.input.keyboard!.once('keydown-SPACE', () => {
      if (!this.battleStarted && this.overlayContainer.visible) {
        this.battleStarted = true;
        this.overlayContainer.setVisible(false);
        this.startBattle();
      }
    });
  }

  private showResultOverlay(victory: boolean): void {
    // Hide turn text and damage text before showing result
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

    // Remove any stale combat SPACE listener before registering result keys
    if (this.spaceHandler) {
      this.input.keyboard!.off('keydown-SPACE', this.spaceHandler);
      this.spaceHandler = null;
    }

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

    // If the mission data did not explicitly define a colour for the enemy unit,
    // force it to red so the enemy is always visually distinguishable from the player.
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

    // UI texts (hidden until battle start)
    this.missionNameText = this.add.text(400, 20, this.mission.name, { fontSize: '20px', color: '#cccccc' }).setOrigin(0.5);
    this.turnText = this.add.text(400, 60, '', { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
    this.statusText = this.add.text(400, 100, '', { fontSize: '18px', color: '#cccccc' }).setOrigin(0.5);
  }

  private startBattle(): void {
    // Enable input for firing
    this.spaceHandler = () => {
      if (this.isPlayerTurn && !this.isAnimating && this.player.isAlive()) {
        this.playerAttack();
      }
    };
    this.input.keyboard!.on('keydown-SPACE', this.spaceHandler);
    this.turnText.setText('Player Turn – press SPACE to fire');
  }

  // ---- AI helpers ------------------------------------------------------------

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

  // ---- Turn logic ------------------------------------------------------------

  private playerAttack() {
    this.isAnimating = true;

    // Reset damage text for the new turn
    if (this.damageTween) {
      this.damageTween.stop();
      this.damageTween = null;
    }
    this.statusText.setAlpha(0);
    this.statusText.setText('');

    // Immediately indicate AI's upcoming turn
    this.turnText.setText('AI Turn – thinking…');
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

    // Reset damage text for the new turn
    if (this.damageTween) {
      this.damageTween.stop();
      this.damageTween = null;
    }
    this.statusText.setAlpha(0);
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

    // Parabolic arc
    const startX = projectile.x;
    const startY = projectile.y;
    const endX = destX;
    const endY = destY;
    const horizontalDist = Math.abs(endX - startX);
    const parabolaHeight = Math.max(120, horizontalDist * 0.6);
    const tweenData = { progress: 0 };

    this.tweens.add({
      targets: tweenData,
      progress: 1,
      duration: 800,
      ease: 'Power2',
      onUpdate: () => {
        const t = tweenData.progress;
        const x = startX + (endX - startX) * t;
        const y = startY + (endY - startY) * t - parabolaHeight * 4 * t * (1 - t);
        projectile.setPosition(x, y);
      },
      onComplete: () => {
        projectile.destroy();
        to.takeDamage(damage);

        // Set and fade damage text
        this.statusText.setText(`${from.name} dealt ${damage} damage`);
        this.statusText.setAlpha(1);

        // Stop any previous damage fade and start new one
        if (this.damageTween) {
          this.damageTween.stop();
          this.damageTween = null;
        }
        this.damageTween = this.tweens.add({
          targets: this.statusText,
          alpha: 0,
          delay: 1000,
          duration: 600,
          onComplete: () => {
            this.damageTween = null;
          },
        });

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

        // If the target died, play a death animation before calling onComplete
        const targetDead = !to.isAlive();
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
