import Phaser from 'phaser';
import { COLORS, FONT_TITLE } from '../config/theme.js';
import { STRINGS } from '../config/strings.vi.js';
import { StoryScene } from './StoryScene.js';
import { GuidingStar } from '../effects/GuidingStar.js';
import { Fireflies } from '../effects/Fireflies.js';
import { NightLighting } from '../systems/NightLighting.js';
import { storyState } from '../systems/StoryState.js';
import { AncientTree } from '../world/AncientTree.js';
import {
  paintGround, scatterFlora, smoothPath, distToPath, inClearing, addLeaves, swayUpdate,
} from '../world/ForestKit.js';
import { MinhCharacter } from '../characters/MinhCharacter.js';
import { ThuyCharacter } from '../characters/ThuyCharacter.js';
import { loadCharacterSheets } from '../characters/characterAnimations.js';
import { emote, ItemDiscovery } from '../ui/StoryUI.js';
import { PixelButton } from '../ui/PixelButton.js';
import { SmallButton } from '../ui/SmallButton.js';
import { soundManager } from '../audio/SoundManager.js';
import { AUDIO_KEYS } from '../audio/audioKeys.js';
import { makeText } from '../utils/text.js';
import { makeRng } from '../utils/rng.js';

const WW = 180;
const WH = 460;
const SORT = 100;
const TREE = { x: 90, baseY: 152 };
const CLEARING = { x: 90, y: 230, rx: 76, ry: 56 };
const HOLD_GAP = 16; // art px between the two when their hands meet
const MEET = { x: 90, y: 224 };
const HIDDEN = {
  hw: 8,
  hidden: true,
  pts: smoothPath([[50, 214], [32, 188], [22, 158], [24, 120], [14, 82], [18, 42], [8, -12]]),
};
const ENTRY = { pts: smoothPath([[90, 470], [96, 420], [88, 330], [90, 286]]), hw: 9 };

/**
 * CHAPTER I · Scene 4 — two paths become one, the Promise Key, the hidden path.
 */
export class ClearingScene extends StoryScene {
  constructor() {
    super('Clearing');
  }

  preload() {
    loadCharacterSheets(this);
  }

  create() {
    this.setupStage(WW, WH);
    this.rng = makeRng(2412);
    soundManager.preloadMusic(this, AUDIO_KEYS.music.warm);
    soundManager.playMusic(AUDIO_KEYS.music.forest.key, { volume: 0.5, fadeIn: 1500 });
    soundManager.startAmbience(0.8);
    this.events.once('shutdown', () => soundManager.stopAmbience());
    this.buildWorld();
    this.director.anchorY = 0.5;
    this.director.lookAt(MEET.x, 206);
    this.play();
  }

  buildWorld() {
    const paths = [ENTRY, HIDDEN];
    paintGround(this, 'clearing-ground', WW, WH, { paths, clearings: [CLEARING], seed: 33 });
    paintGround(this, 'clearing-ground-open', WW, WH, { paths, clearings: [CLEARING], seed: 33, showHidden: true });
    this.world.add(this.add.image(0, 0, 'clearing-ground').setOrigin(0).setDepth(0));
    this.groundOpen = this.add.image(0, 0, 'clearing-ground-open').setOrigin(0).setDepth(0.5).setAlpha(0);
    this.world.add(this.groundOpen);

    const blocked = (x, y, m) => inClearing(CLEARING, x, y, m)
      || distToPath(ENTRY, x, y) < ENTRY.hw + m || distToPath(HIDDEN, x, y) < HIDDEN.hw + m + 2;
    const flora = scatterFlora(this, this.world, this.rng, WW, WH, blocked, {
      trees: 70, bushes: 10, berries: 4, rocks: 9, mushrooms: 8, flowers: 16, tufts: 120,
      keepOut: [{ x: TREE.x, y: TREE.baseY - 30, rx: 56, ry: 50 }],
    });
    this.swayers = flora.swayers;

    // Overgrowth hiding the secret path (cleared at the end).
    this.blockers = [[38, 196], [26, 168], [22, 138]].map(([x, y], i) => {
      const b = this.add.image(x, y, 'bushes', i === 1 ? 'big' : 'wide').setOrigin(0.5, 1).setDepth(SORT + y);
      this.world.add(b);
      return b;
    });

    this.tree = new AncientTree(this, this.world, TREE.x, TREE.baseY, {
      key: 'ancient-b', W: 84, H: 74, seed: 9,
      hollows: [{ dx: -21, dy: -2, w: 10, h: 11 }, { dx: 21, dy: -2, w: 10, h: 11 }],
    });

    // Moss stones and closed buds around the clearing.
    this.buds = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + this.rng.range(-0.12, 0.12);
      const k = this.rng.range(0.82, 1.02);
      const x = CLEARING.x + Math.cos(a) * CLEARING.rx * k;
      const y = CLEARING.y + Math.sin(a) * CLEARING.ry * k;
      if (y < TREE.baseY + 4 || distToPath(HIDDEN, x, y) < 12 || distToPath(ENTRY, x, y) < 12) continue;
      const b = this.add.image(Math.round(x), Math.round(y), 'bud').setOrigin(0.5, 1).setDepth(2.5);
      this.world.add(b);
      this.buds.push(b);
    }

    this.light = new NightLighting(this, this.world, WW, WH, { ambient: 0x3a4686 });
    this.light.addBeam({ x: 74, y: 30, len: 300, w: 130, angle: 8, alpha: 0.46, color: 0xffe2a8 }); // golden moonlight
    this.light.add({ x: MEET.x, y: MEET.y - 8, radius: 60, color: 0xffe9bf, intensity: 0.35 });
    this.light.addBeam({ x: 150, y: 220, len: 240, w: 40, angle: 16, alpha: 0.2 });
    this.world.add(this.add.image(78, 40, 'beam').setOrigin(0.5, 0).setDisplaySize(90, 270).setAngle(8)
      .setTint(0xffe2a8).setAlpha(0.13).setBlendMode(Phaser.BlendModes.ADD).setDepth(5090));
    flora.mushroomLights.forEach((m) => this.light.add({ x: m.x, y: m.y, radius: 12, color: COLORS.mushroomLight, intensity: 0.5, flicker: 0.4 }));
    this.holeLights = this.tree.hollows.map((h) => this.light.add({ x: h.x, y: h.y, radius: 20, color: 0xb8c8ff, intensity: 0.9, flicker: 0.3 }));

    this.fireflies = new Fireflies(this, { x: 14, y: 140, w: WW - 28, h: 220 }, {
      count: 18, depth: 5150, glowScale: 0.07, coreScale: 0.5, container: this.world,
    });
    addLeaves(this, this.world, WW);
  }

  async play() {
    const s = this.script;
    const [hl, hr] = this.tree.hollows;

    // ---- They pop out of two different hollows -------------------------------------------
    this.fadeIn(700, 0x0b1020);
    await s.wait(500);
    this.minh = await this.popOut(MinhCharacter, hl, { x: 58, y: 192 }, '', -1);
    await s.wait(260);
    this.thuy = await this.popOut(ThuyCharacter, hr, { x: 122, y: 192 }, '-bq', 1);
    this.tweens.add({ targets: this.holeLights, intensity: 0.35, duration: 1200 });
    await s.wait(500);

    // ---- They look around, notice each other, and pause -------------------------------------
    await s.all(this.minh.playAction('look'), s.wait(250).then(() => this.thuy.playAction('look')));
    await s.all(this.minh.turnTo('right'), this.thuy.turnTo('left'));
    emote(this, this.world, this.minh, 'dots', 1100);
    await s.wait(180);
    emote(this, this.world, this.thuy, 'dots', 1100);
    await s.wait(1300);

    // ---- Walk toward each other --------------------------------------------------------
    await s.all(
      this.minh.moveTo(MEET.x - HOLD_GAP / 2, MEET.y, { speed: 22 }),
      s.wait(180).then(() => this.thuy.moveTo(MEET.x + HOLD_GAP / 2, MEET.y, { speed: 22 })),
    );
    this.minh.idle('right');
    this.thuy.idle('left');
    await s.wait(700);

    // ---- Hands -------------------------------------------------------------------------
    soundManager.playMusic(AUDIO_KEYS.music.warm.key, { volume: 0.5, fadeIn: 3500 });
    await s.all(this.minh.turnTo('down'), this.thuy.turnTo('down'));
    await s.wait(300);
    this.minh.pose('reach', 'down');
    await s.wait(650);
    this.thuy.pose('reach', 'down');
    await s.wait(500);
    this.minh.pose('hold', 'down');
    this.thuy.pose('hold', 'down');
    this.handGlow = this.add.image(MEET.x, MEET.y - 9, 'glow').setScale(0.05).setTint(0xffe2a8)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(5300).setAlpha(0.9);
    this.world.add(this.handGlow);
    this.tweens.add({ targets: this.handGlow, scale: 0.16, alpha: 0, duration: 1200, ease: 'Sine.easeOut' });
    soundManager.synth('glow', { volume: 0.7 });
    this.coupleLight = this.light.add({ x: MEET.x, y: MEET.y - 10, radius: 4, color: 0xffd9a0, intensity: 0.8 });
    this.tweens.add({ targets: this.coupleLight, radius: 46, duration: 1600, ease: 'Sine.easeOut' });
    await s.wait(1100);
    await this.say(STRINGS.chapter1.together);

    // ---- The Promise Key ------------------------------------------------------------------
    await this.formKey();
    await new ItemDiscovery(this).show({
      textureKey: 'promise-key', title: STRINGS.chapter1.found, name: STRINGS.chapter1.keyName,
      hint: STRINGS.chapter1.tapToContinue,
    });
    storyState.set('hasPromiseKey', true);
    storyState.set('chapter', Math.max(1, storyState.get('chapter') || 0));

    // ---- The hidden path ---------------------------------------------------------------
    await this.revealPath();
    this.showContinue();
  }

  async popOut(Cls, hole, land, variant, side) {
    const s = this.script;
    const c = new Cls(this, { x: hole.x, y: hole.y + 2, facing: 'down', variant, layer: this.world, depthBase: SORT });
    c.sprite.setScale(0.2).setAlpha(0);
    c.shadow?.setAlpha(0);
    soundManager.sfx('pop', { detune: side > 0 ? 300 : 0 });
    this.tweens.add({ targets: c.sprite, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c.sprite, angle: { from: side * -200, to: 0 }, duration: 520, ease: 'Sine.easeOut' });
    // A little arc: across in x, up-and-down in y.
    const hop = { t: 0 };
    const x0 = c.x;
    const y0 = c.y;
    await s.tween({
      targets: hop, t: 1, duration: 560, ease: 'Linear',
      onUpdate: () => {
        const t = hop.t;
        c.setPosition(Phaser.Math.Linear(x0, land.x, t), Phaser.Math.Linear(y0, land.y, t) - Math.sin(t * Math.PI) * 14);
      },
    });
    c.shadow?.setAlpha(0.75);
    const puff = this.add.particles(c.x, c.y, 'dot3', {
      lifespan: 500, speed: { min: 6, max: 20 }, angle: { min: 180, max: 360 }, scale: { start: 0.7, end: 0 },
      alpha: { start: 0.8, end: 0 }, tint: [0x9fbf7a, 0xd8e6c0], emitting: false,
    }).setDepth(SORT + c.y + 1);
    this.world.add(puff);
    puff.explode(8);
    this.time.delayedCall(700, () => puff.destroy());
    this.tweens.add({ targets: c.sprite, scaleY: 0.86, duration: 80, yoyo: true });
    c.idle('down');
    return c;
  }

  async formKey() {
    const s = this.script;
    // The star returns from the tree's crown, brighter than ever.
    const star = new GuidingStar(this, TREE.x, TREE.baseY - 40, { unit: 1, depth: 5300, glowScale: 0.3, layer: this.world });
    star.mode = 'orb';
    star.setTrailRate(60);
    this.star = star;
    star.core.setScale(0);
    this.starLight = this.light.add({ x: star.x, y: star.y, radius: 10, color: COLORS.starLight, intensity: 1 });
    soundManager.synth('sparkle', { volume: 0.7 });
    await s.all(
      s.tween({ targets: star.core, scale: 1, duration: 500, ease: 'Back.easeOut' }),
      s.tween({ targets: star, y: TREE.baseY - 6, duration: 1000, ease: 'Sine.easeInOut' }),
    );
    // The forest brightens.
    this.tweens.add({ targets: this.starLight, radius: 110, duration: 1200, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: this.light, ambientBoost: 0.22, duration: 1400 });
    this.tweens.add({ targets: star, brightness: 2.4, duration: 900, ease: 'Sine.easeInOut' });
    await s.wait(700);

    // Two golden fragments drift out and find each other above the couple.
    const meet = { x: MEET.x, y: MEET.y - 44 };
    const frags = ['a', 'b'].map((k, i) => {
      const f = this.add.image(star.x, star.y, `key-half-${k}`).setDepth(5310).setScale(0.4).setAlpha(0);
      const g = this.add.image(star.x, star.y, 'glow').setDepth(5305).setScale(0.12).setTint(0xffd98a)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.world.add([g, f]);
      return { f, g, side: i ? 1 : -1 };
    });
    soundManager.sfx('chime', { detune: 200 });
    await s.all(...frags.map(({ f, g, side }) => {
      const p = { t: 0 };
      const x0 = star.x;
      const y0 = star.y;
      return s.tween({
        targets: p, t: 1, duration: 2200, ease: 'Sine.easeInOut',
        onUpdate: () => {
          const t = p.t;
          const x = Phaser.Math.Linear(x0, meet.x + side * 4, t) + Math.sin(t * Math.PI) * side * 26;
          const y = Phaser.Math.Linear(y0, meet.y, t) + Math.sin(t * Math.PI) * -6;
          f.setPosition(x, y).setAlpha(Math.min(1, t * 4)).setScale(0.4 + 0.6 * Math.min(1, t * 2)).setAngle((1 - t) * side * 40);
          g.setPosition(x, y).setAlpha(Math.min(0.7, t * 3));
        },
      });
    }));
    // Merge.
    soundManager.sfx('merge');
    const pulse = this.add.image(meet.x, meet.y, 'glow').setDepth(5306).setScale(0.1).setTint(0xffe7b0)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95);
    this.world.add(pulse);
    this.tweens.add({ targets: pulse, scale: 1.1, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => pulse.destroy() });
    frags.forEach(({ f, g }) => { f.destroy(); g.destroy(); });
    this.key = this.add.image(meet.x, meet.y, 'promise-key').setDepth(5310);
    this.keyGlow = this.add.image(meet.x, meet.y, 'glow').setDepth(5305).setScale(0.28).setTint(0xffd98a)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
    this.world.add([this.keyGlow, this.key]);
    this.keyLight = this.light.add({ x: meet.x, y: meet.y, radius: 40, color: 0xffd98a, intensity: 0.9 });
    this.tweens.add({ targets: [this.key, this.keyGlow], y: '-=2', duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const burst = this.add.particles(meet.x, meet.y, 'sparkle', {
      lifespan: 900, speed: { min: 10, max: 30 }, scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [0xffe3a3, 0xffffff], blendMode: Phaser.BlendModes.ADD, emitting: false,
    }).setDepth(5320);
    this.world.add(burst);
    burst.explode(16);
    this.tweens.add({ targets: star, brightness: 1.2, duration: 900 });
    await s.wait(900);
  }

  async revealPath() {
    const s = this.script;
    const { star } = this;
    soundManager.synth('glow', { volume: 0.8 });
    this.tree.glow(this, 0xffe7b0, 1400);
    this.tweens.add({ targets: this.light, ambientBoost: 0.36, duration: 2400 });
    // Flowers open one after another.
    this.buds.forEach((b, i) => {
      this.time.delayedCall(i * 90, () => {
        if (!b.active) return;
        b.setTexture(i % 3 === 0 ? 'bloom-blush' : 'bloom').setScale(0.4);
        this.tweens.add({ targets: b, scale: 1, duration: 300, ease: 'Back.easeOut' });
      });
    });
    await s.wait(900);
    // The overgrowth parts and the hidden path appears.
    soundManager.sfx('tumble', { volume: 0.25 });
    this.blockers.forEach((b, i) => {
      const leaves = this.add.particles(b.x, b.y - 5, 'leaf', {
        lifespan: 900, speed: { min: 8, max: 26 }, scale: { min: 1, max: 1.4 }, rotate: { min: 0, max: 360 },
        alpha: { start: 1, end: 0 }, tint: [0x6f9a4a, 0xa8c45a], emitting: false,
      }).setDepth(SORT + b.y + 1);
      this.world.add(leaves);
      this.time.delayedCall(i * 220, () => {
        leaves.explode(10);
        this.tweens.add({ targets: b, scaleX: 0, scaleY: 0.2, alpha: 0, x: b.x - 6, duration: 500, ease: 'Back.easeIn' });
      });
    });
    await s.tween({ targets: this.groundOpen, alpha: 1, duration: 1600, ease: 'Sine.easeInOut' });
    HIDDEN.pts.filter((p, i) => i % 6 === 3 && p[1] > 30).forEach(([x, y], i) => {
      this.time.delayedCall(i * 160, () => {
        const l = this.light.add({ x, y, radius: 1, color: 0xffd98a, intensity: 0.7 });
        this.tweens.add({ targets: l, radius: 16, duration: 700, ease: 'Sine.easeOut' });
      });
    });

    // The star moves to the path; the couple turns to face it.
    this.tweens.add({ targets: [this.key, this.keyGlow], alpha: 0.85, duration: 300 });
    s.tween({ targets: star, x: 40, y: 192, duration: 1800, ease: 'Sine.easeInOut' })
      .then(() => this.tweens.add({ targets: star, x: 30, y: 168, duration: 2200, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 }));
    await s.wait(500);
    this.minh.pose('hold', 'up');
    this.thuy.pose('hold', 'up');
    await this.director.panTo(64, 182, 2800);
  }

  showContinue() {
    const L = this.L;
    const y = L.height - Math.max(L.safe.bottom, 6) - 54;
    this.continueBtn = new PixelButton(this, L.width / 2, y, STRINGS.chapter1.continueJourney, {
      width: 270, height: 52, onPress: () => this.endChapter(),
    });
    this.ui.add(this.continueBtn);
    this.uiTexts.push(...this.continueBtn.texts);
    this.continueBtn.setAlpha(0);
    this.tweens.add({ targets: this.continueBtn, alpha: 1, duration: 700 });
  }

  /** Chapter I ends: follow the star down the hidden path into Chương II. */
  async endChapter() {
    if (this.leaving) return;
    this.leaving = true;
    soundManager.sfx('select');
    this.tweens.add({ targets: this.continueBtn, alpha: 0, duration: 300 });
    this.tweens.killTweensOf(this.star);
    this.tweens.add({ targets: this.star, x: 16, y: 120, duration: 1400, ease: 'Sine.easeIn' });
    this.minh.walkPath([{ x: 44, y: 206 }], { speed: 22 });
    this.thuy.walkPath([{ x: 58, y: 210 }], { speed: 22 });
    await this.fadeOut(1300, 0x060914);
    this.scene.start('ForgottenGate');
  }

  update(time, dt) {
    const t = time / 1000;
    if (this.star) {
      this.star.update(dt);
      this.starLight.x = this.star.core.x;
      this.starLight.y = this.star.core.y;
    }
    if (this.keyLight && this.key) {
      this.keyLight.x = this.key.x;
      this.keyLight.y = this.key.y;
    }
    this.fireflies?.update(dt);
    swayUpdate(this.swayers || [], t);
  }
}
