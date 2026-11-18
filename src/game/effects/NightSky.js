import Phaser from 'phaser';
import { COLORS, DEPTH } from '../config/theme.js';
import { makeRng } from '../utils/rng.js';
import { WORLD_W } from '../utils/viewport.js';

export const SKY_SEED = 2412;

/**
 * Layered night backdrop in logical units (360 × H).
 *
 * Built deterministically from a seed so the Title and FallingStar scenes can
 * create pixel-identical copies — the hand-off between them is invisible.
 * Every layer is a Container with its own scroll factor; when the camera
 * falls, the layers slide at different speeds (parallax).
 *
 * Vertical composition (fractions of H):
 *   0.00–0.20  open sky + stars + moon
 *   0.22–0.45  title band (added by TitleScene)
 *   0.50–0.78  mountains, forest silhouettes
 *   0.80–1.00  dark foreground forest floor (start button lives here)
 */
export class NightSky {
  constructor(scene, H, { seed = SKY_SEED } = {}) {
    this.scene = scene;
    this.H = H;
    this.rng = makeRng(seed);
    this.time = 0;
    this.stars = [];
    this.swayers = [];
    this.layers = {};

    this.horizon = H * 0.6;
    this.build();
  }

  layer(name, depth, scrollFactor) {
    const c = this.scene.add.container(0, 0).setDepth(depth).setScrollFactor(scrollFactor);
    this.layers[name] = c;
    return c;
  }

  build() {
    const { scene, H, rng } = this;
    const deep = H * 6; // how far layer fills extend below (for the fall)

    // ---- Sky: dithered gradient generated at 1/4 resolution ------------------
    const skyKey = `sky-${Math.round(H)}`;
    if (!scene.textures.exists(skyKey)) {
      const sw = WORLD_W / 4;
      const sh = Math.ceil((H * 0.95) / 4);
      const tex = scene.textures.createCanvas(skyKey, sw, sh);
      const ctx = tex.getContext();
      const bands = COLORS.sky;
      const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let y = 0; y < sh; y++) {
        const t = Math.pow(y / (sh - 1), 1.25) * (bands.length - 1);
        const i = Math.min(bands.length - 2, Math.floor(t));
        const f = t - i;
        for (let x = 0; x < sw; x++) {
          const threshold = (bayer[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
          ctx.fillStyle = f > threshold ? bands[i + 1] : bands[i];
          ctx.fillRect(x, y, 1, 1);
        }
      }
      tex.refresh();
    }
    const sky = this.layer('sky', DEPTH.sky, 0.1);
    sky.add(scene.add.image(0, 0, skyKey).setOrigin(0).setScale(4));
    sky.add(scene.add.rectangle(0, H * 0.94, WORLD_W, deep, 0x2e3b6b).setOrigin(0));

    // ---- Stars ---------------------------------------------------------------
    const starLayer = this.layer('stars', DEPTH.stars, 0.12);
    const starCount = Math.round(70 * (H / 700));
    for (let i = 0; i < starCount; i++) {
      // Denser near the top of the sky.
      const y = Math.pow(rng.next(), 1.6) * H * 0.56 + 4;
      const x = rng.range(4, WORLD_W - 4);
      const bright = rng.chance(0.12);
      const img = bright
        ? scene.add.image(x, y, 'sparkle').setScale(2)
        : scene.add.image(x, y, 'px').setScale(rng.chance(0.3) ? 1 : 0.5);
      const tint = rng.pick([0xffffff, 0xfff1cf, 0xd8e2ff, 0xcfd8ff]);
      img.setTint(tint);
      const base = bright ? rng.range(0.7, 1) : rng.range(0.35, 0.9);
      const star = { img, base, speed: rng.range(0.6, 2.2), phase: rng.range(0, Math.PI * 2), boost: 0 };
      img.setAlpha(base);
      starLayer.add(img);
      this.stars.push(star);
    }

    // The star that will fall: a little brighter, upper-left of the moon.
    const dx = 132;
    const dy = H * 0.135;
    const destinyGlow = scene.add.image(dx, dy, 'glow').setScale(0.16).setAlpha(0.45)
      .setTint(COLORS.goldSoft).setBlendMode(Phaser.BlendModes.ADD);
    const destiny = scene.add.image(dx, dy, 'sparkle').setScale(2).setTint(0xfff3d1);
    starLayer.add([destinyGlow, destiny]);
    this.destiny = { img: destiny, glow: destinyGlow, x: dx, y: dy };

    // ---- Moon ----------------------------------------------------------------
    const moonLayer = this.layer('moon', DEPTH.moon, 0.08);
    const mx = 282;
    const my = H * 0.12;
    moonLayer.add(scene.add.image(mx, my, 'glow').setScale(2.4).setAlpha(0.12)
      .setTint(0x9fb0ff).setBlendMode(Phaser.BlendModes.ADD));
    moonLayer.add(scene.add.image(mx, my, 'glow').setScale(0.9).setAlpha(0.28)
      .setTint(0xdfe4ff).setBlendMode(Phaser.BlendModes.ADD));
    moonLayer.add(scene.add.image(mx, my, 'moon').setScale(2));
    this.moonPos = { x: mx, y: my };

    // ---- Mountains -----------------------------------------------------------
    const farTop = H * 0.47;
    const far = this.layer('ridgeFar', DEPTH.mountains, 0.3);
    far.add(scene.add.image(0, farTop, 'ridge-far').setOrigin(0).setScale(2));
    far.add(scene.add.rectangle(0, farTop + 138, WORLD_W, deep, COLORS.mountainFar).setOrigin(0));

    const nearTop = H * 0.53;
    const near = this.layer('ridgeNear', DEPTH.mountains + 1, 0.42);
    near.add(scene.add.image(0, nearTop, 'ridge-near').setOrigin(0).setScale(2));
    near.add(scene.add.rectangle(0, nearTop + 138, WORLD_W, deep, COLORS.mountainNear).setOrigin(0));

    // ---- Mist ----------------------------------------------------------------
    const mist = this.layer('mist', DEPTH.mist, 0.5);
    this.mistA = scene.add.image(WORLD_W / 2, H * 0.635, 'mist').setDisplaySize(WORLD_W * 1.6, 46)
      .setAlpha(0.16).setTint(0x8fa0e0).setBlendMode(Phaser.BlendModes.ADD);
    this.mistB = scene.add.image(WORLD_W / 2, H * 0.7, 'mist').setDisplaySize(WORLD_W * 1.4, 30)
      .setAlpha(0.1).setTint(0x8fa0e0).setBlendMode(Phaser.BlendModes.ADD);
    mist.add([this.mistA, this.mistB]);

    // ---- Forest silhouettes ---------------------------------------------------
    this.treeRow('treesFar', DEPTH.treesFar, 0.6, {
      baseY: H * 0.665, tex: 'smallTrees', frames: ['pine', 'pine', 'green1', 'green4', 'pine'],
      scale: 2, step: [9, 15], jitter: 5, color: COLORS.treeFar, rim: null, deep,
    });
    this.treeRow('treesMid', DEPTH.treesMid, 0.8, {
      baseY: H * 0.76, tex: 'bigTrees', frames: ['pine', 'green0', 'pine', 'green3', 'bare', 'green6'],
      scale: 2, step: [26, 40], jitter: 10, color: COLORS.treeMid, rim: COLORS.rim, deep,
    });

    // Near foreground: framing pines + forest floor where the button sits.
    const nearL = this.layer('treesNear', DEPTH.treesNear, 1);
    const floorY = H * 0.835;
    nearL.add(scene.add.rectangle(0, floorY, WORLD_W, deep, COLORS.treeNear).setOrigin(0));
    // A soft edge so the floor does not start with a hard line.
    for (let x = 0; x < WORLD_W; x += 4) {
      const h = 2 + Math.round(Math.abs(Math.sin(x * 0.11) * 4 + Math.sin(x * 0.037) * 3));
      nearL.add(scene.add.rectangle(x, floorY - h + 2, 4, h, COLORS.treeNear).setOrigin(0));
    }
    const framing = [
      { x: 12, y: H * 0.99, s: 4, f: 'pine' },
      { x: 52, y: H * 0.93, s: 3, f: 'pine' },
      { x: 330, y: H * 1.0, s: 4, f: 'pine' },
      { x: 296, y: H * 0.925, s: 3, f: 'green2' },
    ];
    framing.forEach(({ x, y, s, f }) => {
      const rim = scene.add.image(x + s, y - s, 'bigTrees', f).setOrigin(0.5, 1).setScale(s).setTintFill(0x141d44);
      const t = scene.add.image(x, y, 'bigTrees', f).setOrigin(0.5, 1).setScale(s).setTintFill(COLORS.treeNear);
      nearL.add([rim, t]);
      this.swayers.push({ objs: [rim, t], amp: 0.5, speed: rng.range(0.35, 0.55), phase: rng.range(0, 6) });
    });
    // Grass tufts silhouettes along the floor edge.
    for (let i = 0; i < 16; i++) {
      const x = rng.range(0, WORLD_W);
      const g = scene.add.image(x, floorY + rng.range(2, 8), 'grass', rng.pick(['tuft', 'tuftB', 'low']))
        .setOrigin(0.5, 1).setScale(2).setTintFill(0x0a0f26);
      nearL.add(g);
      this.swayers.push({ objs: [g], amp: 3, speed: rng.range(0.6, 1.1), phase: rng.range(0, 6) });
    }
  }

  treeRow(name, depth, sf, o) {
    const { scene, rng } = this;
    const c = this.layer(name, depth, sf);
    const fillTop = o.baseY - 6;
    c.add(scene.add.rectangle(0, fillTop, WORLD_W, o.deep, o.color).setOrigin(0));
    let x = -8;
    while (x < WORLD_W + 10) {
      const f = rng.pick(o.frames);
      const y = o.baseY + rng.range(-o.jitter, o.jitter * 0.4);
      const s = o.scale;
      if (o.rim !== null) {
        c.add(scene.add.image(x + s, y - s, o.tex, f).setOrigin(0.5, 1).setScale(s).setTintFill(o.rim));
      }
      const t = scene.add.image(x, y, o.tex, f).setOrigin(0.5, 1).setScale(s).setTintFill(o.color);
      c.add(t);
      x += rng.range(o.step[0], o.step[1]);
    }
  }

  /** All stars flare in a wave (left → right). */
  shimmer(duration = 900) {
    this.stars.forEach((s) => {
      const delay = (s.img.x / WORLD_W) * duration * 0.6;
      this.scene.tweens.add({
        targets: s, boost: 0.9, duration: duration * 0.35, delay, yoyo: true, ease: 'Sine.easeInOut',
      });
    });
  }

  update(dt) {
    this.time += dt / 1000;
    const t = this.time;
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      s.img.setAlpha(Phaser.Math.Clamp(s.base * (0.55 + 0.45 * tw) + s.boost, 0, 1));
    }
    for (const w of this.swayers) {
      const a = Math.sin(t * w.speed + w.phase) * w.amp;
      w.objs.forEach((o) => o.setAngle(a * 0.25));
    }
    if (this.mistA) {
      this.mistA.x = WORLD_W / 2 + Math.sin(t * 0.05) * 40;
      this.mistB.x = WORLD_W / 2 + Math.sin(t * 0.04 + 2) * 50;
    }
    // The destined star breathes gently, hinting that it is special.
    const d = this.destiny;
    if (d && !d.locked) {
      d.glow.setAlpha(0.35 + 0.15 * Math.sin(t * 1.3));
    }
  }
}
