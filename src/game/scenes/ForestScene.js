import Phaser from 'phaser';
import { COLORS, FONT_TITLE } from '../config/theme.js';
import { STRINGS } from '../config/strings.vi.js';
import { GuidingStar } from '../effects/GuidingStar.js';
import { Fireflies } from '../effects/Fireflies.js';
import { createForestGround, pathAt } from '../effects/ForestGround.js';
import { DialogueBox } from '../ui/DialogueBox.js';
import { soundManager } from '../audio/SoundManager.js';
import { AUDIO_KEYS } from '../audio/audioKeys.js';
import { viewport, fitCamera } from '../utils/viewport.js';
import { makeText, refreshTextResolution } from '../utils/text.js';
import { makeRng } from '../utils/rng.js';

// World is in art pixels; the world camera draws it at 2× logical scale.
const ART = 2;
const WW = 180;
const WH = 480;
export const FOCUS = { x: 90, y: 205 }; // where the star comes to rest

export const D = {
  ground: 0,
  shadow: 1,
  decor: 2,
  sorted: 100, // + y for y-sorting
  leaves: 3000,
  light: 5000,
  emissive: 5100,
  canopy: 6500,
};

/**
 * SCENE 2 — The enchanted forest (Prologue).
 * Top-down night forest built from Fantasy Lands sprites, lit by a multiply
 * lightmap: cool moonlight everywhere, warm light around the guiding star,
 * faint glows on mushrooms and fireflies.
 */
export class ForestScene extends Phaser.Scene {
  // The key is overridable so dev-only demos can extend this scene.
  constructor(key = 'Forest') {
    super(key);
  }

  init(data) {
    this.fromFall = !!data?.fromFall;
  }

  create() {
    this.rng = makeRng(1224);
    this.world = this.add.layer();
    this.ui = this.add.layer();
    this.mushroomLights = [];
    this.swayers = [];
    this.starTapped = false;
    this.ready = false;

    // Cameras: world (2× zoom) and UI (1×, logical units).
    this.uiCam = this.cameras.add(0, 0, 1, 1, false, 'ui');
    this.cameras.main.ignore(this.ui);
    this.uiCam.ignore(this.world);
    this.cameras.main.setBackgroundColor('#0b1410');

    this.buildGround();
    this.buildFlora();
    this.buildLighting();
    this.buildStar();
    this.buildUI();
    this.applyLayout(viewport.layout);
    this.buildCanopyCover();

    this.input.on('pointerdown', (pointer, over) => this.onTap(pointer, over));
    this.onLayout = (l) => this.applyLayout(l);
    viewport.on('change', this.onLayout);
    this.events.once('shutdown', () => {
      viewport.off('change', this.onLayout);
      soundManager.stopAmbience();
    });

    soundManager.startAmbience(0.9);
    // In case the player arrived here without the title (debug), keep music going.
    soundManager.preloadMusic(this, AUDIO_KEYS.music.forest);
    soundManager.playMusic(AUDIO_KEYS.music.forest.key, { volume: 0.5, fadeIn: 3000 });

    this.playEntrance();
  }

  // ---------------------------------------------------------------- building
  add2(obj) {
    this.world.add(obj);
    return obj;
  }

  buildGround() {
    createForestGround(this, 'forest-ground', WW, WH, FOCUS.y);
    this.add2(this.add.image(0, 0, 'forest-ground').setOrigin(0).setDepth(D.ground));
  }

  /** Is (x, y) clear of the path by at least `margin` art px? */
  offPath(x, y, margin) {
    const { cx, hw } = pathAt(y, FOCUS.y);
    return Math.abs(x - cx) > hw + margin;
  }

  sortedSprite(tex, frame, x, y, { originY = 1, flip = false, shadow = 0 } = {}) {
    if (shadow) {
      this.add2(this.add.image(x, y - 1, 'groundShadow').setDisplaySize(shadow, shadow * 0.45)
        .setAlpha(0.8).setDepth(D.shadow));
    }
    const s = this.add.image(Math.round(x), Math.round(y), tex, frame).setOrigin(0.5, originY)
      .setDepth(D.sorted + y).setFlipX(flip);
    return this.add2(s);
  }

  buildFlora() {
    const r = this.rng;
    const placed = [];
    const clear = (x, y, d) => placed.every((p) => (p.x - x) ** 2 + ((p.y - y) * 1.3) ** 2 > d * d);

    // Trees: dense walls along both sides, a few strays further in.
    const greens = ['green0', 'green1', 'green2', 'green3', 'green4', 'green5', 'green6', 'green7'];
    let attempts = 0;
    while (placed.length < 70 && attempts < 2500) {
      attempts++;
      const edge = r.chance(0.75);
      const x = edge ? (r.chance(0.5) ? r.range(-8, 42) : r.range(138, 188)) : r.range(-8, 188);
      const y = r.range(10, WH + 26);
      if (!this.offPath(x, y, 15)) continue;
      if (!clear(x, y, 17)) continue;
      // Keep a clearing around the star's resting place.
      if (Math.hypot(x - FOCUS.x, (y - FOCUS.y) * 1.2) < 52) continue;
      placed.push({ x, y });
      const roll = r.next();
      let tex = 'bigTrees';
      let frame = r.pick(greens);
      if (roll < 0.14) frame = 'pine';
      else if (roll < 0.2) frame = r.pick(['autumn1', 'autumn3', 'autumn6']);
      else if (roll < 0.32) { tex = 'smallTrees'; frame = r.pick(['green0', 'green2', 'green5', 'pine']); }
      this.sortedSprite(tex, frame, x, y, { flip: r.chance(0.5), shadow: tex === 'bigTrees' ? 22 : 16 });
    }

    // Undergrowth.
    const scatter = (n, tex, frames, margin, opts = {}) => {
      let k = 0;
      let tries = 0;
      while (k < n && tries < n * 60) {
        tries++;
        const x = r.range(4, WW - 4);
        const y = r.range(8, WH - 4);
        if (opts.nearPath) {
          const { cx, hw } = pathAt(y, FOCUS.y);
          const d = Math.abs(x - cx) - hw;
          if (d < margin || d > margin + 14) continue;
        } else if (!this.offPath(x, y, margin)) continue;
        if (!clear(x, y, opts.space ?? 8)) continue;
        if (opts.avoidFocus && Math.hypot(x - FOCUS.x, y - FOCUS.y) < opts.avoidFocus) continue;
        placed.push({ x, y });
        const s = this.sortedSprite(tex, r.pick(frames), x, y, { flip: r.chance(0.5) });
        opts.after?.(s, x, y);
        k++;
      }
    };

    scatter(10, 'bushes', ['big', 'small', 'wide', 'big', 'wide', 'smallAutumn'], 3, { space: 12 });
    scatter(4, 'bushesBerries', ['big', 'wide', 'small'], 4, { space: 12 });
    scatter(7, 'rocks', ['pebbles', 'mid', 'big', 'pebblesB', 'midB', 'tall'], 1, { space: 9, nearPath: true });
    scatter(6, 'mushrooms', ['few', 'cluster', 'one', 'cluster'], 4, {
      space: 10,
      after: (s, x, y) => this.mushroomLights.push({ x, y: y - 4, phase: r.range(0, 6), r: r.range(9, 13) }),
    });
    scatter(9, 'redFlowers', ['single', 'pair', 'bunch', 'pair'], 0, {
      space: 7, nearPath: true, avoidFocus: 16,
      after: (s) => this.swayers.push({ o: s, x: s.x, amp: 0.5, sp: r.range(0.8, 1.3), ph: r.range(0, 6) }),
    });
    scatter(3, 'logs', ['short', 'long', 'shortV'], 6, { space: 16 });
    scatter(4, 'stumps', ['a', 'b', 'c', 'd'], 4, { space: 10 });
    scatter(6, 'sticks', ['a', 'b', 'c'], -2, { space: 5 });

    // Grass tufts everywhere (flat decor, not y-sorted), gently swaying.
    for (let i = 0; i < 70; i++) {
      const x = r.range(0, WW);
      const y = r.range(0, WH);
      if (!this.offPath(x, y, -1)) continue;
      const g = this.add2(this.add.image(Math.round(x), Math.round(y), 'grass',
        r.pick(['tuft', 'tuftB', 'low', 'lowB', 'sprigs', 'sprigsB', 'scatter', 'scatterB']))
        .setOrigin(0.5, 1).setDepth(D.decor).setFlipX(r.chance(0.5)));
      if (r.chance(0.5)) this.swayers.push({ o: g, x: g.x, amp: 0.45, sp: r.range(0.7, 1.2), ph: r.range(0, 6) });
    }

    // Leaves drifting down through the moonlight.
    this.leafEmitter = this.add2(this.add.particles(0, 0, 'leaf', {
      x: { min: 0, max: WW },
      y: -6,
      lifespan: 9000,
      speedY: { min: 10, max: 18 },
      speedX: { min: -6, max: 6 },
      rotate: { start: 0, end: 360 },
      alpha: { start: 0.9, end: 0.6 },
      tint: [0x6f9a4a, 0xa8c45a, 0x8a6d3b],
      frequency: 1800,
    }).setDepth(D.leaves));
  }

  buildLighting() {
    // The lightmap is redrawn each frame and multiplied over the world.
    this.lightRT = this.add2(this.add.renderTexture(0, 0, WW, WH).setOrigin(0).setDepth(D.light));
    this.lightRT.setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.moonShafts = [
      { x: 40, y: 60, len: 220, w: 46, angle: 16, a: 0.3 },
      { x: 130, y: 150, len: 260, w: 38, angle: 16, a: 0.26 },
      { x: 70, y: 330, len: 240, w: 54, angle: 16, a: 0.28 },
    ];
    // Visible light shafts (very faint, additive, above the lightmap).
    this.moonShafts.forEach((s) => {
      this.add2(this.add.image(s.x, s.y - 40, 'beam').setOrigin(0.5, 0).setDisplaySize(s.w * 0.7, s.len)
        .setAngle(s.angle).setTint(COLORS.moonlight).setAlpha(0.07)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(D.emissive - 10));
    });

    // Mushroom glow (emissive).
    this.mushroomGlows = this.mushroomLights.map((m) =>
      this.add2(this.add.image(m.x, m.y, 'glow').setScale(0.1).setTint(COLORS.mushroomLight)
        .setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.emissive)));
  }

  buildStar() {
    this.star = new GuidingStar(this, FOCUS.x, FOCUS.y, {
      unit: 1, depth: D.emissive + 50, glowScale: 0.3, layer: this.world,
    });
    this.star.setTrailRate(70);
    this.star.mode = 'orb';
    this.starHome = { x: FOCUS.x, y: FOCUS.y };

    // A generous, invisible touch target that follows the star.
    this.starZone = this.add2(this.add.zone(FOCUS.x, FOCUS.y, 32, 32).setInteractive({ useHandCursor: true }));

    this.ring = this.add2(this.add.image(FOCUS.x, FOCUS.y, 'ring').setTint(COLORS.goldSoft)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(D.emissive + 40));

    this.fireflies = new Fireflies(this, { x: 10, y: 40, w: WW - 20, h: WH - 80 }, {
      count: 14, depth: D.emissive + 5, glowScale: 0.07, coreScale: 0.5, container: this.world,
    });
  }

  buildUI() {
    this.dialogue = new DialogueBox(this, this.ui);
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(0.85);
    this.ui.add(this.vignette);
    this.ui.bringToTop(this.dialogue.container);

    this.chapter = this.add.container(0, 0).setAlpha(0);
    this.ui.add(this.chapter);
    const label = makeText(this, 0, 0, STRINGS.prologue.chapterLabel, {
      fontFamily: FONT_TITLE, fontStyle: '600', fontSize: '30px', color: COLORS.inkGold,
      padding: { top: 10, bottom: 4, left: 4, right: 4 },
    }).setOrigin(0.5);
    label.setShadow(0, 2, '#05081a', 0, false, true);
    const rule = this.add.graphics();
    rule.fillStyle(COLORS.gold, 0.7);
    rule.fillRect(-60, 20, 44, 2);
    rule.fillRect(16, 20, 44, 2);
    const gem = this.add.image(0, 21, 'star-core').setTint(0xffe7b0);
    this.chapter.add([label, rule, gem]);
    this.uiTexts = [label, ...this.dialogue.texts];

    // Full-screen cover used to continue the falling-star shot.
    this.cover = this.add.rectangle(0, 0, 10, 10, COLORS.canopy).setOrigin(0).setAlpha(this.fromFall ? 1 : 0);
    this.ui.add(this.cover);
  }

  /** Huge crowns filling the screen that part as we drop through. */
  buildCanopyCover() {
    const v = this.view;
    const cx = WW / 2;
    const cy = v.y + v.h / 2;
    const spots = [
      [-30, -70, 'green1'], [40, -80, 'green4'], [-50, 10, 'green3'],
      [55, 20, 'green6'], [-10, 80, 'green0'], [35, 90, 'green2'], [0, -10, 'green5'],
    ];
    this.cover3 = spots.map(([dx, dy, f]) =>
      this.add2(this.add.image(cx + dx, cy + dy, 'bigTrees', f).setScale(4.2)
        .setTint(0x152434).setDepth(D.canopy).setAlpha(this.fromFall ? 1 : 0)));
  }

  // ---------------------------------------------------------------- layout
  applyLayout(L) {
    this.L = L;
    const cam = this.cameras.main;
    fitCamera(cam, L, ART);
    fitCamera(this.uiCam, L, 1);

    const vh = L.height / ART;
    // Keep the star ~40% down the screen; clamp inside the world.
    const scrollY = Phaser.Math.Clamp(FOCUS.y - vh * 0.4, 0, WH - vh);
    cam.scrollX = 0;
    cam.scrollY = scrollY;
    this.view = { y: scrollY, h: vh };

    this.dialogue.layout(L);
    this.vignette.setDisplaySize(L.width, L.height);
    this.cover.setSize(L.width, L.height + 2);
    this.chapter.setPosition(L.width / 2, L.safe.top + 76);
    refreshTextResolution(this.uiTexts);
  }

  // ---------------------------------------------------------------- sequence
  playEntrance() {
    const { star } = this;
    const v = this.view;
    const startY = v.y - 30;

    if (this.fromFall) {
      // Continue the shot: leaves part, darkness lifts, the star drops in.
      this.tweens.add({ targets: this.cover, alpha: 0, duration: 1300, ease: 'Sine.easeOut' });
      this.cover3.forEach((c) => {
        const dx = c.x - WW / 2;
        const dy = c.y - (v.y + v.h / 2);
        const len = Math.hypot(dx, dy) || 1;
        this.tweens.add({
          targets: c,
          x: c.x + (dx / len) * 170,
          y: c.y + (dy / len) * 170,
          scale: 7,
          alpha: 0,
          duration: 1700,
          ease: 'Sine.easeIn',
          onComplete: () => c.destroy(),
        });
      });
    }

    star.mode = 'meteor';
    star.setPosition(FOCUS.x + 6, startY);
    star.core.setScale(1.4);
    star.brightness = 1.6;
    star.setTrailRate(18);
    this.tweens.add({
      targets: star,
      y: FOCUS.y,
      x: FOCUS.x,
      duration: 1500,
      delay: this.fromFall ? 150 : 400,
      ease: 'Quad.easeOut',
      onComplete: () => this.land(),
    });
  }

  land() {
    const { star } = this;
    star.mode = 'orb';
    star.setTrailRate(90);
    star.burst(18, 0.8);
    soundManager.sfx('land');
    this.cameras.main.shake(140, 0.0015);

    // A ring of light ripples over the ground.
    this.ring.setPosition(FOCUS.x, FOCUS.y).setScale(0.3).setAlpha(0.9);
    this.tweens.add({ targets: this.ring, scale: 3.2, alpha: 0, duration: 1100, ease: 'Cubic.easeOut' });

    // Shrink into a tiny golden guide light.
    this.tweens.add({ targets: star, brightness: 2.4, duration: 220, yoyo: true, hold: 120,
      onComplete: () => this.tweens.add({ targets: star, brightness: 1, duration: 600 }) });
    this.tweens.add({ targets: star.core, scale: 1, angle: 360, duration: 900, ease: 'Back.easeOut' });

    // Chapter mark, then the first line.
    this.time.delayedCall(500, () => {
      this.tweens.add({ targets: this.chapter, alpha: 1, duration: 900, yoyo: true, hold: 1800, ease: 'Sine.easeInOut' });
    });
    this.time.delayedCall(1300, () => {
      this.ready = true;
      this.dialogue.say(STRINGS.prologue.firstLine).then(() => this.afterDialogue());
    });
    this.scheduleIdleMove();
  }

  afterDialogue() {
    // Leave the player in the forest. A soft ring invites a tap; tapping the
    // star now leads on into Chapter I (only in the real story scene).
    this.canContinue = this.sys.settings.key === 'Forest';
    this.time.delayedCall(this.canContinue ? 1800 : 4000, () => this.hintLoop());
  }

  hintLoop() {
    if ((this.starTapped && !this.canContinue) || this.leaving || !this.scene.isActive()) return;
    this.ring.setPosition(this.star.x, this.star.y).setScale(0.4).setAlpha(0.6);
    this.tweens.add({ targets: this.ring, scale: 1.6, alpha: 0, duration: 1400, ease: 'Sine.easeOut' });
    this.time.delayedCall(2800, () => this.hintLoop());
  }

  scheduleIdleMove() {
    this.time.delayedCall(Phaser.Math.Between(4500, 7500), () => {
      if (!this.scene.isActive()) return;
      if (!this.starBusy) {
        // An occasional curious little drift, then home again.
        const dx = Phaser.Math.Between(-7, 7);
        const dy = Phaser.Math.Between(-6, 2);
        this.starBusy = true;
        this.tweens.add({
          targets: this.star, x: this.starHome.x + dx, y: this.starHome.y + dy,
          duration: 900, ease: 'Sine.easeInOut', yoyo: true, hold: 600,
          onComplete: () => { this.starBusy = false; },
        });
        this.star.burst(4, 0.4);
      }
      this.scheduleIdleMove();
    });
  }

  onTap(pointer, over) {
    soundManager.unlock();
    if (!this.ready) return;
    const hitStar = over.includes(this.starZone);
    if (hitStar) {
      this.tapStar();
      return;
    }
    this.dialogue.handleTap();
  }

  /** The star drifts up the path and we follow it into Chapter I. */
  followStar() {
    if (this.leaving) return;
    this.leaving = true;
    const { star } = this;
    this.tweens.killTweensOf(star);
    this.starBusy = true;
    soundManager.sfx('chime', { detune: 700 });
    star.burst(12, 0.7);
    star.mode = 'meteor';
    star.setTrailRate(30);
    const topY = this.view.y - 40;
    const proxy = { y: star.y };
    this.tweens.add({
      targets: proxy, y: topY, duration: 2200, ease: 'Sine.easeIn',
      onUpdate: () => star.setPosition(pathAt(proxy.y, FOCUS.y).cx, proxy.y),
    });
    this.tweens.add({ targets: this.cover, alpha: 1, duration: 1300, delay: 1100, ease: 'Sine.easeIn',
      onComplete: () => this.scene.start('TwoPaths') });
  }

  tapStar() {
    if (this.canContinue) {
      this.followStar();
      return;
    }
    const { star } = this;
    this.starTapped = true;
    this.tweens.killTweensOf(star);
    this.starBusy = true;
    const notes = [0, 200, 400, 700, 900, 1200];
    soundManager.sfx('chime', { detune: Phaser.Utils.Array.GetRandom(notes) });
    star.burst(10, 0.6);
    const nx = Phaser.Math.Clamp(star.x + Phaser.Math.Between(-9, 9), this.starHome.x - 12, this.starHome.x + 12);
    const ny = Phaser.Math.Clamp(star.y + Phaser.Math.Between(-7, 3), this.starHome.y - 10, this.starHome.y + 4);
    this.tweens.add({ targets: star, x: nx, y: ny, duration: 520, ease: 'Back.easeOut',
      onComplete: () => { this.starBusy = false; } });
    this.tweens.add({ targets: star, brightness: 2.2, duration: 160, yoyo: true, hold: 140, ease: 'Sine.easeOut',
      onComplete: () => { star.brightness = 1; } });
    this.tweens.add({ targets: star.core, angle: star.core.angle + 90, duration: 500, ease: 'Back.easeOut' });
    // If the dialogue is still typing, a star tap also completes it.
    if (this.dialogue.typing) this.dialogue.handleTap();
  }

  // ---------------------------------------------------------------- frame
  drawLights(t) {
    const rt = this.lightRT;
    const ADD = Phaser.BlendModes.ADD;
    rt.clear();
    rt.fill(COLORS.forestAmbient, 1);

    this.moonShafts.forEach((s) => {
      rt.stamp('beam', null, s.x, s.y - 40, {
        originX: 0.5, originY: 0, scaleX: s.w / 32, scaleY: s.len / 128,
        angle: s.angle, tint: COLORS.moonlight, alpha: s.a, blendMode: ADD,
      });
    });

    const sx = this.star.core.x;
    const sy = this.star.core.y;
    const b = this.star.brightness;
    rt.stamp('light', null, sx, sy + 4, { scale: 1.4 * (0.85 + 0.15 * b), tint: COLORS.starLight, alpha: Math.min(1, 0.8 * b), blendMode: ADD });
    rt.stamp('light', null, sx, sy + 2, { scale: 0.45, tint: 0xffffff, alpha: Math.min(1, 0.35 * b), blendMode: ADD });

    this.mushroomLights.forEach((m, i) => {
      const f = 0.75 + 0.25 * Math.sin(t * 1.7 + m.phase);
      rt.stamp('light', null, m.x, m.y, { scale: m.r / 64, tint: COLORS.mushroomLight, alpha: 0.5 * f, blendMode: ADD });
      this.mushroomGlows[i]?.setAlpha(0.28 * f);
    });

    this.fireflies.flies.forEach((f) => {
      if (f.glow.alpha > 0.15) {
        rt.stamp('light', null, f.glow.x, f.glow.y, { scale: 0.16, tint: COLORS.firefly, alpha: f.glow.alpha * 0.55, blendMode: ADD });
      }
    });
  }

  update(time, dt) {
    const t = time / 1000;
    this.star.update(dt);
    this.starZone.setPosition(this.star.core.x, this.star.core.y);
    this.fireflies.update(dt);
    this.dialogue.update(dt);
    for (const s of this.swayers) {
      s.o.x = s.x + Math.sin(t * s.sp + s.ph) * s.amp;
    }
    this.drawLights(t);
  }
}
