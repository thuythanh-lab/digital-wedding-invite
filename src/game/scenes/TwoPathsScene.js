import Phaser from 'phaser';
import { COLORS } from '../config/theme.js';
import { STRINGS } from '../config/strings.vi.js';
import { StoryScene } from './StoryScene.js';
import { GuidingStar } from '../effects/GuidingStar.js';
import { Fireflies } from '../effects/Fireflies.js';
import { NightLighting } from '../systems/NightLighting.js';
import { Hotspot } from '../systems/Hotspot.js';
import { AncientTree } from '../world/AncientTree.js';
import {
  paintGround, scatterFlora, smoothPath, distToPath, inClearing, addLeaves, swayUpdate,
} from '../world/ForestKit.js';
import { MinhCharacter } from '../characters/MinhCharacter.js';
import { ThuyCharacter } from '../characters/ThuyCharacter.js';
import { loadCharacterSheets } from '../characters/characterAnimations.js';
import { PromptBubble, emote, showChapterCard } from '../ui/StoryUI.js';
import { soundManager } from '../audio/SoundManager.js';
import { AUDIO_KEYS } from '../audio/audioKeys.js';
import { makeRng } from '../utils/rng.js';

// World (art px). Wider than the 180-px view so the camera can drift
// between the two paths.
const WW = 260;
const WH = 720;
const TREE = { x: 130, baseY: 182 };
const SORT = 100;

const PATHS = {
  entry: { pts: [[130, 740], [130, 650]], hw: 11 },
  minh: {
    hw: 9,
    pts: smoothPath([[130, 650], [104, 614], [72, 578], [52, 522], [60, 470], [80, 420], [66, 368],
      [52, 318], [62, 268], [84, 226], [102, 198], [113, 186]]),
  },
  thuy: {
    hw: 9,
    phase: 2,
    pts: smoothPath([[130, 650], [156, 614], [190, 578], [210, 522], [200, 470], [182, 420], [196, 368],
      [210, 318], [200, 268], [178, 226], [160, 198], [148, 186]]),
  },
};
const CLEARINGS = [{ x: 130, y: 198, rx: 46, ry: 20 }, { x: 130, y: 648, rx: 22, ry: 14 }];

/** Points of a path between two heights, in walking order (upward). */
function route(path, fromY, toY) {
  return path.pts.filter(([, y]) => y <= fromY && y >= toY)
    .sort((a, b) => b[1] - a[1])
    .filter((p, i, arr) => i % 2 === 0 || i === arr.length - 1)
    .map(([x, y]) => ({ x, y }));
}
function pointAtY(path, y) {
  let best = path.pts[0];
  path.pts.forEach((p) => { if (Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p; });
  return { x: best[0], y: best[1] };
}

/**
 * CHAPTER I · Scenes 1–3 — the fork, following the light, the secret tree.
 */
export class TwoPathsScene extends StoryScene {
  constructor() {
    super('TwoPaths');
  }

  preload() {
    loadCharacterSheets(this);
  }

  create() {
    this.setupStage(WW, WH);
    this.rng = makeRng(808);
    this.time.delayedCall(10, () => soundManager.preloadMusic(this, AUDIO_KEYS.music.warm));
    soundManager.playMusic(AUDIO_KEYS.music.forest.key, { volume: 0.5, fadeIn: 2000 });
    soundManager.startAmbience(0.9);
    this.events.once('shutdown', () => soundManager.stopAmbience());

    this.buildWorld();
    this.buildCast();
    this.director.anchorY = 0.42;
    this.director.lookAt(130, 600);
    this.play();
  }

  buildWorld() {
    paintGround(this, 'paths-ground', WW, WH, { paths: Object.values(PATHS), clearings: CLEARINGS, seed: 21 });
    this.world.add(this.add.image(0, 0, 'paths-ground').setOrigin(0).setDepth(0));

    const blocked = (x, y, m) => Object.values(PATHS).some((p) => distToPath(p, x, y) < p.hw + m)
      || CLEARINGS.some((c) => inClearing(c, x, y, m));
    const flora = scatterFlora(this, this.world, this.rng, WW, WH, blocked, {
      trees: 150, bushes: 20, berries: 6, rocks: 14, mushrooms: 12, flowers: 18, tufts: 180,
      keepOut: [{ x: TREE.x, y: TREE.baseY - 30, rx: 62, ry: 52 }],
    });
    this.swayers = flora.swayers;

    this.tree = new AncientTree(this, this.world, TREE.x, TREE.baseY, {
      key: 'ancient-a', W: 76, H: 72, seed: 4, hollows: [{ dx: 0, dy: -2, w: 12, h: 14 }],
    });
    this.hollow = this.tree.hollows[0];
    this.mouth = this.add.image(this.hollow.x, this.hollow.y + this.hollow.h / 2, 'hollow-mouth')
      .setOrigin(0.5, 1).setAlpha(0).setDepth(SORT + TREE.baseY + 0.6);
    this.world.add(this.mouth);

    this.light = new NightLighting(this, this.world, WW, WH, { ambient: 0x343f7c });
    [[40, 80], [160, 260], [70, 420], [190, 520], [120, 600]].forEach(([x, y], i) => {
      this.light.addBeam({ x, y, len: 240, w: 46, angle: 16, alpha: 0.24 + (i % 2) * 0.05 });
    });
    flora.mushroomLights.forEach((m) => this.light.add({ x: m.x, y: m.y, radius: 12, color: COLORS.mushroomLight, intensity: 0.5, flicker: 0.4 }));
    this.light.add({ x: TREE.x - 6, y: TREE.baseY - 40, radius: 70, color: COLORS.moonlight, intensity: 0.55 });
    this.light.addBeam({ x: TREE.x - 30, y: 20, len: 200, w: 80, angle: 10, alpha: 0.3, color: 0xc9d6ff });
    this.world.add(this.add.image(TREE.x, TREE.baseY - 70, 'glow').setScale(1.3).setTint(0x9fb4ff).setAlpha(0.13)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(5080));
    this.hollowLight = this.light.add({ x: this.hollow.x, y: this.hollow.y, radius: 18, color: 0xffd27a, intensity: 0.25, flicker: 0.3 });

    this.fireflies = new Fireflies(this, { x: 10, y: 40, w: WW - 20, h: WH - 60 }, {
      count: 22, depth: 5150, glowScale: 0.07, coreScale: 0.5, container: this.world,
    });
    addLeaves(this, this.world, WW);
  }

  buildCast() {
    const m0 = pointAtY(PATHS.minh, 560);
    const t0 = pointAtY(PATHS.thuy, 566);
    this.minh = new MinhCharacter(this, { x: m0.x, y: m0.y, facing: 'up', layer: this.world, depthBase: SORT });
    this.thuy = new ThuyCharacter(this, { x: t0.x, y: t0.y, facing: 'up', variant: '-bq', layer: this.world, depthBase: SORT });

    this.star = new GuidingStar(this, 130, 760, { unit: 1, depth: 5200, glowScale: 0.3, layer: this.world });
    this.star.mode = 'orb';
    this.star.setTrailRate(70);
    this.starLight = this.light.add({ x: 130, y: 760, radius: 64, color: COLORS.starLight, intensity: 0.9 });
    this.starLit = true;
  }

  /** Characters stroll up their own path, pausing to look around. */
  async stroll(c, path, fromY, toY, { speed = 24, lookEvery = 2 } = {}) {
    const pts = route(path, fromY, toY);
    for (let i = 0; i < pts.length; i++) {
      if (!this.script.alive || c._stopStroll) return;
      // eslint-disable-next-line no-await-in-loop
      await c.moveTo(pts[i].x, pts[i].y, { speed, axisBias: 1.8 });
      if (lookEvery && i > 0 && i % (lookEvery * 4) === 0 && !c._stopStroll) {
        // eslint-disable-next-line no-await-in-loop
        await c.playAction('look');
      }
    }
  }

  async play() {
    const s = this.script;
    const { star } = this;

    // ---- Scene 1: the fork ---------------------------------------------------------
    this.fadeIn(1100);
    showChapterCard(this, STRINGS.chapter1.label, STRINGS.chapter1.title);
    s.tween({ targets: star, y: 628, duration: 2200, ease: 'Sine.easeOut' });
    this.stroll(this.minh, PATHS.minh, 562, 470, { speed: 14, lookEvery: 1 });
    this.stroll(this.thuy, PATHS.thuy, 568, 470, { speed: 14, lookEvery: 1 });
    await s.wait(2600);
    await this.say(STRINGS.chapter1.fork);

    // ---- Scene 2: follow the light --------------------------------------------------
    await s.tween({ targets: star, y: 598, duration: 900, ease: 'Sine.easeInOut' });
    const hs = new Hotspot(this, star.x, star.y, { radius: 16, layer: this.world, ringScale: 0.9 });
    this.starHotspot = hs;
    soundManager.synth('glow', { volume: 0.6 });
    await s.guard(hs.wait());
    soundManager.sfx('chime');
    star.burst(12, 0.7);
    this.tweens.add({ targets: star, brightness: 2, duration: 180, yoyo: true });

    // Both keep walking toward the tree while the light leads the camera.
    this.minh._stopStroll = true;
    this.thuy._stopStroll = true;
    this.minh.halt('up');
    this.thuy.halt('up');
    const toTreeM = route(PATHS.minh, this.minh.y, 204);
    const toTreeT = route(PATHS.thuy, this.thuy.y, 204);
    const walkM = this.minh.walkPath(toTreeM, { speed: 30, axisBias: 1.8, faceOnArrival: 'up' });
    const walkT = s.wait(500).then(() => this.thuy.walkPath(toTreeT, { speed: 30, axisBias: 1.8, faceOnArrival: 'up' }));

    // Camera: follow the star upward; glance at his path, then at hers.
    const focus = { x: 130, y: star.y };
    this.director.follow(focus, { lerp: 1 });
    const followY = () => { focus.y = star.y + 26; };
    this.events.on('update', followY);
    const starRise = s.tween({ targets: star, y: this.hollow.y - 22, duration: 10500, ease: 'Sine.easeInOut' });
    await s.wait(500);
    await s.tween({ targets: focus, x: 92, duration: 2600, ease: 'Sine.easeInOut' });
    await s.wait(900);
    await s.tween({ targets: focus, x: 168, duration: 3200, ease: 'Sine.easeInOut' });
    await s.wait(900);
    await s.tween({ targets: focus, x: 130, duration: 2200, ease: 'Sine.easeInOut' });
    await starRise;
    this.events.off('update', followY);

    // ---- Scene 3: the secret tree -------------------------------------------------------
    this.director.panTo(TREE.x, TREE.baseY - 14, 1400);
    // The star slips into the hollow.
    await s.tween({ targets: star, x: this.hollow.x, y: this.hollow.y, duration: 1100, ease: 'Sine.easeIn' });
    star.burst(10, 0.5);
    soundManager.sfx('chime', { detune: -500 });
    this.tweens.add({ targets: [star.core, star.glow, star.halo], alpha: 0, duration: 300 });
    star.setTrailRate(0);
    this.starLit = false;
    this.tweens.add({ targets: this.starLight, intensity: 0, duration: 500 });
    this.tweens.add({ targets: this.hollowLight, intensity: 0.85, radius: 26, duration: 700 });
    this.mouth.setAlpha(1).setScale(0.8);

    await s.all(walkM, walkT);
    this.minh.idle('up');
    this.thuy.idle('up');

    const bubble = new PromptBubble(this, this.world, this.hollow.x, this.hollow.y - 16, STRINGS.chapter1.explore);
    this.uiTexts.push(bubble.text);
    bubble.show();
    const hollowSpot = new Hotspot(this, this.hollow.x, this.hollow.y, { radius: 15, layer: this.world, ringScale: 0.7 });
    await s.guard(hollowSpot.wait());
    bubble.hide();
    await this.enterTree();
  }

  /** The tree wakes, both look, step closer… and get pulled in. */
  async enterTree() {
    const s = this.script;
    const h = this.hollow;
    soundManager.sfx('creak');
    this.tree.glow(this, 0xffe2a8, 1200);
    this.tweens.add({ targets: this.hollowLight, intensity: 1.2, radius: 34, duration: 900 });
    await s.tween({ targets: this.mouth, scale: 1.45, duration: 900, ease: 'Back.easeOut' });

    await s.all(this.minh.lookAt({ x: h.x, y: h.y }), this.thuy.lookAt({ x: h.x, y: h.y }));
    await s.wait(300);
    await s.all(
      this.minh.moveTo(h.x - 10, h.y + 14, { speed: 26 }),
      s.wait(250).then(() => this.thuy.moveTo(h.x + 10, h.y + 14, { speed: 26 })),
    );
    this.minh.idle('up');
    this.thuy.idle('up');
    await s.wait(250);

    // Surprise!
    soundManager.sfx('pop');
    [this.minh, this.thuy].forEach((c, i) => {
      emote(this, this.world, c, 'bang', 900);
      this.tweens.add({ targets: c, y: c.y - 3, duration: 110, yoyo: true, delay: i * 90, ease: 'Sine.easeOut' });
    });
    await s.wait(800);

    // Whoosh — into the hollow.
    soundManager.synth('slide', { volume: 0.9, duration: 1 });
    soundManager.sfx('tumble');
    [this.minh, this.thuy].forEach((c, i) => {
      c.shadow?.setVisible(false);
      c.sprite.setDepth(SORT + TREE.baseY + 0.8);
      c.sortByY = false;
      c.depthBase = SORT + TREE.baseY + 0.8;
      this.tweens.add({
        targets: c, x: h.x, y: h.y + 4, duration: 700, delay: i * 140, ease: 'Back.easeIn',
      });
      this.tweens.add({
        targets: c.sprite, scale: 0.15, angle: i ? 260 : -260, alpha: 0, duration: 700, delay: i * 140, ease: 'Back.easeIn',
      });
    });
    await s.wait(900);
    await this.irisWipe(h.x, h.y, true, 650);
    this.scene.start('TreeTunnel');
  }

  update(time, dt) {
    const t = time / 1000;
    this.star?.update(dt);
    if (this.star) {
      this.starLight.x = this.star.core.x;
      this.starLight.y = this.star.core.y;
      if (this.starLit) this.starLight.intensity = 0.75 + 0.15 * this.star.brightness;
      this.starHotspot?.setPosition(this.star.core.x, this.star.core.y);
    }
    this.fireflies?.update(dt);
    swayUpdate(this.swayers || [], t);
  }
}

