import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'root',
  backgroundColor: '#87CEEB',
  scene: [GameScene],
};

new Phaser.Game(config);
