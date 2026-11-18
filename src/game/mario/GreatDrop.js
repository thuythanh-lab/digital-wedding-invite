import Phaser from 'phaser';

/**
 * THE GREAT DROP — one continuous vertical world the couple falls through:
 *
 *   1 open sky   → 2 forest canopy → 3 root tunnel → 4 cave exit → 5 garden
 *
 * Everything here is a pure function of the camera / character positions,
 * which themselves come from the scroll progress. Nothing runs on timers, so
 * stopping, reversing or jumping the scroll always shows a valid frame.
 *
 * Parallax is applied manually: an element with factor f sits exactly at its
 * world y when the camera reference passes it, and drifts by (1 - f) × offset
 * otherwise (f < 1 background, f > 1 foreground that whips past).
 */

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ramp = (v, a, b) => clamp01((v - a) / (b - a));
const snap = (v) => Math.round(v / 2) * 2;
const mixColor = (c1, c2, t) => {
  const a = Phaser.Display.Color.IntegerToColor(c1);
  const b = Phaser.Display.Color.IntegerToColor(c2);
  return Phaser.Display.Color.GetColor(
    Math.round(lerp(a.red, b.red, t)), Math.round(lerp(a.green, b.green, t)), Math.round(lerp(a.blue, b.blue, t)));
};

export class GreatDrop {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} G  geometry: top (platform y), x0,y0 (fall start), x1,y1 (landing),
   *                    canopy (canopy top), floor (forest floor), shaft (cave mouth y), depth (DEPTH map)
   */
  constructor(scene, G) {
    this.s = scene;
    this.G = G;
    this.D = G.depth;
    this.par = []; // { o, y, f }
    this.rng = new Phaser.Math.RandomDataGenerator(['great-drop']);
    this.buildSky();
    this.buildCanopy();
    this.buildTunnel();
    this.buildExitAndGarden();
    this.buildLighting();
    this.buildParticles();
  }

  /** x of the fall line at height y (the drop is a straight eased line). */
  colX(y) {
    const { x0, y0, x1, y1 } = this.G;
    return lerp(x0, x1, clamp01((y - y0) / (y1 - y0)));
  }

  addPar(o, f) { this.par.push({ o, y: o.y, f }); return o; }

  // --------------------------------------------------------------- 1 OPEN SKY
  buildSky() {
    const { s, G, D } = this;
    // distant hills that rise slowly into view (far background)
    [[60, 0xcfe7ef, 3.2], [250, 0xc3e0ea, 3.6], [360, 0xd6ebf2, 2.6]].forEach(([x, tint, sc], i) => {
      const h = s.add.image(x, G.canopy + 150 + i * 20, 'hill').setOrigin(0.5, 1).setScale(2 * sc, 2 * sc * 0.8)
        .setTint(tint).setDepth(D.farHills);
      this.addPar(h, 0.55);
    });
    const skyH = G.canopy - G.top;
    // light haze strips
    [0.5, 0.75, 0.95].forEach((f, i) => {
      const r = s.add.rectangle(0, G.top + skyH * f, 360, 6 + i * 4, 0xffffff, 0.16).setOrigin(0, 0).setDepth(D.farHills + 1);
      this.addPar(r, 0.8);
    });
    // clouds around the fall line: some behind, two in front
    const nClouds = Math.max(4, Math.round(skyH / 42));
    for (let i = 0; i < nClouds; i++) {
      const y = G.top + 80 + (i * (skyH - 60)) / nClouds;
      const front = i === 2 || i === nClouds - 2;
      const side = i % 2 ? 1 : -1;
      const x = this.colX(y) + side * this.rng.between(70, 130);
      const c = s.add.image(x, y, i % 3 ? 'cloud' : 'cloudSmall').setScale(2)
        .setDepth(front ? D.fx + 3 : D.clouds + 1).setAlpha(front ? 0.85 : 1);
      this.addPar(c, front ? 1.35 : 0.7);
    }
    // a few distant birds
    this.birds = [0, 1, 2].map((i) => this.addPar(s.add.image(150 + i * 70, G.top + skyH * (0.45 + i * 0.15), 'bird0')
      .setScale(2).setDepth(D.birds), 0.6));
  }

  // --------------------------------------------------------------- 2 FOREST CANOPY
  buildCanopy() {
    const { s, G, D } = this;
    // a soft forest-haze band behind the trees (stepped top edge, no gradient)
    const hz = s.add.graphics().setDepth(D.sky + 1);
    const top = G.canopy - 40;
    for (let k = 0; k < 6; k++) {
      hz.fillStyle(mixColor(0xa9d9ea, 0xb3dcd2, (k + 1) / 6));
      for (let x = (k % 2) * 4; x < 360; x += 8) hz.fillRect(x, top + k * 4, 4, 4);
    }
    hz.fillStyle(0xb3dcd2).fillRect(0, top + 24, 360, G.floor - top - 24);

    const g = s.add.graphics().setDepth(D.deco);
    const crown = (cx, cy, r, shade = 0) => {
      const base = [0x8fb07e, 0x7fa06f, 0x9cbd8a][shade];
      g.fillStyle(0x3f5d3f);
      for (let a = 0; a < 3; a++) g.fillCircle(snap(cx + (a - 1) * r * 0.55), snap(cy + (a % 2) * r * 0.2), snap(r * 0.62 + 2));
      g.fillStyle(base);
      for (let a = 0; a < 3; a++) g.fillCircle(snap(cx + (a - 1) * r * 0.55), snap(cy + (a % 2) * r * 0.2), snap(r * 0.62));
      g.fillStyle(0xb9d3a4).fillCircle(snap(cx - r * 0.3), snap(cy - r * 0.25), snap(r * 0.28));
      for (let k = 0; k < 6; k++) {
        const fx = cx + this.rng.between(-r, r) * 0.8; const fy = cy + this.rng.between(-r, r) * 0.4;
        g.fillStyle(k % 2 ? 0xe7a29a : 0xf8f0dd).fillRect(snap(fx), snap(fy), 4, 4);
      }
    };
    const trunk = (x, y0, w) => {
      g.fillStyle(0x6b4529).fillRect(snap(x - w / 2), snap(y0), snap(w), snap(G.floor - y0 + 6));
      g.fillStyle(0x9a6a43).fillRect(snap(x - w / 2), snap(y0), 4, snap(G.floor - y0 + 6));
      g.fillStyle(0x4a2f1e).fillRect(snap(x + w / 2 - 4), snap(y0), 4, snap(G.floor - y0 + 6));
    };
    // tall trees on the right (the fall line hugs the left), small ones on the left
    const trees = [[176, G.canopy + 70, 58, 0, 18], [262, G.canopy + 20, 70, 1, 22], [342, G.canopy + 120, 56, 2, 18],
      [8, G.canopy + 190, 40, 1, 14]];
    trees.forEach(([x, y, r, sh, w]) => trunk(x, y + r * 0.4, w));
    // a branch reaching towards the fall line, with leaves
    const by = G.canopy + Math.round((G.floor - G.canopy) * 0.62);
    g.fillStyle(0x6b4529).fillRect(snap(this.colX(by) + 34), snap(by), snap(176 - this.colX(by) - 34), 6);
    trees.forEach(([x, y, r, sh]) => crown(x, y, r, sh));
    crown(this.colX(by) + 44, by - 6, 16, 2);
    // hanging vines from the crowns
    [[140, G.canopy + 100], [210, G.canopy + 110], [300, G.canopy + 170], [30, G.canopy + 220]].forEach(([x, y]) => {
      const len = this.rng.between(30, 70);
      g.fillStyle(0x5d7f55).fillRect(x, y, 2, len);
      for (let k = 6; k < len; k += 10) g.fillStyle(0x8fb07e).fillRect(x - 2, y + k, 6, 2);
      g.fillStyle(0xe7a29a).fillRect(x - 2, y + len, 6, 4);
    });
    // soft sunbeams through the gaps (slanted translucent bands)
    const beams = s.add.graphics().setDepth(D.deco + 1);
    [[200, 0.1], [290, 0.08], [120, 0.07]].forEach(([x, a]) => {
      beams.fillStyle(0xfffbe0, a).fillTriangle(x, G.canopy - 20, x + 28, G.canopy - 20, x - 60, G.floor);
    });
    // foreground foliage the couple briefly passes behind (whips past quickly)
    const canH = G.floor - G.canopy;
    this.fgLeaves = [G.canopy + canH * 0.38, G.canopy + canH * 0.82].map((y, i) => {
      const fg = s.add.graphics().setDepth(D.fx + 4);
      const bl = (x, yy, rr, col) => fg.fillStyle(col).fillCircle(x, yy, rr);
      bl(-22, 0, 22, 0x5d7f55); bl(14, -4, 26, 0x5d7f55); bl(40, 6, 18, 0x5d7f55);
      bl(-20, -2, 18, 0x7fa06f); bl(14, -8, 20, 0x7fa06f); bl(40, 2, 14, 0x7fa06f);
      bl(6, -14, 8, 0xb9d3a4);
      fg.setPosition(snap(this.colX(y) + (i ? 10 : -8)), y);
      return this.addPar(fg, 1.25);
    });
    // forest floor around the opening (grass + small details)
    const xL = this.wallX(G.floor).l; const xR = this.wallX(G.floor).r;
    s.add.tileSprite(0, G.floor, xL / 2, 6, 'grassTop').setOrigin(0, 0).setScale(2).setDepth(D.ground + 1);
    s.add.tileSprite(xR, G.floor, (360 - xR) / 2, 6, 'grassTop').setOrigin(0, 0).setScale(2).setDepth(D.ground + 1);
    s.add.image(300, G.floor + 1, 'bush').setOrigin(0.5, 1).setScale(2).setDepth(D.deco);
    s.add.image(232, G.floor + 1, 'flowers').setOrigin(0.5, 1).setScale(2).setDepth(D.deco);
  }

  // --------------------------------------------------------------- 3 ROOT TUNNEL
  /** Inner edges of the tunnel walls at height y (narrows, then opens at the mouth). */
  wallX(y) {
    const { G } = this;
    const f = ramp(y, G.floor, G.shaft);
    const c = this.colX(y);
    const half = lerp(86, 56, f);
    const wob = Math.sin(y * 0.045) * 6 + Math.sin(y * 0.11) * 3;
    return { l: snap(c - half + wob), r: snap(c + half + wob * 0.6) };
  }

  buildTunnel() {
    const { s, G, D } = this;
    const g = s.add.graphics().setDepth(D.earth);
    const back = s.add.graphics().setDepth(D.clouds + 3); // above the sky clouds, below everything else
    for (let y = G.floor + 6; y < G.shaft; y += 8) {
      const { l, r } = this.wallX(y);
      const f = ramp(y, G.floor, G.shaft);
      // back wall: cool and dark in the middle, warming near the cave mouth
      const warm = ramp(y, G.shaft - 140, G.shaft);
      const backCol = warm > 0 ? mixColor(0x2e2836, 0x8a6448, warm) : mixColor(0x5a4238, 0x2e2836, ramp(f, 0, 0.6));
      back.fillStyle(backCol).fillRect(l, y, r - l, 8);
      // walls
      g.fillStyle(0x6e3c29).fillRect(0, y, l, 8).fillRect(r, y, 360 - r, 8);
      g.fillStyle(0x8a4f36).fillRect(l - 4, y, 4, 8).fillRect(r, y, 4, 8); // lit inner edge
    }
    // stones, bricks, roots and glowing mushrooms on the walls
    const d = s.add.graphics().setDepth(D.earth + 1);
    for (let i = 0; i < 26; i++) {
      const y = snap(this.rng.between(G.floor + 30, G.shaft - 30));
      const { l, r } = this.wallX(y);
      const left = i % 2 === 0;
      const x = left ? snap(this.rng.between(6, Math.max(8, l - 24))) : snap(this.rng.between(r + 12, 340));
      d.fillStyle(0xb39a86).fillRect(x, y, 10 + (i % 3) * 4, 6);
      d.fillStyle(0xd2bfae).fillRect(x, y, 4, 2);
    }
    const tH = G.shaft - G.floor;
    const at = (f) => snap(G.floor + tH * f);
    [[at(0.4), true], [at(0.72), false]].forEach(([y, left]) => { // old brick structures
      const { l, r } = this.wallX(y);
      const x0 = left ? l - 40 : r + 6;
      s.add.tileSprite(snap(x0), snap(y), 16, 16, 'brick').setOrigin(0, 0).setScale(2).setDepth(D.earth + 1);
    });
    const nRoots = Math.max(4, Math.floor((tH - 30) / 42));
    for (let i = 0; i < nRoots; i++) { // roots dangling from the walls into the shaft
      const y = snap(G.floor + 10 + i * 42);
      const { l, r } = this.wallX(y);
      const left = i % 2 === 0;
      const len = 14 + (i % 3) * 10;
      d.fillStyle(0x5a4030);
      for (let k = 0; k < len; k += 2) d.fillRect(left ? l + k : r - k - 2, y + Math.round(Math.sin(k * 0.4) * 3) + k * 0.4, 2, 2);
    }
    this.shrooms = [];
    [[at(0.22), true], [at(0.48), false], [at(0.7), true], [at(0.88), false]].forEach(([y, left]) => {
      const { l, r } = this.wallX(y);
      const x = left ? l - 2 : r + 2;
      d.fillStyle(0x7d5a44).fillRect(snap(left ? l - 16 : r), snap(y + 6), 16, 4); // a little ledge
      const glow = s.add.image(x + (left ? -6 : 6), y, 'glow').setScale(3).setDepth(D.earth + 2).setBlendMode(Phaser.BlendModes.ADD);
      const m = s.add.image(x + (left ? -8 : 8), y + 6, 'shroom').setOrigin(0.5, 1).setScale(2).setDepth(D.earth + 3);
      this.shrooms.push({ glow, m });
    });
    // foreground rock lumps on the wall edges (pass faster than the walls)
    [[at(0.3), true], [at(0.58), false], [at(0.82), true]].forEach(([y, left]) => {
      const { l, r } = this.wallX(y);
      const rock = s.add.graphics().setDepth(D.fx + 4);
      const x = left ? l - 30 : r - 6;
      rock.fillStyle(0x4a2b1e).fillRect(0, 0, 36, 20).fillRect(6, -6, 22, 6);
      rock.fillStyle(0x6e3c29).fillRect(4, 2, 26, 12);
      rock.setPosition(snap(x), snap(y));
      this.addPar(rock, 1.18);
    });
    // grass lip and hanging roots where the forest floor meets the shaft
    const lip = s.add.graphics().setDepth(D.earth + 2);
    const { l: l0, r: r0 } = this.wallX(G.floor + 6);
    lip.fillStyle(0x5d7f55).fillRect(l0 - 10, G.floor + 6, 10, 6).fillRect(r0, G.floor + 6, 10, 6);
  }

  // --------------------------------------------------------------- 4 CAVE EXIT + 5 GARDEN
  buildExitAndGarden() {
    const { s, G, D } = this;
    const g = s.add.graphics().setDepth(D.earth + 2);
    // mossy, stepped underside of the walls around the mouth
    for (let x = 0; x < 360; x += 8) {
      const { l, r } = this.wallX(G.shaft - 4);
      if (x >= l && x < r) continue;
      const h = 6 + ((x * 7) % 5) * 2;
      g.fillStyle(0x6e3c29).fillRect(x, G.shaft, 8, h);
      g.fillStyle(0x5d7f55).fillRect(x, G.shaft + h - 2, 8, 2);
      g.fillStyle(0x8fb07e).fillRect(x + 2, G.shaft - 2, 4, 2);
    }
    // moss on the mouth edges + hanging vines into the garden air
    const { l, r } = this.wallX(G.shaft - 4);
    g.fillStyle(0x8fb07e).fillRect(l - 8, G.shaft - 40, 6, 40).fillRect(r + 2, G.shaft - 40, 6, 40);
    [l - 30, l - 70, r + 24, r + 60, 20, 330].forEach((x, i) => {
      const len = 30 + (i % 3) * 18;
      g.fillStyle(0x5d7f55).fillRect(snap(x), G.shaft + 8, 2, len);
      for (let k = 8; k < len; k += 10) g.fillStyle(0x8fb07e).fillRect(snap(x) - 2, G.shaft + 8 + k, 6, 2);
      if (i % 2) g.fillStyle(0xf8f0dd).fillRect(snap(x) - 2, G.shaft + 8 + len, 6, 4);
    });
    // golden light rising into the shaft from the garden (no flash, just soft rays)
    const rays = s.add.graphics().setDepth(D.clouds + 4);
    [[-10, 0.16], [14, 0.12], [34, 0.1]].forEach(([dx, a]) => {
      rays.fillStyle(0xffdc8a, a).fillTriangle(l + 10 + dx, G.shaft, r - 10 + dx, G.shaft, (l + r) / 2 + dx, G.shaft - 150);
    });
    // garden: sun, warm hills, flowers along the landing floor
    const sun = s.add.graphics().setDepth(D.farHills);
    sun.fillStyle(0xfff1c4).fillCircle(0, 0, 26);
    sun.fillStyle(0xffe08a).fillCircle(0, 0, 20);
    sun.setPosition(296, G.shaft + 90);
    this.addPar(sun, 0.5);
    [[70, 1.4], [230, 1.8], [350, 1.2]].forEach(([x, sc], i) => {
      const h = s.add.image(x, G.y1 + 4, 'hillWarm').setOrigin(0.5, 1).setScale(2 * sc, 2 * sc * 0.9)
        .setTint(i === 1 ? 0xf0c79a : 0xf3d3ad).setDepth(D.farHills + 2);
      this.addPar(h, 0.75);
    });
  }

  // --------------------------------------------------------------- lighting + particles
  buildLighting() {
    const { s, D } = this;
    // Screen-space tints placed BELOW the characters: the world darkens and
    // cools in the tunnel, warms at the mouth, while Minh & Thủy stay readable.
    this.cool = s.add.rectangle(0, 0, 360, 2000, 0x1e2a48, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(D.chars - 5);
    this.warm = s.add.rectangle(0, 0, 360, 2000, 0xffc070, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(D.chars - 4);
  }

  buildParticles() {
    const { s, D } = this;
    const mk = (key, n, depth) => Array.from({ length: n }, () => s.add.image(0, 0, key).setScale(2).setDepth(depth).setVisible(false));
    // per character: wind streaks (sky), leaves (canopy), dust (tunnel), motes (cave exit)
    this.fx = [0, 1].map(() => ({
      streak: mk('streak', 3, D.fx),
      leaf: mk('leaf', 5, D.fx + 1).map((o, i) => (i === 4 ? o.setTexture('leafRose') : o)),
      dust: mk('dustMote', 4, D.fx),
      mote: mk('mote', 4, D.fx),
    }));
    this.reduced = false;
  }

  zone(y) {
    const { G } = this;
    if (y < G.canopy) return 'sky';
    if (y < G.floor) return 'canopy';
    if (y < G.shaft - 60) return 'tunnel';
    if (y < G.shaft + 80) return 'exit';
    return 'garden';
  }

  /** Character-attached particles, all derived from the fall distance d. */
  charFx(i, x, y, falling, d) {
    const F = this.fx[i];
    const z = falling && !this.reduced ? this.zone(y) : null;
    F.streak.forEach((o, k) => {
      const on = z === 'sky';
      o.setVisible(on);
      if (on) o.setPosition(x + (k - 1) * 22 + (k === 1 ? 8 : 0), y - 30 + 40 - ((d * 7 + k * 31) % 90));
    });
    F.leaf.forEach((o, k) => {
      const on = z === 'canopy';
      o.setVisible(on);
      if (on) {
        const ph = (d * 4 + k * 23) % 100;
        o.setPosition(x + Math.sin(d * 0.15 + k * 1.7) * 26, y + 10 - ph).setRotation(d * 0.2 + k);
        o.setAlpha(1 - ph / 110);
      }
    });
    F.dust.forEach((o, k) => {
      const on = z === 'tunnel';
      o.setVisible(on);
      if (on) o.setPosition(x + Math.sin(d * 0.07 + k * 2.1) * 30, y - 20 - ((d * 3 + k * 29) % 80) + 30).setAlpha(0.8);
    });
    F.mote.forEach((o, k) => {
      const on = z === 'exit' || z === 'garden';
      o.setVisible(on);
      if (on) o.setPosition(x + Math.sin(d * 0.05 + k * 1.3) * 34, y - 40 - ((d * 2 + k * 37) % 70) + 20).setAlpha(0.9);
    });
  }

  /**
   * @param {number} camY   camera top
   * @param {number} V      visible height (logical)
   * @param {number} time   ms, only for idle twinkles (never for positions)
   */
  update(camY, V, time) {
    const ref = camY + 0.55 * V;
    this.par.forEach((p) => { p.o.y = p.y + (1 - p.f) * (ref - p.y); });
    const { G } = this;
    const cy = camY + V / 2;
    const cool = ramp(cy, G.floor - 120, G.floor + 180) * (1 - ramp(cy, G.shaft - 160, G.shaft + 40));
    const warm = ramp(cy, G.shaft - 180, G.shaft) * (1 - ramp(cy, G.shaft + 120, G.y1));
    this.cool.setFillStyle(0x1e2a48, 0.34 * cool);
    this.warm.setFillStyle(0xffc070, 0.16 * warm);
    const t = time / 1000;
    this.shrooms.forEach(({ glow }, i) => glow.setAlpha(0.7 + 0.3 * Math.sin(t * 2 + i)));
    this.birds.forEach((b, i) => b.setTexture(Math.floor(t * 4 + i) % 2 ? 'bird1' : 'bird0'));
  }
}
