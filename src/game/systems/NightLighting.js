import Phaser from 'phaser';
import { COLORS } from '../config/theme.js';

/**
 * Reusable night lightmap (same technique as the Prologue forest):
 * a render texture filled with the ambient colour, lights stamped in
 * additively, then multiplied over the world.
 *
 *   const light = new NightLighting(scene, layer, W, H);
 *   const l = light.add({ x, y, radius: 60, color: 0xffcf7a, intensity: 1 });
 *   l.x = …; l.intensity = …;      // animate freely
 *   light.addBeam({ x, y, len, w, angle, alpha });
 */
export class NightLighting {
  constructor(scene, layer, w, h, { ambient = COLORS.forestAmbient, depth = 5000 } = {}) {
    this.scene = scene;
    this.ambient = Phaser.Display.Color.IntegerToColor(ambient);
    this.ambientBoost = 0; // 0..1 brightens toward white
    this.lights = [];
    this.beams = [];
    this.rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0).setDepth(depth);
    this.rt.setBlendMode(Phaser.BlendModes.MULTIPLY);
    layer?.add(this.rt);
    this._onUpdate = () => this.draw();
    scene.events.on('update', this._onUpdate);
    scene.events.once('shutdown', () => scene.events.off('update', this._onUpdate));
  }

  add(opts) {
    const l = { x: 0, y: 0, radius: 40, color: 0xffffff, intensity: 1, flicker: 0, phase: Math.random() * 6, ...opts };
    this.lights.push(l);
    return l;
  }

  remove(l) {
    this.lights = this.lights.filter((x) => x !== l);
  }

  addBeam(opts) {
    const b = { x: 0, y: 0, len: 200, w: 40, angle: 16, alpha: 0.3, color: COLORS.moonlight, ...opts };
    this.beams.push(b);
    return b;
  }

  /**
   * Blend toward a daytime ambient: `light.day = 0xfff1dc; light.dayMix = 0..1`
   * (tween dayMix for a smooth night → morning change).
   */
  ambientColor() {
    const a = this.ambient;
    const d = Phaser.Display.Color.IntegerToColor(this.day ?? 0xffffff);
    const m = this.dayMix || 0;
    const k = this.ambientBoost;
    const ch = (night, day) => {
      const v = night + (day - night) * m;
      return Math.round(v + (255 - v) * k * 0.55);
    };
    return Phaser.Display.Color.GetColor(ch(a.red, d.red), ch(a.green, d.green), ch(a.blue, d.blue));
  }

  draw() {
    const rt = this.rt;
    if (!rt.active) return;
    const ADD = Phaser.BlendModes.ADD;
    const t = this.scene.time.now / 1000;
    rt.clear();
    rt.fill(this.ambientColor(), 1);
    this.beams.forEach((b) => {
      rt.stamp('beam', null, b.x, b.y, {
        originX: 0.5, originY: 0, scaleX: b.w / 32, scaleY: b.len / 128,
        angle: b.angle, tint: b.color, alpha: b.alpha, blendMode: ADD,
      });
    });
    this.lights.forEach((l) => {
      if (l.intensity <= 0.01) return;
      const f = l.flicker ? 1 - l.flicker * 0.5 + l.flicker * 0.5 * Math.sin(t * 1.7 + l.phase) : 1;
      rt.stamp('light', null, l.x, l.y, {
        scale: (l.radius * 2) / 128, tint: l.color, alpha: Math.min(1, l.intensity * f), blendMode: ADD,
      });
    });
  }
}
