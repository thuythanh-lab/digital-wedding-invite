import Phaser from 'phaser';
import { SHEET, ANIM, frameName } from './characterConfig.js';
import { registerCharacterAnimations, animKey } from './characterAnimations.js';

const OPPOSITE = { down: 'up', up: 'down', left: 'right', right: 'left' };
// Reversing direction passes through a side/front pose so it reads as a turn.
const VIA = { down: 'right', up: 'left', left: 'down', right: 'down' };

/**
 * A story character (shared by Minh and Thủy): sprite + soft ground shadow,
 * four-direction walking, breathing idle with random blinks, turning,
 * look-around, nod, an expressive action and a special interaction pose.
 * Movement returns promises so cutscenes can be scripted:
 *
 *   await minh.moveTo(90, 200);
 *   await minh.lookAt(thuy);
 *   await thuy.playAction('nod');
 *
 * `x, y` is the point between the feet, in the host scene's world units.
 */
export class Character {
  constructor(scene, def, opts = {}) {
    const {
      x = 0, y = 0, scale = 1, facing = 'down', variant = def.variants[0],
      layer = null, depthBase = 0, sortByY = true, shadow = true,
    } = opts;
    this.scene = scene;
    this.def = def;
    this.id = def.id;
    this.scale = scale;
    this.depthBase = depthBase;
    this.sortByY = sortByY;
    this.facing = facing;
    this.variant = variant;
    this.action = 'idle';
    this.moveTween = null;
    this.blinkAt = 0;
    this.blinkUntil = 0;
    this.x = x;
    this.y = y;

    registerCharacterAnimations(scene, def);
    this.shadow = shadow
      ? scene.add.image(x, y, 'groundShadow').setDisplaySize(15 * scale, 5 * scale).setAlpha(0.75)
      : null;
    this.sprite = scene.add.sprite(x, y, def.atlas, frameName(facing, 'stand', variant))
      .setOrigin(SHEET.originX, SHEET.originY).setScale(scale);
    if (layer) layer.add(this.shadow ? [this.shadow, this.sprite] : [this.sprite]);

    this.scheduleBlink(scene.time.now);
    this.idle(facing);

    this._onUpdate = (time) => this.update(time);
    scene.events.on('update', this._onUpdate);
    scene.events.once('shutdown', () => this.destroy());
    this.sync();
  }

  // ------------------------------------------------------------ appearance
  /** Switch frame variant (e.g. Thủy holding her bouquet: '-bq'). */
  setVariant(variant) {
    if (!this.def.variants.includes(variant)) return this;
    this.variant = variant;
    this.refresh();
    return this;
  }

  setTint(color) {
    this.sprite.setTint(color);
    return this;
  }

  setVisible(v) {
    this.sprite.setVisible(v);
    this.shadow?.setVisible(v);
    return this;
  }

  key(action, dir = this.facing) {
    return animKey(this.def, this.variant, action, dir);
  }

  // ------------------------------------------------------------ states
  refresh() {
    if (this.action === 'walk') this.sprite.play(this.key('walk'), true);
    else if (this.action === 'idle') this.sprite.play(this.key('idle'), true);
    else if (this.action === 'pose') this.sprite.setFrame(frameName(this.facing, this.poseName, this.variant));
  }

  /** Breathing idle facing `dir`. */
  idle(dir = this.facing) {
    this.facing = dir;
    this.action = 'idle';
    this.sprite.anims.timeScale = 1;
    this.sprite.play(this.key('idle'), true);
    return this;
  }

  face(dir) {
    this.facing = dir;
    this.refresh();
    return this;
  }

  /** Turn with a brief in-between pose when reversing direction. */
  turnTo(dir) {
    if (dir === this.facing) return Promise.resolve();
    const via = OPPOSITE[this.facing] === dir ? VIA[this.facing] : null;
    return new Promise((resolve) => {
      if (!via) {
        this.face(dir);
        resolve();
        return;
      }
      this.face(via);
      this.scene.time.delayedCall(90, () => { this.face(dir); resolve(); });
    });
  }

  /** Face toward another character or a point. */
  lookAt(target) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    return this.turnTo(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
  }

  /** Walking animation without moving (preview, or treadmill shots). */
  walkInPlace(dir = this.facing, speedFactor = 1) {
    this.facing = dir;
    this.action = 'walk';
    this.sprite.play(this.key('walk'), true);
    this.sprite.anims.timeScale = speedFactor;
    return this;
  }

  /**
   * One-shot actions: 'look' (look around), 'nod', 'expressive'
   * (Minh waves · Thủy twirls her gown). Resolves when done, then idles.
   */
  playAction(name) {
    this.stopMoving();
    const ex = this.def.actions.expressive;
    const key = name === 'expressive' && ex?.fixed ? animKey(this.def, this.variant, 'expressive') : this.key(name);
    if (!this.scene.anims.exists(key)) return Promise.resolve();
    this.action = 'action';
    this.sprite.anims.timeScale = 1;
    return new Promise((resolve) => {
      this.sprite.play(key);
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.idle(this.facing);
        resolve();
      });
    });
  }

  /** Special interaction pose (Minh offers his hand · Thủy raises the bouquet). */
  special(dir = this.facing) {
    return this.pose(this.def.actions.special.hold, dir);
  }

  /** Hold any single named pose from the atlas. */
  pose(name, dir = this.facing) {
    this.stopMoving();
    this.facing = dir;
    this.action = 'pose';
    this.poseName = name;
    this.sprite.stop();
    this.sprite.setFrame(frameName(dir, name, this.variant));
    return this;
  }

  // ------------------------------------------------------------ movement
  stopMoving() {
    if (this.moveTween) {
      this.moveTween.stop();
      this.moveTween = null;
    }
  }

  /** Walk straight to (x, y); resolves on arrival. */
  moveTo(x, y, { speed = ANIM.walkSpeed, faceOnArrival = null, axisBias = 1 } = {}) {
    this.stopMoving();
    const dx = x - this.x;
    const dy = y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) {
      this.idle(faceOnArrival || this.facing);
      return Promise.resolve();
    }
    // axisBias > 1 prefers vertical facing on diagonal legs (winding paths).
    const dir = Math.abs(dx) > Math.abs(dy) * axisBias ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    if (this.action !== 'walk' || this.facing !== dir) this.walkInPlace(dir, speed / ANIM.walkSpeed);
    return new Promise((resolve) => {
      this.moveTween = this.scene.tweens.add({
        targets: this,
        x,
        y,
        duration: (dist / speed) * 1000,
        ease: 'Linear',
        onComplete: () => {
          this.moveTween = null;
          if (!this._inPath) this.idle(faceOnArrival || dir);
          resolve();
        },
        onStop: () => resolve(),
      });
    });
  }

  /** Follow points in order; a newer path cancels an older one. */
  async walkPath(points, opts = {}) {
    this._pathId = (this._pathId || 0) + 1;
    const id = this._pathId;
    this._inPath = true;
    for (const p of points) {
      if (id !== this._pathId) return;
      // eslint-disable-next-line no-await-in-loop
      await this.moveTo(p.x, p.y, opts);
    }
    if (id === this._pathId) {
      this._inPath = false;
      this.idle(opts.faceOnArrival || this.facing);
    }
  }

  /** Cancel a walkPath in progress and stand still. */
  halt(dir = this.facing) {
    this._pathId = (this._pathId || 0) + 1;
    this._inPath = false;
    this.stopMoving();
    return this.idle(dir);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.sync();
    return this;
  }

  // ------------------------------------------------------------ frame
  scheduleBlink(now) {
    this.blinkAt = now + Phaser.Math.Between(ANIM.blinkEvery[0], ANIM.blinkEvery[1]);
  }

  sync() {
    this.sprite.setPosition(this.x, this.y);
    this.shadow?.setPosition(this.x, this.y - 0.5 * this.scale);
    const d = this.depthBase + (this.sortByY ? this.y : 0);
    this.sprite.setDepth(d + 0.5);
    this.shadow?.setDepth(this.sortByY ? this.depthBase - 50 : d);
  }

  update(time) {
    if (!this.sprite.active) return;
    // Random blinks while idling: pause the idle loop for a moment.
    if (this.action === 'idle') {
      if (this.blinkUntil && time >= this.blinkUntil) {
        this.blinkUntil = 0;
        this.sprite.anims.resume();
        this.sprite.setFrame(frameName(this.facing, 'stand', this.variant));
        this.scheduleBlink(time);
      } else if (!this.blinkUntil && time >= this.blinkAt) {
        this.blinkUntil = time + ANIM.blinkDuration;
        this.sprite.anims.pause();
        this.sprite.setFrame(frameName(this.facing, 'blink', this.variant));
      }
    } else if (this.blinkUntil) {
      this.blinkUntil = 0;
      this.scheduleBlink(time);
    }
    this.sync();
  }

  destroy() {
    this.scene.events.off('update', this._onUpdate);
    this.stopMoving();
    this.sprite.destroy();
    this.shadow?.destroy();
  }
}
