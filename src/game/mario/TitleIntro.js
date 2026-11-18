import Phaser from 'phaser';
import { makeText } from '../utils/text.js';
import { FONT_TITLE } from '../config/theme.js';
import { WEDDING } from '../config/event.vi.js';
import { MARIO_TEXT as T } from '../config/mario.vi.js';
import { soundManager } from '../audio/SoundManager.js';

const ART = 2;
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ramp = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = Phaser.Math.Linear;

// Intro timeline after BẮT ĐẦU (ms). Total ≈ 2.1 s, skippable at any moment.
const TL = {
  thJump: 140, mJump: 260, transform: 320, thLand: 420, mLand: 560,
  crack: 650, brk: 930, thDown: 1720, mDown: 1800, end: 2080,
};

/**
 * PERSONALISED TITLE SCREEN + "BREAK THE START BUTTON" TRANSITION.
 *
 * The title world is a band of sky directly above the gameplay opening:
 * pastel sky, drifting clouds, distant mountains, rolling hills, two small
 * platforms (Minh left, Thủy right), a lower grassy ledge with a strolling
 * turtle. BẮT ĐẦU is a real DOM button placed in that world; when pressed it
 * shakes, both jump on it, it turns into bricks, cracks, breaks, and they fall
 * — the camera following — onto the first gameplay platform. Everything in the
 * transition is a pure function of the elapsed time, so BỎ QUA (skip) simply
 * jumps to the end state. After that, the scroll-driven game takes over.
 */
export class TitleIntro {
  constructor(scene, { guestName, landM, landT, groundY, reducedMotion, depth, onPress, onDone }) {
    this.scene = scene;
    this.groundY = groundY; // the first gameplay platform they land on
    this.landM = landM;
    this.landT = landT;
    this.reducedMotion = reducedMotion;
    this.D = depth;
    this.onPress = onPress;
    this.onDone = onDone;
    this.state = 'hidden'; // hidden → title → intro → done
    this.ui = document.getElementById('title-ui');
    this.qEl = document.getElementById('title-q');
    this.startBtn = document.getElementById('start-btn');
    this.quickBtn = document.getElementById('quick-btn');
    this.skipBtn = document.getElementById('skip-btn');
    this.qEl.textContent = guestName ? T.titleQuestion(guestName) : T.titleQuestionAnon;
    this.startBtn.textContent = T.startButton;
    this.startBtn.addEventListener('click', () => this.press());
    this.skipBtn.addEventListener('click', () => this.finish());
    this.build();
  }

  // ------------------------------------------------------------------ world objects
  build() {
    const s = this.scene;
    const D = this.D;
    const img = (k, d) => s.add.image(0, 0, k).setScale(ART).setDepth(d);
    const plat = (w, rows = 1) => ({
      w,
      body: s.add.tileSprite(0, 0, w / ART, rows * 16, 'brick').setOrigin(0, 0).setScale(ART).setDepth(D.ground),
      top: s.add.tileSprite(0, 0, w / ART, 6, 'grassTop').setOrigin(0, 0).setScale(ART).setDepth(D.ground + 1),
    });
    this.mountains = [
      img('hill', D.farHills).setOrigin(0.5, 1).setScale(ART * 3.6, ART * 6).setTint(0xb9d9cf),
      img('hill', D.farHills).setOrigin(0.5, 1).setScale(ART * 3, ART * 4.8).setTint(0xa3cbbb),
    ];
    this.hills = [
      img('hill', D.hills).setOrigin(0.5, 1).setScale(ART * 2.2, ART * 1.7).setTint(0x9fcf8c),
      img('hill', D.hills).setOrigin(0.5, 1).setScale(ART * 2.6, ART * 1.4).setTint(0x8fc07e),
    ];
    this.clouds = [['cloud', 0.9, 7], ['cloudSmall', 0.75, 11], ['cloud', 0.8, 5], ['cloudSmall', 1, 9]]
      .map(([k, a, sp]) => Object.assign(img(k, D.clouds + 4).setAlpha(a), { sp }));
    this.title = makeText(s, 180, 0, WEDDING.couple, {
      fontFamily: FONT_TITLE, fontSize: '62px', color: '#fff7e6', stroke: '#8c4430', strokeThickness: 10,
      shadow: { offsetX: 0, offsetY: 5, color: '#5e2419', blur: 0, fill: true, stroke: true },
    }).setOrigin(0.5).setDepth(D.board + 2);
    this.date = makeText(s, 180, 0, WEDDING.date, {
      fontFamily: FONT_TITLE, fontSize: '36px', color: '#ecc96a', stroke: '#5e2419', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(D.board + 2);
    s.texts.push(this.title, this.date);
    this.platL = plat(96);
    this.platR = plat(96);
    this.lowL = plat(120, 2);
    this.lowR = plat(120, 2);
    this.flowers = [img('flowers', D.front), img('flowers', D.front), img('flowers', D.front)].map((f) => f.setOrigin(0.5, 1));
    this.coins = [img('decoCoin', D.coins), img('decoCoin', D.coins), img('decoCoin', D.coins)];
    this.motes = Array.from({ length: 6 }, (_, i) => Object.assign(img('mote', D.fx).setAlpha(0.8), { ph: i * 1.7 }));
    this.tufts = s.add.graphics().setDepth(D.ground + 2);
    this.turtle = s.add.image(0, 0, 'turtle0').setOrigin(0.5, 1).setScale(ART).setDepth(D.chars - 1);
    // the START button's brick form (appears when it "transforms")
    this.brickPlat = s.add.tileSprite(0, 0, 66, 14, 'brick').setOrigin(0.5, 0).setScale(ART).setDepth(D.ground + 3).setVisible(false);
    this.cracks = s.add.graphics().setDepth(D.ground + 4);
    this.shards = s.add.graphics().setDepth(D.fx);
    this.fallFx = s.add.graphics().setDepth(D.chars - 1);
    this.all = [...this.mountains, ...this.hills, ...this.clouds, this.title, this.date,
      ...[this.platL, this.platR, this.lowL, this.lowR].flatMap((p) => [p.body, p.top]),
      ...this.flowers, ...this.coins, ...this.motes, this.tufts, this.turtle];
  }

  /** Lay the title screen out for the current screen (all in logical units from the top). */
  layout() {
    const l = this.scene.layout;
    const V = l.height;
    const k = l.cssToLogical;
    const top = -(V + 80); // the title band sits just above the gameplay opening
    const y = (f) => top + f;
    const t = {
      top,
      title: l.safe.top + Math.max(72, 0.13 * V),
    };
    // stack: title · date · guest line · BẮT ĐẦU · XEM THÔNG TIN THIỆP, spaced by
    // their real (measured) heights so long names that wrap never collide
    const h = (el, fallback) => (el.offsetHeight || fallback) * k;
    const qH = h(this.qEl, 34); const sH = h(this.startBtn, 54); const kH = h(this.quickBtn, 44);
    t.date = t.title + 54;
    t.q = t.date + 34 + qH / 2;
    t.start = t.q + qH / 2 + 16 + sH / 2;
    t.quick = t.start + sH / 2 + 10 + kH / 2;
    t.plat = t.quick + kH / 2 + 104; // Minh's and Thủy's little platforms, below the buttons
    t.low = Math.max(t.plat + 120, V - l.safe.bottom - 74);
    this.L = t;
    this.cam = top;
    this.title.setPosition(180, y(t.title));
    this.date.setPosition(180, y(t.date));
    this.mountains[0].setPosition(70, y(t.low + 8));
    this.mountains[1].setPosition(300, y(t.low + 8));
    this.hills[0].setPosition(40, y(t.low + 6));
    this.hills[1].setPosition(320, y(t.low + 6));
    const place = (p, x0, yy) => { p.body.setPosition(x0, yy + 6); p.top.setPosition(x0, yy); };
    place(this.platL, 0, y(t.plat));
    place(this.platR, 264, y(t.plat));
    place(this.lowL, 0, y(t.low));
    place(this.lowR, 240, y(t.low)); // a gap (120..240) for the fall
    this.flowers[0].setPosition(70, y(t.plat) + 1);
    this.flowers[1].setPosition(92, y(t.low) + 1);
    this.flowers[2].setPosition(300, y(t.low) + 1);
    this.coins.forEach((c, i) => { c.baseY = y(t.low) - 30 - (i % 2) * 14; c.setPosition([268, 300, 332][i], c.baseY); });
    this.clouds.forEach((c, i) => { c.baseX = [40, 250, 150, 320][i]; c.y = y([0.30, 0.38, 0.62, 0.70][i] * V); });
    this.motes.forEach((m, i) => { m.baseX = 30 + i * 58; m.y0 = y(t.low); });
    this.brickPlat.setPosition(180, y(t.start - 10));
    // DOM: guest question, BẮT ĐẦU, XEM THÔNG TIN THIỆP (css px from the frame top)
    const css = (v) => `${Math.round(v / k)}px`;
    this.qEl.style.top = css(t.q);
    this.startBtn.style.top = css(t.start);
    this.quickBtn.style.top = css(t.quick);
    if (this.state === 'title') this.placeHome();
  }

  placeHome() {
    const { minh, thuy } = this.scene;
    const yy = this.cam + this.L.plat;
    minh.setPosition(48, yy);
    thuy.setPosition(312, yy);
    [minh, thuy].forEach((c) => { c.sprite.setRotation(0).setScale(ART).setFlipY(false); c.prop.setVisible(false); c.emote.setVisible(false); });
  }

  // ------------------------------------------------------------------ title screen
  show() {
    this.state = 'title';
    this.ui.hidden = false; // visible first, so the layout can measure the DOM parts
    this.layout();
    this.placeHome();
    this.scene.cameras.main.scrollY = this.cam;
    this.startBtn.disabled = false;
    this.startBtn.focus({ preventScroll: true });
    this._keys = {};
  }

  /** Set a character's pose/anim only when it changes (so animations are not restarted). */
  act(c, key, fn) {
    if (this._keys[c.id] === key) return;
    this._keys[c.id] = key;
    fn();
  }

  /** Short looping idle routines (time-based; they never block anything). */
  idleLoops(time) {
    const { minh, thuy } = this.scene;
    const tm = (time / 1000) % 8;
    if (tm < 2.4) this.act(minh, 'idle', () => minh.idle('down'));
    else if (tm < 3.4) this.act(minh, 'watch', () => minh.pose('nod', 'down')); // glances at his watch
    else if (tm < 4.6) { // straightens his jacket
      const k = Math.floor((tm - 3.4) / 0.2) % 2 ? 'breath' : 'nod';
      this.act(minh, `adj-${k}`, () => minh.pose(k, 'down'));
    } else if (tm < 6) this.act(minh, 'look', () => minh.pose('stand', 'right')); // looks toward Thủy
    else this.act(minh, 'idle2', () => minh.idle('down'));
    const tt = (time / 1000 + 3.5) % 9;
    if (tt < 2) this.act(thuy, 'idle', () => thuy.idle('down'));
    else if (tt < 3.1) this.act(thuy, 'bouquet', () => thuy.pose('raise', 'down')); // fixes her bouquet
    else if (tt < 4.4) this.act(thuy, 'look', () => thuy.pose('stand', 'left')); // looks toward Minh
    else if (tt < 5.6) this.act(thuy, 'twirl', () => { if (!this.reducedMotion) thuy.playAction('expressive'); }); // a little twirl
    else this.act(thuy, 'idle2', () => thuy.idle('down'));
  }

  /** Scenery that keeps the title screen alive (subtle, cheap). */
  ambient(time) {
    if (this.state === 'done' || this.state === 'hidden') return;
    const t = this.reducedMotion ? 0 : time / 1000;
    // distant mountains drift more slowly than the nearer hills (horizontal parallax)
    this.mountains.forEach((m, i) => { m.x = (i ? 300 : 70) + Math.sin(t * 0.07 + i) * 4; });
    this.hills.forEach((h, i) => { h.x = (i ? 320 : 40) + Math.sin(t * 0.13 + i * 2) * 7; });
    this.clouds.forEach((c) => { c.x = ((c.baseX + c.sp * t + 60) % 480 + 480) % 480 - 60; });
    this.coins.forEach((c, i) => { c.scaleX = ART * Math.max(0.2, Math.abs(Math.cos(t * 2 + i))); c.y = c.baseY + Math.sin(t * 2.2 + i) * 2; });
    this.motes.forEach((m) => {
      const k = ((t * 0.12 + m.ph / 10) % 1);
      m.x = m.baseX + Math.sin(t + m.ph) * 8;
      m.y = m.y0 - k * 260;
      m.setAlpha(0.8 * Math.sin(k * Math.PI));
    });
    // grass tufts swaying on the platforms
    const g = this.tufts.clear();
    const tuft = (x, yy, i) => {
      const sway = Math.round(Math.sin(t * 2.4 + i) * 1.5);
      g.fillStyle(0x6f9a5c).fillRect(x, yy - 6, 2, 6).fillRect(x + 3 + sway, yy - 8, 2, 8).fillRect(x + 6, yy - 5, 2, 5);
    };
    [[14, this.L.plat], [230 + 50, this.L.plat], [20, this.L.low], [108, this.L.low], [256, this.L.low], [340, this.L.low]]
      .forEach(([x, yy], i) => tuft(x, this.cam + yy, i));
    // the turtle strolls back and forth on the lower-left ledge, at its own pace
    const ph = (t * 0.09) % 2;
    const u = ph < 1 ? ph : 2 - ph;
    this.turtle.setPosition(Math.round(16 + 84 * smooth(u)), this.cam + this.L.low + 1);
    this.turtle.setFlipX(ph >= 1);
    this.turtle.setTexture(Math.floor(t * 3) % 2 ? 'turtle1' : 'turtle0');
  }

  update(time) {
    this.ambient(time);
    if (this.state === 'title') this.idleLoops(time);
    else if (this.state === 'intro') this.step(time - this.t0);
  }

  // ------------------------------------------------------------------ the transition
  press() {
    if (this.state !== 'title') return; // START can never fire twice
    this.state = 'intro';
    this.startBtn.disabled = true;
    this.onPress?.();
    soundManager.sfx('bump');
    if (this.reducedMotion) { this.finish(); return; }
    this.startBtn.classList.add('is-shaking');
    this.quickBtn.classList.add('is-leaving');
    this.qEl.classList.add('is-leaving');
    this.skipBtn.hidden = false;
    this.t0 = this.scene.time.now;
    this.cues = [[TL.thJump, 'jump'], [TL.mJump, 'jump'], [TL.transform, 'coin'], [TL.crack, 'bump'], [TL.brk, 'pipe'], [TL.thDown, 'land'], [TL.mDown, 'land']];
    this.camEnd = this.scene.cameraTopAt0();
    this.step(0);
  }

  /** The whole transition as a pure function of elapsed time t (ms). */
  step(t) {
    const s = this.scene;
    const { minh, thuy } = s;
    const L = this.L;
    const y = (f) => this.cam + f;
    const yP = y(L.plat);
    const yB = y(L.start - 10); // top of the brick platform (where the button was)
    this.cues = this.cues.filter(([at, name]) => { if (t >= at) { soundManager.sfx(name); return false; } return true; });

    // the button: shakes, then turns into a small brick platform
    if (t >= TL.transform && !this.brickPlat.visible) {
      this.ui.classList.add('is-gone');
      this.brickPlat.setVisible(true).setScale(ART * 0.85);
    }
    if (this.brickPlat.visible && t < TL.brk) this.brickPlat.setScale(ART * lerp(0.85, 1, ramp(t, TL.transform, TL.transform + 140)));

    // cracks spread across it, then it breaks into pixel fragments
    this.cracks.clear();
    if (t >= TL.crack && t < TL.brk) {
      const n = Math.ceil(6 * ramp(t, TL.crack, TL.brk - 80));
      const pts = [[118, 0], [134, 10], [146, 4], [160, 18], [176, 8], [196, 20], [212, 6], [230, 14]];
      this.cracks.lineStyle(2, 0x3b2620);
      for (let i = 0; i < Math.min(n, pts.length - 1); i++) {
        this.cracks.lineBetween(pts[i][0], yB + 4 + pts[i][1], pts[i + 1][0], yB + 4 + pts[i + 1][1]);
      }
      this.brickPlat.x = 180 + (t > TL.brk - 160 ? Math.sin(t * 0.25) * 1.5 : 0); // trembles
    }
    this.shards.clear();
    if (t >= TL.brk) {
      this.brickPlat.setVisible(false);
      const u = (t - TL.brk) / 1000;
      for (let i = 0; i < 12; i++) {
        const x0 = 120 + i * 10; const vx = (i - 5.5) * 22; const vy = -60 - (i % 3) * 30;
        const px = x0 + vx * u; const py = yB + 10 + vy * u + 520 * u * u;
        const a = clamp01(1 - u / 0.9);
        if (a <= 0) continue;
        this.shards.fillStyle(i % 2 ? 0xb4523a : 0x8c4430, a).fillRect(Math.round(px), Math.round(py), 8, 6);
        this.shards.fillStyle(0xd27756, a).fillRect(Math.round(px), Math.round(py), 8, 2);
      }
    }

    // characters: look at the button → jump on → stand → (cracks) → fall → land
    const jump = (c, x0, x1, t0, t1, h) => {
      const u = ramp(t, t0, t1);
      c.setPosition(lerp(x0, x1, u), lerp(yP, yB, u) - 4 * h * u * (1 - u));
      return u;
    };
    const fall = (c, x0, x1, t0, t1) => {
      const u = ramp(t, t0, t1);
      c.setPosition(lerp(x0, x1, smooth(u)), lerp(yB, this.groundY, u * u));
      return u;
    };
    // Thủy
    if (t < TL.thJump) { this.act(thuy, 'i-look', () => thuy.pose('stand', 'left')); thuy.setPosition(312, yP); }
    else if (t < TL.thLand) { jump(thuy, 312, 198, TL.thJump, TL.thLand, 46); this.act(thuy, 'i-jump', () => thuy.pose('flare', 'left')); }
    else if (t < TL.brk) { thuy.setPosition(198, yB); this.act(thuy, t < TL.crack ? 'i-stand' : 'i-oops', () => thuy.pose(t < TL.crack ? 'stand' : 'nod', 'down')); }
    else if (t < TL.thDown) { fall(thuy, 198, this.landT, TL.brk, TL.thDown); this.act(thuy, 'i-fall', () => thuy.pose('flare', 'down')); }
    else { thuy.setPosition(this.landT, this.groundY); this.act(thuy, 'i-land', () => thuy.pose('stand', 'down')); }
    // Minh (a beat behind her)
    if (t < TL.mJump) { this.act(minh, 'i-look', () => minh.pose('stand', 'right')); minh.setPosition(48, yP); }
    else if (t < TL.mLand) { jump(minh, 48, 162, TL.mJump, TL.mLand, 40); this.act(minh, 'i-jump', () => minh.pose('offer', 'right')); }
    else if (t < TL.brk + 90) { minh.setPosition(162, yB); this.act(minh, t < TL.crack ? 'i-stand' : 'i-oops', () => minh.pose(t < TL.crack ? 'stand' : 'nod', 'down')); }
    else if (t < TL.mDown) { fall(minh, 162, this.landM, TL.brk + 90, TL.mDown); this.act(minh, 'i-fall', () => minh.pose('offer', 'down')); }
    else { minh.setPosition(this.landM, this.groundY); this.act(minh, 'i-land', () => minh.pose('stand', 'down')); }
    // "uh-oh" while it cracks
    const oops = t >= TL.crack + 120 && t < TL.brk;
    minh.emote.setTexture('emoteExcl').setVisible(oops).setPosition(minh.x, minh.y - 62);
    thuy.emote.setTexture('emoteExcl').setVisible(oops).setPosition(thuy.x, thuy.y - 62);
    // landing squash + dust
    [[thuy, TL.thDown], [minh, TL.mDown]].forEach(([c, at]) => {
      const q = t >= at ? 1 - ramp(t, at, at + 160) : 0;
      c.sprite.setScale(ART * (1 + 0.08 * q), ART * (1 - 0.12 * q));
      if (t >= at && !c._dusted) { c._dusted = true; s.burst(c.x, c.y - 2, 'dust', 5); }
    });
    // veil and jacket flutter while falling
    this.fallFx.clear();
    const tt = t / 1000;
    if (t >= TL.brk && t < TL.thDown) {
      for (let i = 0; i < 6; i++) {
        const kk = i / 5;
        const wx = thuy.x - 3 - 7 * kk + Math.sin(tt * 9 + i) * (1 + 3 * kk);
        this.fallFx.fillStyle(0xffffff, 0.9 - 0.1 * i).fillRect(Math.round(wx), Math.round(thuy.y - 80 - i * 6), 7 - i, 5);
      }
    }
    if (t >= TL.brk + 90 && t < TL.mDown) {
      [-1, 1].forEach((sx) => { for (let i = 0; i < 3; i++) this.fallFx.fillStyle(0x24232f).fillRect(Math.round(minh.x + sx * (12 + i * 2)) - 1, Math.round(minh.y - 36 - i * 3 - Math.abs(Math.sin(tt * 12 + i)) * 3), 3, 4); });
    }

    // camera: holds on the title, then follows them down to the first platform
    const cu = smooth(ramp(t, TL.brk + 60, TL.mDown + 120));
    s.cameras.main.scrollY = Math.round(lerp(this.cam, this.camEnd, cu) * s.cameras.main.zoom) / s.cameras.main.zoom;

    if (t >= TL.end) this.complete();
  }

  /** BỎ QUA (or reduced motion): jump straight to the end state. */
  finish() {
    if (this.state === 'done') return;
    if (this.state === 'title') { this.press(); if (this.state === 'done') return; }
    if (!this.camEnd) this.camEnd = this.scene.cameraTopAt0();
    this.cues = [];
    this.scene.minh._dusted = true; this.scene.thuy._dusted = true;
    this.ui.classList.add('is-gone');
    this.step(TL.end);
  }

  complete() {
    if (this.state === 'done') return;
    this.state = 'done';
    this.ui.hidden = true;
    this.skipBtn.hidden = true;
    this.cracks.clear(); this.shards.clear(); this.fallFx.clear();
    this.brickPlat.setVisible(false);
    [this.scene.minh, this.scene.thuy].forEach((c) => { c.sprite.setScale(ART); c.emote.setVisible(false); });
    this.onDone?.();
  }
}
