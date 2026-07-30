import Phaser from 'phaser';

export class TerrainManager {
  private scene: Phaser.Scene;
  private heights: number[] = [];
  private graphics!: Phaser.GameObjects.Graphics;
  private width: number;
  private height: number;

  constructor(scene: Phaser.Scene, width: number = 800, height: number = 600) {
    this.scene = scene;
    this.width = width;
    this.height = height;
  }

  public init(): void {
    this.heights = new Array(this.width);
    for (let x = 0; x < this.width; x++) {
      let h = 450;
      if (x >= 200 && x < 400) {
        if (x <= 300) h = 450 - ((x - 200) / 100) * 70;
        else h = 450 - ((400 - x) / 100) * 70;
      }
      if (x >= 400 && x <= 600) {
        if (x <= 500) h = 450 - ((x - 400) / 100) * 70;
        else h = 450 - ((600 - x) / 100) * 70;
      }
      this.heights[x] = Math.max(0, Math.min(this.height, h));
    }
  }

  public build(): void {
    this.graphics = this.scene.add.graphics();
    this.redraw();
  }

  public redraw(): void {
    if (!this.graphics) return;
    this.graphics.clear();
    this.graphics.fillStyle(0x446644);
    for (let x = 0; x < this.width; x++) {
      const h = this.heights[x];
      this.graphics.fillRect(x, h, 1, this.height - h);
    }
  }

  public destroyTerrain(cx: number, cy: number, radius: number = 30): void {
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius));
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      if (Math.abs(dx) < radius) {
        const craterY = cy + Math.sqrt(radius * radius - dx * dx);
        if (craterY > this.heights[x]) {
          this.heights[x] = Math.min(this.height, craterY);
        }
      }
    }
    this.redraw();
  }

  public getGroundHeight(x: number): number {
    const clampedX = Math.max(0, Math.min(this.width - 1, Math.round(x)));
    return this.heights[clampedX];
  }

  public getHeights(): number[] {
    return this.heights;
  }
}
