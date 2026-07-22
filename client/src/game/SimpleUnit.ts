import Phaser from 'phaser';
import { SimpleUnitConfig } from './types';

class SimpleUnit {
  scene: Phaser.Scene;
  body: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Graphics;
  hpText: Phaser.GameObjects.Text;
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

    this.hpText = scene.add.text(config.x, config.y - 43, `${this.hp}/${this.maxHp}`, {
      fontSize: '11px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.weaponNameText = scene.add.text(config.x, config.y - 55, config.weaponName, {
      fontSize: '12px',
      color: '#cccccc',
    }).setOrigin(0.5);

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
    this.hpText.setText(`${this.hp}/${this.maxHp}`);
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
    this.hpText.y = y - 43;
    this.drawHpBar();
  }

  setX(x: number) {
    this.body.x = x;
    this.weaponNameText.x = x;
    this.hpText.x = x;
    this.drawHpBar();
  }

  destroy() {
    this.body.destroy();
    this.hpBar.destroy();
    this.hpText.destroy();
    this.weaponNameText.destroy();
  }

  playDeathAnimation(callback: () => void) {
    // Hide UI elements
    this.hpBar.setVisible(false);
    this.hpText.setVisible(false);
    this.weaponNameText.setVisible(false);

    // Flash red/white 3 full cycles using yoyo tween
    const flashData = { value: 0 };

    this.scene.tweens.add({
      targets: flashData,
      value: 1,
      duration: 80,
      yoyo: true,
      repeat: 2, // gives 3 full cycles (each cycle = two legs)
      ease: 'Linear',
      onUpdate: () => {
        const color = flashData.value < 0.5 ? 0xff0000 : 0xffffff;
        this.body.setFillStyle(color);
      },
      onComplete: () => {
        // Fade out after flash
        this.scene.tweens.add({
          targets: this.body,
          alpha: 0,
          duration: 400,
          onComplete: () => {
            this.destroy();
            callback();
          },
        });
      },
    });
  }
}

export { SimpleUnit };
