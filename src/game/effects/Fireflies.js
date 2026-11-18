import Phaser from 'phaser';
import { COLORS } from '../config/theme.js';

/**
 * Slow, wandering fireflies. Each one is a tiny pixel core plus a soft
 * additive glow. Motion is a sum of slow sines (smooth, no per-frame random).
 */
export class Fireflies {
  /**
   * @param {Phaser.Scene} scene
   * @param {{x:number,y:number,w:number,h:number}} bounds
   * @param {object} opts
   */
  constructor(scene, bounds, opts = {}) {
    const {
      count = 12, depth = 50, glowScale = 0.11, coreScale = 1, scrollFactor = 1,
      color = COLORS.firefly, container = null, onLight = null,
    } = opts;
    this.scene = scene;
    this.bounds = bounds;
    this.flies = [];
    this.time = 0;
    this.onLight = onLight;

    for (let i = 0; i < count; i++) {
      const glow = scene.add.image(0, 0, 'glow').setTint(color).setScale(glowScale)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(depth).setScrollFactor(scrollFactor);
      const core = scene.add.image(0, 0, 'px').setTint(0xfff3c4).setScale(coreScale * 0.5)
        .setDepth(depth + 1).setScrollFactor(scrollFactor);
      if (container) container.add([glow, core]);
      this.flies.push({
        glow, core,
        ax: Phaser.Math.FloatBetween(0, 1), ay: Phaser.Math.FloatBetween(0, 1),
        fx: Phaser.Math.FloatBetween(0.05, 0.12), fy: Phaser.Math.FloatBetween(0.06, 0.14),
        px: Phaser.Math.FloatBetween(0, 6.28), py: Phaser.Math.FloatBetween(0, 6.28),
        wob: Phaser.Math.FloatBetween(0.8, 1.6),
        blink: Phaser.Math.FloatBetween(0.4, 1.1), bp: Phaser.Math.FloatBetween(0, 6.28),
        glowScale,
        alpha: 1,
      });
    }
    this.update(0);
  }

  setAlpha(a) {
    this.flies.forEach((f) => { f.alpha = a; });
  }

  fadeOut(duration = 600) {
    this.flies.forEach((f) => this.scene.tweens.add({ targets: f, alpha: 0, duration }));
  }

  update(dt) {
    this.time += dt / 1000;
    const t = this.time;
    const { x, y, w, h } = this.bounds;
    for (const f of this.flies) {
      const nx = 0.5 + 0.42 * Math.sin(t * f.fx * 6.28 * 0.25 + f.px) + 0.08 * Math.sin(t * f.wob + f.py);
      const ny = 0.5 + 0.42 * Math.sin(t * f.fy * 6.28 * 0.2 + f.py) + 0.08 * Math.cos(t * f.wob * 1.3 + f.px);
      const px = x + Phaser.Math.Clamp(nx + (f.ax - 0.5) * 0.3, 0, 1) * w;
      const py = y + Phaser.Math.Clamp(ny + (f.ay - 0.5) * 0.3, 0, 1) * h;
      // Blink: mostly on, occasionally dims to almost nothing.
      const b = Math.max(0, Math.sin(t * f.blink + f.bp));
      const glowA = (0.25 + 0.75 * Math.pow(b, 0.6)) * f.alpha;
      f.glow.setPosition(px, py).setAlpha(glowA * 0.75).setScale(f.glowScale * (0.85 + 0.3 * b));
      f.core.setPosition(px, py).setAlpha(Math.min(1, glowA * 1.2));
      if (this.onLight) this.onLight(px, py, glowA);
    }
  }
}
