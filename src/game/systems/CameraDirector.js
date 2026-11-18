import Phaser from 'phaser';

/**
 * Smooth, sickness-free camera moves for portrait scenes. Works in world
 * units with a top-left camera origin (see utils/viewport.fitCamera).
 *
 *   cam.lookAt(x, y)                 instant
 *   await cam.panTo(x, y, 2500)      eased pan, clamped to the world
 *   cam.follow(obj, { lerp })        soft follow (call stop() to end)
 */
export class CameraDirector {
  constructor(scene, camera, world) {
    this.scene = scene;
    this.cam = camera;
    this.world = world; // { w, h }
    this.target = null;
    this.focus = { x: world.w / 2, y: world.h / 2 };
    this.anchorY = 0.45; // where the focus sits vertically on screen (0..1)
    this.tween = null;
    this._onUpdate = (t, dt) => this.update(dt);
    scene.events.on('update', this._onUpdate);
    scene.events.once('shutdown', () => this.destroy());
  }

  get viewW() {
    return this.cam.width / this.cam.zoom;
  }

  get viewH() {
    return this.cam.height / this.cam.zoom;
  }

  scrollFor(x, y) {
    const sx = Phaser.Math.Clamp(x - this.viewW / 2, 0, Math.max(0, this.world.w - this.viewW));
    const sy = Phaser.Math.Clamp(y - this.viewH * this.anchorY, 0, Math.max(0, this.world.h - this.viewH));
    return { sx, sy };
  }

  apply() {
    const { sx, sy } = this.scrollFor(this.focus.x, this.focus.y);
    this.cam.scrollX = sx;
    this.cam.scrollY = sy;
  }

  lookAt(x, y) {
    this.stop();
    this.focus.x = x;
    this.focus.y = y;
    this.apply();
  }

  panTo(x, y, duration = 2000, ease = 'Sine.easeInOut') {
    this.stop();
    return new Promise((resolve) => {
      this.tween = this.scene.tweens.add({
        targets: this.focus, x, y, duration, ease,
        onUpdate: () => this.apply(),
        onComplete: () => { this.tween = null; resolve(); },
        onStop: () => resolve(),
      });
    });
  }

  follow(obj, { lerp = 0.06, offsetX = 0, offsetY = 0 } = {}) {
    this.stop();
    this.target = { obj, lerp, offsetX, offsetY };
  }

  stop() {
    this.target = null;
    if (this.tween) {
      this.tween.stop();
      this.tween = null;
    }
  }

  /** Re-apply after a viewport change. */
  refresh() {
    this.apply();
  }

  update(dt) {
    if (!this.target) return;
    const { obj, lerp, offsetX, offsetY } = this.target;
    const k = 1 - Math.pow(1 - lerp, dt / 16.67);
    this.focus.x += (obj.x + offsetX - this.focus.x) * k;
    this.focus.y += (obj.y + offsetY - this.focus.y) * k;
    this.apply();
  }

  destroy() {
    this.stop();
    this.scene.events.off('update', this._onUpdate);
  }
}
