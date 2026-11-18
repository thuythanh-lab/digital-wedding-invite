import Phaser from 'phaser';
import { COLORS } from '../config/theme.js';
import { NightSky } from '../effects/NightSky.js';
import { GuidingStar } from '../effects/GuidingStar.js';
import { soundManager } from '../audio/SoundManager.js';
import { viewport, fitCamera, WORLD_W } from '../utils/viewport.js';
import { makeRng } from '../utils/rng.js';

const FALL_MS = 4800;

/**
 * SCENE — The falling star (beats 4–10).
 * Starts on a pixel-identical copy of the title sky. The star drops almost
 * straight down; the camera tracks it while every layer scrolls at its own
 * parallax rate. Clouds rush past, the treeline rises, the canopy closes in,
 * and we slip into the leaves — then ForestScene continues the shot.
 */
export class FallingStarScene extends Phaser.Scene {
  constructor() {
    super('FallingStar');
  }

  init(data) {
    this.startData = data || {};
  }

  create() {
    const L = viewport.layout;
    const H = L.height;
    this.H = H;
    const cam = this.cameras.main;
    fitCamera(cam, L);
    cam.setBackgroundColor('#04071a');
    const rng = makeRng(77);

    this.sky = new NightSky(this, H);
    // Our own star replaces the one painted in the sky.
    this.sky.destiny.img.setVisible(false);
    this.sky.destiny.glow.setVisible(false);
    this.sky.shimmerDone = true;

    const x0 = this.startData.starX ?? this.sky.destiny.x;
    const y0 = this.startData.starY ?? this.sky.destiny.y;
    this.star = new GuidingStar(this, x0, y0, {
      unit: 2, depth: 55, glowScale: this.startData.glowScale ?? 0.55, coreKey: 'sparkle',
    });
    this.star.core.setScale(3);
    this.star.setTrailRate(0);

    // How far the camera descends, and where the star ends up.
    this.fallDepth = H * 2.5;
    const x1 = WORLD_W / 2;
    const y1 = this.fallDepth + H * 0.5;

    // ---- Clouds rushing past (scroll factor > 1 = closer than the trees) ----
    // Each cloud reaches the top of the screen when the camera has dropped
    // `dTop`; it starts below the screen, so the hand-off frame is untouched.
    for (let i = 0; i < 9; i++) {
      const sf = rng.range(2.0, 3.0);
      const dTop = H * rng.range(0.45, 1.25);
      const front = i % 2 === 0;
      this.add.image(rng.range(-30, WORLD_W + 30), sf * dTop, `cloud${i % 3}`)
        .setScale(rng.range(5, 7)).setScrollFactor(1, sf)
        .setTint(front ? 0xb8c4ff : 0x8f9de0)
        .setAlpha(front ? 0.4 : 0.65).setDepth(front ? 70 : 46)
        .setFlipX(rng.chance(0.5));
    }

    // ---- The canopy, seen as we drop into it --------------------------------
    // A deep forest colour rises from below the treeline.
    const floor = this.add.rectangle(0, H * 1.12, WORLD_W, H * 6, 0x08121c).setOrigin(0).setDepth(42);
    const fade = this.add.image(WORLD_W / 2, H * 1.12, 'beam').setOrigin(0.5, 1).setFlipY(true)
      .setDisplaySize(WORLD_W * 1.6, H * 0.35).setTint(0x08121c).setDepth(42);
    void floor; void fade;

    const crownFrames = ['green0', 'green1', 'green3', 'green4', 'green6', 'pine'];
    const crowns = [];
    const N = 34;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const y = Phaser.Math.Linear(H * 1.25, y1 + H * 0.4, t) + rng.range(-24, 24);
      const s = Phaser.Math.Linear(3, 8, t) * rng.range(0.85, 1.15);
      // Late crowns may sit right on the star's path: it punches through them.
      const onPath = t > 0.4 && i % 4 === 0;
      const x = onPath ? WORLD_W / 2 + rng.range(-30, 30)
        : WORLD_W / 2 + (i % 2 === 0 ? -1 : 1) * rng.range(40, 180);
      const front = onPath || (t > 0.4 && rng.chance(0.4));
      const crown = this.add.image(x, y, 'bigTrees', rng.pick(crownFrames))
        .setScale(s).setOrigin(0.5, 0.65)
        .setTint(front ? 0x22374f : 0x35526f)
        .setAlpha(onPath ? 0.92 : 1)
        .setDepth(front ? 65 : 50)
        .setFlipX(rng.chance(0.5));
      crowns.push(crown);
    }
    this.crowns = crowns;

    // Final closing leaves in front of everything.
    this.closers = [];
    [[-40, 0.95], [WORLD_W + 40, 1.05], [WORLD_W / 2, 1.35]].forEach(([x, k], i) => {
      const c = this.add.image(x, y1 + H * 0.2 * k, 'bigTrees', i === 2 ? 'green4' : 'green1')
        .setScale(12).setTint(0x101c2a).setDepth(80).setOrigin(0.5, 0.6);
      this.closers.push(c);
    });

    // Leaves torn loose as the star breaks through.
    this.leaves = this.add.particles(0, 0, 'leaf', {
      lifespan: { min: 1200, max: 2200 },
      speedX: { min: -40, max: 40 },
      speedY: { min: -70, max: -20 },
      gravityY: 40,
      rotate: { min: 0, max: 360 },
      scale: { min: 2, max: 3 },
      tint: [0x3e6a52, 0x587f5a, 0x2f5048],
      alpha: { start: 1, end: 0 },
      emitting: false,
    }).setDepth(66);

    // Darkness of the canopy (screen-space) for the hand-off.
    this.cover = this.add.rectangle(0, 0, WORLD_W, H + 2, COLORS.canopy).setOrigin(0)
      .setScrollFactor(0).setDepth(200).setAlpha(0);

    // ---- Timeline -------------------------------------------------------------
    this.p = 0;
    this.camY = 0;
    this.leafBurst = false;
    soundManager.synth('whoosh', { volume: 0.5, duration: FALL_MS / 1000 });

    // A short anticipation: the star quivers, morphs into its true shape, then drops.
    this.tweens.add({ targets: this.star.core, angle: { from: -12, to: 12 }, duration: 90, yoyo: true, repeat: 2 });
    this.time.delayedCall(260, () => {
      this.star.core.setTexture('star-core').setScale(2.2).setAngle(0);
      this.star.setTrailRate(30);
    });

    this.tweens.add({
      targets: this,
      p: 1,
      duration: FALL_MS,
      delay: 280,
      ease: 'Quad.easeInOut',
      onUpdate: () => {
        const p = this.p;
        // Mostly vertical, with a slight graceful drift to the centre.
        const x = Phaser.Math.Linear(x0, x1, p) + Math.sin(p * Math.PI) * 18;
        const y = Phaser.Math.Linear(y0, y1, p);
        this.star.setPosition(x, y);
      },
      onComplete: () => this.handOff(),
    });

    this.onLayout = (l) => fitCamera(this.cameras.main, l);
    viewport.on('change', this.onLayout);
    this.events.once('shutdown', () => {
      viewport.off('change', this.onLayout);
      this.star.destroy();
    });
  }

  handOff() {
    if (this.handedOff) return;
    this.handedOff = true;
    this.scene.start('Forest', { fromFall: true });
  }

  update(time, dt) {
    const H = this.H;
    this.sky.update(dt);
    this.star.update(dt);

    // Camera tracking: keep the star a little above centre once it passes it.
    const target = Phaser.Math.Clamp(this.star.y - H * 0.45, 0, this.fallDepth);
    const k = 1 - Math.exp(-dt / 1000 * 6);
    this.camY += (target - this.camY) * k;
    this.cameras.main.scrollY = this.camY;

    const p = this.p;
    if (p > 0.62 && !this.leafBurst) {
      this.leafBurst = true;
      this.leaves.setPosition(this.star.x, this.star.y);
      this.leaves.explode(18);
    }
    if (p > 0.62) this.leaves.setPosition(this.star.x, this.star.y);

    // The canopy closes in: the closers slide toward the centre.
    if (p > 0.7) {
      const q = (p - 0.7) / 0.3;
      const e = Phaser.Math.Easing.Sine.InOut(q);
      this.closers[0].x = Phaser.Math.Linear(-120, 60, e);
      this.closers[1].x = Phaser.Math.Linear(WORLD_W + 120, WORLD_W - 60, e);
    } else {
      this.closers[0].x = -120;
      this.closers[1].x = WORLD_W + 120;
    }
    // Slip into darkness for the last moments.
    this.cover.setAlpha(Phaser.Math.Clamp((p - 0.84) / 0.16, 0, 1));
    // The glow tightens as we enter the leaves.
    this.star.brightness = 1 + Math.max(0, p - 0.6) * 0.8;
  }
}
