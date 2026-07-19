import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Temporary placeholder – will be replaced with gameplay
    this.add.text(400, 300, 'Game scene ready', {
      fontSize: '32px',
      color: '#ffffff',
    });
  }
}
