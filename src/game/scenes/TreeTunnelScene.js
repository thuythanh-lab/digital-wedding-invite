import Phaser from 'phaser';
import { COLORS } from '../config/theme.js';
import { STRINGS } from '../config/strings.vi.js';
import { StoryScene } from './StoryScene.js';
import { GuidingStar } from '../effects/GuidingStar.js';
import { NightLighting } from '../systems/NightLighting.js';
import { storyState } from '../systems/StoryState.js';
import { makeNoise } from '../effects/ForestGround.js';
import { MinhCharacter } from '../characters/MinhCharacter.js';
import { ThuyCharacter } from '../characters/ThuyCharacter.js';
import { loadCharacterSheets } from '../characters/characterAnimations.js';
import { SmallButton } from '../ui/SmallButton.js';
import { soundManager } from '../audio/SoundManager.js';
import { mulberry32 } from '../utils/rng.js';

const WW = 180;
const WH = 1000;
const SPLIT = 860;
const SLIDE_MS = 4600;

function centre(y) {
  return 90 + 24 * Math.sin(y * 0.0085) + 9 * Math.sin(y * 0.021 + 1);
}
/** Lane centre for the left (Minh) or right (Thủy) exit. */
function lane(y, side) {
  const base = centre(Math.min(y, SPLIT));
  if (y <= SPLIT) return base + side * 8;
  const t = Math.min(1, (y - SPLIT) / (WH - SPLIT));
  const target = side < 0 ? 42 : 138;
  return Phaser.Math.Linear(base + side * 8, target, Phaser.Math.Easing.Sine.InOut(t));
}

/** Earth walls, a packed-earth chute, roots and glowing veins. */
function paintTunnel(scene, key) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, WW, WH);
  const ctx = tex.getContext();
  const img = ctx.createImageData(WW, WH);
  const d = img.data;
  const n = makeNoise(41);
  const n2 = makeNoise(42);
  const rnd = mulberry32(43);
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const soil = ['#160f13', '#1d1418', '#26191d', '#2f1f22'].map(hex);
  const chute = ['#5a3f35', '#674a3d', '#755545', '#83604c'].map(hex);
  const rim = hex('#120b0f');
  const inChute = (x, y) => {
    const hw = (y > SPLIT ? 19 : 27 + 4 * Math.sin(y * 0.03));
    if (y <= SPLIT) return Math.abs(x - centre(y)) - hw;
    return Math.min(Math.abs(x - lane(y, -1)), Math.abs(x - lane(y, 1))) - hw;
  };
  for (let y = 0; y < WH; y++) {
    for (let x = 0; x < WW; x++) {
      const i = (y * WW + x) * 4;
      const dd = inChute(x, y) + (n2(x * 0.3, y * 0.3) - 0.5) * 5;
      let c;
      if (dd < -1) {
        const v = n(x * 0.12, y * 0.05);
        c = chute[Math.min(3, Math.floor(v * 4))];
      } else if (dd < 1.5) c = rim;
      else {
        const v = n(x * 0.09 + 30, y * 0.09);
        c = soil[Math.min(3, Math.floor(v * 4))];
        if (rnd() < 0.006) c = hex('#6b6060');
      }
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  // Roots crawling through the walls; a few glow softly.
  const glowPts = [];
  for (let r = 0; r < 46; r++) {
    let x = rnd() < 0.5 ? rnd() * 50 : WW - rnd() * 50;
    let y = rnd() * WH;
    const glow = rnd() < 0.3;
    const col = glow ? hex('#7fe0d6') : hex(rnd() < 0.5 ? '#4a2c22' : '#6b4430');
    let ang = (x < WW / 2 ? 0 : Math.PI) + (rnd() - 0.5) * 1.2;
    const len = 20 + rnd() * 40;
    for (let k = 0; k < len; k++) {
      x += Math.cos(ang);
      y += Math.sin(ang) * 0.6 + 0.3;
      ang += (rnd() - 0.5) * 0.5;
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi < 0 || xi >= WW || yi < 0 || yi >= WH) break;
      if (inChute(xi, yi) < -2) break;
      const i = (yi * WW + xi) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
      if (glow && k % 9 === 0) glowPts.push({ x: xi, y: yi });
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  tex.glowPts = glowPts;
}

/**
 * CHAPTER I · the secret tree tunnel (≈ 5 s). A playful slide underground;
 * skippable once it has been seen.
 */
export class TreeTunnelScene extends StoryScene {
  constructor() {
    super('TreeTunnel');
  }

  preload() {
    loadCharacterSheets(this);
  }

  create() {
    this.setupStage(WW, WH, { bg: '#120b0f', vignette: 1 });
    this.finished = false;
    paintTunnel(this, 'tunnel-bg');
    this.world.add(this.add.image(0, 0, 'tunnel-bg').setOrigin(0).setDepth(0));

    const rnd = mulberry32(77);
    this.light = new NightLighting(this, this.world, WW, WH, { ambient: 0x5a4f7c });
    (this.textures.get('tunnel-bg').glowPts || []).forEach((p) => {
      this.light.add({ x: p.x, y: p.y, radius: 8, color: 0x7fe0d6, intensity: 0.45, flicker: 0.5 });
    });
    // Glowing mushrooms and hanging roots along the walls.
    for (let y = 60; y < WH - 80; y += 46 + rnd() * 30) {
      const side = rnd() < 0.5 ? -1 : 1;
      const x = centre(y) + side * (30 + rnd() * 6);
      const m = this.add.image(x, y, 'mushrooms', rnd() < 0.5 ? 'cluster' : 'few').setOrigin(0.5, 1)
        .setFlipX(side > 0).setDepth(10);
      this.world.add(m);
      this.light.add({ x, y: y - 4, radius: 14, color: COLORS.mushroomLight, intensity: 0.7, flicker: 0.4 });
      if (rnd() < 0.6) {
        const r = this.add.image(centre(y + 20) - side * (28 + rnd() * 4), y + 20, 'logs', 'tallV')
          .setOrigin(0.5, 0).setTint(0x6b4a3a).setDepth(9).setAngle(side * 8);
        this.world.add(r);
      }
    }
    // The two exits glow with moonlight.
    [-1, 1].forEach((side) => {
      const x = lane(WH - 10, side);
      this.light.add({ x, y: WH - 6, radius: 46, color: COLORS.moonlight, intensity: 1 });
      this.world.add(this.add.image(x, WH - 2, 'glow').setScale(0.5).setTint(0xb8c8ff).setAlpha(0.5)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(20));
    });

    // Cast: tumbling gently, the star lighting the way ahead.
    this.minh = new MinhCharacter(this, { x: lane(0, -1), y: 10, facing: 'down', layer: this.world, depthBase: 100, shadow: false });
    this.thuy = new ThuyCharacter(this, { x: lane(0, 1), y: 6, facing: 'down', variant: '-bq', layer: this.world, depthBase: 100, shadow: false });
    this.minh.pose('wave', 'down');
    this.thuy.pose('flare', 'down');
    this.star = new GuidingStar(this, centre(60), 60, { unit: 1, depth: 5200, glowScale: 0.3, layer: this.world });
    this.star.mode = 'orb';
    this.star.setTrailRate(40);
    this.starLight = this.light.add({ x: 90, y: 60, radius: 70, color: COLORS.starLight, intensity: 1 });
    this.dust = this.add.particles(0, 0, 'dot3', {
      lifespan: 600, speedY: { min: -30, max: -10 }, speedX: { min: -12, max: 12 }, scale: { start: 0.6, end: 0 },
      alpha: { start: 0.7, end: 0 }, tint: [0x8a6a55, 0x6b5040], frequency: 60, emitting: false,
    }).setDepth(150);
    this.world.add(this.dust);

    this.p = 0;
    this.director.anchorY = 0.4;
    this.director.lookAt(90, 30);

    if (storyState.seen('tunnel')) {
      const L = this.L;
      this.skip = new SmallButton(this, L.safe.left + 58, L.safe.top + 34, 96, 46, `${STRINGS.chapter1.skip} ›`, () => this.finish(true));
      this.ui.add(this.skip);
      this.uiTexts.push(this.skip.label);
    }
    this.play();
  }

  async play() {
    const s = this.script;
    soundManager.duckMusic(0.32, 500);
    this.cover.setAlpha(0);
    this.irisWipe(lane(10, 0) || 90, 20, false, 450);
    soundManager.synth('whoosh', { volume: 0.55, duration: SLIDE_MS / 1000 });
    this.dust.start();
    await s.tween({ targets: this, p: 1, duration: SLIDE_MS, ease: 'Quad.easeIn' });
    this.finish(false);
  }

  async finish(skipped) {
    if (this.finished) return;
    this.finished = true;
    storyState.markSeen('tunnel');
    if (this.skip) this.skip.disableInteractive();
    soundManager.duckMusic(0.5, 900);
    await this.fadeOut(skipped ? 300 : 450, 0x0b1020);
    this.scene.start('Clearing', { fromTunnel: true });
  }

  update(time, dt) {
    const t = time / 1000;
    const e = this.p;
    const y = 10 + e * (WH - 40);
    const yT = y - 4;
    this.minh.setPosition(lane(y, -1), y);
    this.thuy.setPosition(lane(yT, 1), yT);
    // Gentle tumbling.
    this.minh.sprite.setAngle(Math.sin(t * 7.5) * 24);
    this.thuy.sprite.setAngle(Math.sin(t * 7.5 + 1.6) * 20);
    const sy = Math.min(WH - 20, y + 46);
    this.star.setPosition(centre(Math.min(sy, SPLIT)), sy);
    this.star.update(dt);
    this.starLight.x = this.star.core.x;
    this.starLight.y = this.star.core.y;
    this.dust.setPosition(this.minh.x + 6, this.minh.y - 6);
    this.director.focus.x = Phaser.Math.Linear(this.director.focus.x, (this.minh.x + this.thuy.x) / 2, 0.15);
    this.director.focus.y = Phaser.Math.Linear(this.director.focus.y, y + 30, 0.25);
    this.director.apply();
  }
}
