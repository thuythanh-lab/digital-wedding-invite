import Phaser from 'phaser';
import { COLORS } from '../config/theme.js';
import { makeText } from '../utils/text.js';
import { drawPixelFrame } from './PixelFrame.js';

/**
 * A framed pixel-art button with a slow light sweep and drifting chevrons.
 * The hit area is padded so it is always ≥ 44 CSS px tall.
 */
export class PixelButton extends Phaser.GameObjects.Container {
  constructor(scene, x, y, label, { width = 196, height = 52, onPress } = {}) {
    super(scene, x, y);
    scene.add.existing(this);
    this.w = width;
    this.h = height;
    this.onPress = onPress;
    this.enabled = true;

    const p = 2;
    const back = scene.add.graphics();
    drawPixelFrame(back, -width / 2, -height / 2, width, height, {
      p,
      layers: [
        { color: 0x03050d, alpha: 0.9 },
        { color: COLORS.frameGold },
        { color: 0x2a2140 },
        { color: 0x0e1430, alpha: 0.92 },
      ],
    });
    // Faint inner top highlight.
    back.fillStyle(0xffffff, 0.06);
    back.fillRect(-width / 2 + p * 4, -height / 2 + p * 3, width - p * 8, p);
    this.add(back);

    // Light sweep: a soft glint that glides across the inside of the frame.
    this.sweep = scene.add.image(0, 0, 'glow').setDisplaySize(40, height - 14)
      .setTint(COLORS.goldSoft).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.sweep);

    this.label = makeText(scene, 0, 0, label, {
      fontSize: '28px',
      color: COLORS.ink,
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.label.setShadow(0, 2, COLORS.shadow, 0, true, true);
    this.add(this.label);

    // Pixel chevrons that breathe outward.
    const chev = (dir) => {
      const g = scene.add.graphics();
      g.fillStyle(COLORS.gold, 1);
      [1, 2, 3, 2, 1].forEach((len, row) => {
        const x0 = dir > 0 ? 0 : -len * 2;
        g.fillRect(x0, (row - 2.5) * 2, len * 2, 2);
      });
      return g;
    };
    this.chevL = chev(1).setPosition(-width / 2 + 18, 0);
    this.chevR = chev(-1).setPosition(width / 2 - 18, 0);
    this.add([this.chevL, this.chevR]);

    scene.tweens.add({
      targets: this.chevL, x: '+=4', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: this.chevR, x: '-=4', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.sweepTween = scene.tweens.chain({
      targets: this.sweep,
      loop: -1,
      loopDelay: 2400,
      tweens: [
        { x: { from: -width / 2 + 26, to: 0 }, alpha: { from: 0, to: 0.32 }, duration: 800, ease: 'Sine.easeIn', delay: 400 },
        { x: width / 2 - 26, alpha: 0, duration: 800, ease: 'Sine.easeOut' },
      ],
    });

    // Generous hit area.
    const hitH = Math.max(height + 16, 60);
    this.setSize(width + 24, hitH);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.setScale(0.96);
    });
    this.on('pointerout', () => this.setScale(1));
    this.on('pointerup', () => {
      if (!this.enabled) return;
      this.setScale(1);
      this.enabled = false;
      this.onPress?.();
    });

  }

  get texts() {
    return [this.label];
  }
}
