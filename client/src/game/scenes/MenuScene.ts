import Phaser from 'phaser';

interface MissionDef {
  id: string;
  name: string;
  units: {
    id: string;
    archetypeId?: string;
    hp?: number;
    weaponId?: string;
    x: number;
    y: number;
    color?: string;
    side: 'player' | 'enemy';
  }[];
}

export class MenuScene extends Phaser.Scene {
  private missions: MissionDef[] = [];
  private chosenIndex: number = -1;

  constructor() {
    super({ key: 'MenuScene' });
  }

  async create() {
    this.add
      .text(400, 40, 'SELECT MISSION', {
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(400, 80, 'Loading…', {
        fontSize: '16px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    try {
      this.missions = await this.loadMissions();
    } catch {
      console.warn('Using fallback mission list');
      this.missions = [
        {
          id: 'fallback_demo',
          name: 'Training Ground',
          units: [
            { id: 'player', archetypeId: 'soldier', weaponId: 'basic_cannon', x: 150, y: 400, side: 'player' },
            { id: 'ai', archetypeId: 'heavy', weaponId: 'cluster_bomb', x: 650, y: 400, side: 'enemy' },
          ],
        },
        {
          id: 'second_fallback',
          name: 'Second Battle',
          units: [
            { id: 'player', archetypeId: 'scout', weaponId: 'sniper_cannon', x: 150, y: 400, side: 'player' },
            { id: 'ai', archetypeId: 'soldier', weaponId: 'basic_cannon', x: 650, y: 400, side: 'enemy' },
          ],
        },
      ];
    }

    hint.destroy();

    // Hint for interaction
    this.add
      .text(400, 100, 'Press 1–N or click a mission', {
        fontSize: '14px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    this.missions.forEach((m, i) => {
      const y = 150 + i * 60;
      const text = this.add
        .text(400, y, `${i + 1}. ${m.name}`, {
          fontSize: '22px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          text.setColor('#ffaa00');
        })
        .on('pointerout', () => {
          text.setColor('#ffffff');
        })
        .on('pointerdown', () => {
          this.chosenIndex = i;
          this.startMission();
        });
    });

    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      const keyNum = parseInt(event.key, 10);
      if (keyNum >= 1 && keyNum <= this.missions.length) {
        this.chosenIndex = keyNum - 1;
        this.startMission();
      }
    });
  }

  private async loadMissions(): Promise<MissionDef[]> {
    const backendUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const url = `${backendUrl}/missions`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch missions: ${res.statusText}`);
    return await res.json();
  }

  private startMission() {
    this.scene.start('GameScene', { missionIndex: this.chosenIndex });
  }
}
