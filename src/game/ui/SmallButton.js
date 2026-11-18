import Phaser from 'phaser';
import { COLORS } from '../config/theme.js';
import { makeText } from '../utils/text.js';
import { drawPixelFrame } from './PixelFrame.js';

/** Compact pixel-framed touch button (≥ 44 CSS px tall). */
export class SmallButton extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, label, onPress) {
    super(scene, x, y);
    scene.add.existing(this);
    this.w = w;
    this.h = h;
    this.active_ = false;
    this.bg = scene.add.graphics();
    this.label = makeText(scene, 0, 0, label, { fontSize: '17px', align: 'center', color: COLORS.ink })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.draw();
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => this.setScale(0.95));
    this.on('pointerout', () => this.setScale(1));
    this.on('pointerup', () => {
      this.setScale(1);
      onPress?.(this);
    });
  }

  draw() {
    const { w, h } = this;
    this.bg.clear();
    drawPixelFrame(this.bg, -w / 2, -h / 2, w, h, {
      p: 2,
      layers: [
        { color: 0x03050d, alpha: 0.9 },
        { color: this.active_ ? COLORS.gold : 0x5a5070 },
        { color: this.active_ ? 0x2b2440 : 0x121830, alpha: 0.95 },
      ],
    });
    this.label.setColor(this.active_ ? COLORS.inkGold : COLORS.ink);
  }

  setActive(v) {
    this.active_ = v;
    this.draw();
    return this;
  }

  setLabel(t) {
    this.label.setText(t);
    return this;
  }
}
