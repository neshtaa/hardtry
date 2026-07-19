import Phaser from 'phaser';

interface WeaponDef {
  id: string;
  name: string;
  damage: number;
  range: number;
  projectileColor: string;
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

  constructor() {
    super({ key: 'GameScene' });
  }

  async create() {
    // Show a loading indicator while we fetch weapon definitions
    const loadText = this.add
      .text(400, 300, 'Loading weapons…', { fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5);

    this.weaponMap = await this.loadWeapons();

    // Clear the loading screen and build the game
    this.children.removeAll(true);
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
      console.warn('Could not reach backend – using fallback weapon definition', err);
      const map = new Map<string, WeaponDef>();
      map.set('basic_cannon', {
        id: 'basic_cannon',
        name: 'Basic Cannon',
        damage: 3,
        range: 200,
        projectileColor: '#ffcc00',
      });
      return map;
    }
  }

  private setupGame() {
    // Terrain
    this.createTerrain();

    // Create units using weapon definitions (fallback to basic_cannon)
    const wpnId = 'basic_cannon';
    const baseDef = this.weaponMap.get(wpnId) || { damage: 3, projectileColor: '#ffcc00' };

    this.player = new SimpleUnit(this, {
      x: 150,
      y: 400,
      hp: 10,
      weaponId: wpnId,
      color: 0x4488ff,
      name: 'Player',
    });

    this.ai = new SimpleUnit(this, {
      x: 650,
      y: 400,
      hp: 10,
      weaponId: wpnId,
      color: 0xff4444,
      name: 'AI',
    });

    // UI texts
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

  private createTerrain() {
    const terrain = this.add.graphics();
    terrain.fillStyle(0x446644);
    terrain.fillRect(0, 450, 800, 150);
    terrain.fillStyle(0x557755);
    terrain.fillTriangle(200, 450, 300, 380, 400, 450);
    terrain.fillTriangle(400, 450, 500, 380, 600, 450);
  }

  private getWeaponDamage(weaponId: string): number {
    const w = this.weaponMap.get(weaponId);
    return w ? w.damage : 3;
  }

  private getProjectileColor(weaponId: string): number {
    const w = this.weaponMap.get(weaponId);
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

  private aiTurn() {
    this.isPlayerTurn = false;
    this.turnText.setText('AI Turn');
    this.statusText.setText('');
    this.time.delayedCall(800, () => {
      const damage = this.getWeaponDamage(this.ai.weaponId);
      this.fireProjectile(this.ai, this.player, damage, () => {
        if (!this.player.isAlive() || !this.ai.isAlive()) {
          this.showGameOver(!this.player.isAlive() ? 'AI Wins!' : 'Player Wins!');
          return;
        }
        this.time.delayedCall(500, () => {
          this.isPlayerTurn = true;
          this.isAnimating = false;
          this.turnText.setText('Player Turn – press SPACE to fire');
        });
      });
    });
  }

  private fireProjectile(
    from: SimpleUnit,
    to: SimpleUnit,
    damage: number,
    onComplete: () => void,
  ) {
    const color = this.getProjectileColor(from.weaponId);
    const projectile = this.add.circle(from.body.x, from.body.y - 25, 6, color);

    this.tweens.add({
      targets: projectile,
      x: to.body.x,
      y: to.body.y - 25,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        projectile.destroy();
        to.takeDamage(damage);
        this.statusText.setText(`${from.name} dealt ${damage} damage`);
        onComplete();
      },
    });
  }

  private showGameOver(message: string) {
    this.isAnimating = true;
    this.isPlayerTurn = false;
    this.turnText.setText(message);
    this.statusText.setText('Press R to restart');
    this.input.keyboard!.on('keydown-R', () => {
      this.scene.restart();
    });
  }
}
