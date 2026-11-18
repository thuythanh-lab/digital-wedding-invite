import Phaser from 'phaser';
import { COLORS } from '../config/theme.js';

/**
 * A tappable story hotspot (star, tree hollow…).
 *  - generous invisible hit area (≥ 44 CSS px at any phone size)
 *  - soft pulsing rings that say "touch me"
 *  - fires once: `await hotspot.wait()`; extra taps are ignored
 * Coordinates are world units of the scene's main camera.
 */
export class Hotspot {
  constructor(scene, x, y, { radius = 16, layer = null, depth = 5200, ringScale = 1, color = COLORS.goldSoft } = {}) {
    this.scene = scene;
    this.enabled = false;
    this.done = false;
    this.zone = scene.add.zone(x, y, radius * 2, radius * 2).setInteractive({ useHandCursor: true });
    this.rings = [0, 1].map(() => scene.add.image(x, y, 'ring').setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(depth));
    if (layer) layer.add([this.zone, ...this.rings]);
    this.ringScale = ringScale;
    this.resolve = null;
    this.zone.on('pointerdown', (p, lx, ly, ev) => {
      if (!this.enabled || this.done) return;
      ev?.stopPropagation?.();
      this.done = true;
      this.disable();
      this.resolve?.();
    });
    this.pulseTimer = null;
  }

  setPosition(x, y) {
    this.zone.setPosition(x, y);
    this.rings.forEach((r) => r.setPosition(x, y));
    return this;
  }

  /** Start inviting a tap; resolves on the first tap. */
  wait() {
    this.enabled = true;
    this.done = false;
    this.pulse();
    return new Promise((r) => { this.resolve = r; });
  }

  pulse() {
    const s = this.ringScale;
    this.rings.forEach((ring, i) => {
      this.scene.tweens.add({
        targets: ring,
        scale: { from: 0.35 * s, to: 1.5 * s },
        alpha: { from: 0.75, to: 0 },
        duration: 1500,
        delay: i * 750,
        repeat: -1,
        ease: 'Sine.easeOut',
      });
    });
  }

  disable() {
    this.enabled = false;
    this.rings.forEach((r) => {
      this.scene.tweens.killTweensOf(r);
      this.scene.tweens.add({ targets: r, alpha: 0, duration: 200 });
    });
  }

  destroy() {
    this.disable();
    this.zone.destroy();
    this.rings.forEach((r) => r.destroy());
  }
}
