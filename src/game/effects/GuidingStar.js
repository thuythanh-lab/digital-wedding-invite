import Phaser from 'phaser';
import { COLORS } from '../config/theme.js';

/**
 * The star that guides the player. Two modes:
 *  - 'meteor': falling, with a velocity-aligned tail and a sparkle trail
 *  - 'orb':    hovering guide light that bobs, glints and reacts to taps
 * `unit` is the size of one art pixel in the scene's coordinates.
 */
export class GuidingStar {
  constructor(scene, x, y, { unit = 1, depth = 60, glowScale = 0.5, coreKey = 'star-core', trail = true, layer = null } = {}) {
    this.scene = scene;
    this.layer = layer;
    this.unit = unit;
    this.x = x;
    this.y = y;
    this.mode = 'meteor';
    this.bob = { t: 0, ox: 0, oy: 0 };
    this.lastX = x;
    this.lastY = y;
    this.speed = 0;
    this.brightness = 1;

    const ADD = Phaser.BlendModes.ADD;
    this.halo = scene.add.image(x, y, 'glow').setTint(0xffc867).setBlendMode(ADD)
      .setScale(glowScale * 2.2).setAlpha(0.22).setDepth(depth - 2);
    this.glow = scene.add.image(x, y, 'glow').setTint(COLORS.goldSoft).setBlendMode(ADD)
      .setScale(glowScale).setAlpha(0.9).setDepth(depth - 1);
    this.streak = scene.add.image(x, y, 'streak').setOrigin(1, 0.5).setTint(COLORS.goldSoft)
      .setBlendMode(ADD).setAlpha(0).setDepth(depth - 1);
    this.core = scene.add.image(x, y, coreKey).setScale(unit).setDepth(depth);

    this.trail = null;
    if (trail) {
      this.trail = scene.add.particles(0, 0, 'dot3', {
        follow: this.core,
        lifespan: { min: 500, max: 1100 },
        speed: { min: 2 * unit, max: 10 * unit },
        scale: { start: unit, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xffe3a3, 0xffffff, 0xf5cf73],
        blendMode: ADD,
        frequency: 45,
        quantity: 1,
      }).setDepth(depth - 1);
    }
    this.parts = [this.halo, this.glow, this.streak, this.core];
    if (layer) layer.add(this.trail ? [...this.parts, this.trail] : this.parts);
  }

  setDepth(d) {
    this.halo.setDepth(d - 2);
    this.glow.setDepth(d - 1);
    this.streak.setDepth(d - 1);
    this.core.setDepth(d);
    this.trail?.setDepth(d - 1);
    return this;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  setTrailRate(ms) {
    if (!this.trail) return;
    if (ms <= 0) this.trail.stop();
    else {
      this.trail.frequency = ms;
      if (!this.trail.emitting) this.trail.start();
    }
  }

  /** Small sparkle burst (used on landing and on taps). */
  burst(count = 14, power = 1) {
    const u = this.unit;
    const e = this.scene.add.particles(this.x + this.bob.ox, this.y + this.bob.oy, 'sparkle', {
      lifespan: { min: 500, max: 1000 },
      speed: { min: 20 * u * power, max: 55 * u * power },
      scale: { start: u * 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe3a3, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(this.core.depth + 1);
    this.layer?.add(e);
    e.explode(count);
    this.scene.time.delayedCall(1200, () => e.destroy());
  }

  update(dt) {
    const s = dt / 1000;
    this.bob.t += s;
    let dx = 0;
    let dy = 0;
    if (this.mode === 'orb') {
      const t = this.bob.t;
      dy = Math.sin(t * 1.6) * 2.2 * this.unit;
      dx = Math.sin(t * 0.7) * 0.8 * this.unit;
    }
    this.bob.ox = dx;
    this.bob.oy = dy;
    const x = this.x + dx;
    const y = this.y + dy;

    // Velocity → tail.
    const vx = (x - this.lastX) / Math.max(s, 0.001);
    const vy = (y - this.lastY) / Math.max(s, 0.001);
    const sp = Math.hypot(vx, vy);
    this.speed = Phaser.Math.Linear(this.speed, sp, 0.25);
    this.lastX = x;
    this.lastY = y;

    this.core.setPosition(x, y);
    this.glow.setPosition(x, y);
    this.halo.setPosition(x, y);
    this.streak.setPosition(x, y);
    if (this.mode === 'meteor' && this.speed > 5) {
      this.streak.setRotation(Math.atan2(vy, vx));
      const len = Phaser.Math.Clamp(this.speed * 0.12, 0, 220);
      this.streak.setDisplaySize(len, 10 * this.unit).setAlpha(Phaser.Math.Clamp(this.speed / 400, 0, 0.85));
    } else {
      this.streak.setAlpha(Math.max(0, this.streak.alpha - s * 3));
    }

    // Gentle breathing of the glow.
    const breath = 1 + 0.06 * Math.sin(this.bob.t * 2.3);
    this.glow.setAlpha(Phaser.Math.Clamp(0.75 * this.brightness * breath, 0, 1));
    this.halo.setAlpha(Phaser.Math.Clamp(0.2 * this.brightness * breath, 0, 0.6));
  }

  destroy() {
    this.parts.forEach((p) => p.destroy());
    this.trail?.destroy();
  }
}
