import Phaser from 'phaser';
import { makeNoise } from '../effects/ForestGround.js';
import { mulberry32 } from '../utils/rng.js';

const BARK = ['#2e1a24', '#46262a', '#5f3430', '#7a4535', '#93573f'];
const MOSS = ['#4c6a3a', '#5f8244', '#78a052'];
const OUTLINE = '#20141c';

/**
 * Draw the trunk of an enormous ancient tree into a canvas texture:
 * a flared trunk, root fingers spreading over the ground, vertical bark,
 * moss, and dark hollows (each hollow: { x, y, w, h } in texture px,
 * measured from the texture's top-left).
 */
function drawTrunk(scene, key, W, H, hollows, seed) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, W, H);
  const ctx = tex.getContext();
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const n = makeNoise(seed);
  const rnd = mulberry32(seed + 5);
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const bark = BARK.map(hex);
  const moss = MOSS.map(hex);
  const cx = W / 2;
  const inside = new Uint8Array(W * H);
  const hw = (y) => {
    const t = y / H;
    let w = W * 0.17 + Math.sin(y * 0.21) * 0.6;
    if (t > 0.55) w += Math.pow((t - 0.55) / 0.45, 2.2) * W * 0.33; // root flare
    if (t < 0.12) w += (0.12 - t) * W * 0.9; // branches splitting at the top
    return w;
  };
  for (let y = 0; y < H; y++) {
    const w = hw(y);
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      let ins = Math.abs(dx) <= w;
      // Root fingers: gaps between roots near the ground.
      const t = y / H;
      if (ins && t > 0.78) {
        const finger = Math.sin((dx / (w + 1)) * Math.PI * 3.2 + 0.4);
        const depth = (t - 0.78) / 0.22;
        if (finger < -0.15 + depth * 0.95 - 0.55 && Math.abs(dx) > W * 0.16) ins = false;
      }
      // Crotch between two top branches.
      if (ins && t < 0.1 && Math.abs(dx) < (0.1 - t) * W * 0.5) ins = false;
      inside[y * W + x] = ins ? 1 : 0;
    }
  }
  const isHollow = (x, y) => hollows.some((h) => {
    const ex = (x + 0.5 - h.x) / (h.w / 2);
    const ey = (y + 0.5 - h.y) / (h.h / 2);
    return y + 0.5 >= h.y - h.h / 2 && (y + 0.5 > h.y ? Math.abs(ex) <= 1 : ex * ex + ey * ey <= 1);
  });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inside[y * W + x]) continue;
      const i = (y * W + x) * 4;
      const edge = !inside[y * W + x - 1] || !inside[y * W + x + 1] || !inside[(y - 1) * W + x] || !inside[(y + 1) * W + x];
      let c;
      if (edge) c = hex(OUTLINE);
      else {
        const dx = (x + 0.5 - cx) / (hw(y) + 1);
        let v = 0.55 - dx * 0.45 + (n(x * 0.7, y * 0.06) - 0.5) * 0.6; // light from the left, vertical grain
        if (n(x * 0.35 + 50, y * 0.35) > 0.78) v -= 0.35; // knots
        v = Math.max(0, Math.min(0.999, v));
        c = bark[1 + Math.floor(v * (bark.length - 1))] || bark[bark.length - 1];
        const m = n(x * 0.18 + 200, y * 0.18);
        if ((y < H * 0.35 || y > H * 0.75) && m > 0.66) c = moss[Math.min(2, Math.floor((m - 0.66) * 9))];
        if (rnd() < 0.02) c = bark[0];
      }
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  // Hollows: deep darkness with a lit upper rim.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isHollow(x, y)) continue;
      const i = (y * W + x) * 4;
      const rim = !isHollow(x, y - 1) || !isHollow(x - 1, y) || !isHollow(x + 1, y);
      const c = rim ? hex(OUTLINE) : (isHollow(x, y - 2) ? hex('#0c0710') : hex('#1c1018'));
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      if (rim && !isHollow(x, y - 1) && y > 1) {
        const j = ((y - 1) * W + x) * 4;
        const hl = hex(BARK[4]);
        d[j] = hl[0]; d[j + 1] = hl[1]; d[j + 2] = hl[2]; d[j + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}

/**
 * A huge tree: procedural trunk + a dome of Fantasy Lands crowns.
 * `x, baseY` is where the trunk meets the ground (world art px).
 * hollows (in trunk-local px, relative to the trunk's bottom-centre):
 * [{ dx, dy, w, h }] — returned as world positions in `tree.hollows`.
 */
export class AncientTree {
  constructor(scene, layer, x, baseY, { key = 'ancient', W = 76, H = 72, hollows = [], seed = 3, sortedDepth = 100 } = {}) {
    this.scene = scene;
    const texHollows = hollows.map((h) => ({ x: W / 2 + h.dx, y: H + h.dy, w: h.w, h: h.h }));
    drawTrunk(scene, `${key}-trunk`, W, H, texHollows, seed);
    this.x = x;
    this.baseY = baseY;
    this.trunk = scene.add.image(x, baseY, `${key}-trunk`).setOrigin(0.5, 1).setDepth(sortedDepth + baseY);
    layer.add(this.trunk);
    this.hollows = hollows.map((h) => ({ x: x + h.dx, y: baseY + h.dy, w: h.w, h: h.h }));

    // Canopy: overlapping crowns in a broad dome, back rows darker.
    const rnd = mulberry32(seed + 9);
    this.crowns = [];
    const topY = baseY - H + 6;
    const rows = [
      { y: -44, n: 3, spread: 30, tint: 0xb9c7b0 },
      { y: -34, n: 5, spread: 52, tint: 0xd0dccb },
      { y: -22, n: 6, spread: 64, tint: 0xe6eee2 },
      { y: -10, n: 6, spread: 70, tint: 0xffffff },
      { y: 2, n: 5, spread: 58, tint: 0xffffff },
    ];
    rows.forEach((r, ri) => {
      for (let i = 0; i < r.n; i++) {
        const t = r.n === 1 ? 0.5 : i / (r.n - 1);
        const cx = x + (t - 0.5) * r.spread * 2 + (rnd() - 0.5) * 6;
        const cy = topY + r.y + (rnd() - 0.5) * 4 + Math.abs(t - 0.5) * 10;
        const c = scene.add.image(Math.round(cx), Math.round(cy), 'bigTrees', `crown${Math.floor(rnd() * 8)}`)
          .setOrigin(0.5, 1).setTint(r.tint).setFlipX(rnd() < 0.5)
          // Canopy draws above the trunk and anything walking at its roots.
          .setDepth(sortedDepth + baseY + 2 + ri * 0.1 + i * 0.001);
        layer.add(c);
        this.crowns.push(c);
      }
    });
    this.canopyTop = topY - 66;
    this.parts = [this.trunk, ...this.crowns];
  }

  /** Warm pulse over the whole tree (used when it "wakes up"). */
  glow(scene, color = 0xffe7b0, duration = 900) {
    const c0 = Phaser.Display.Color.ValueToColor(0xffffff);
    const c1 = Phaser.Display.Color.ValueToColor(color);
    const proxy = { k: 0 };
    scene.tweens.add({
      targets: proxy, k: 1, duration: duration / 2, yoyo: true, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(c0, c1, 100, proxy.k * 100);
        this.trunk.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      },
      onComplete: () => this.trunk.clearTint(),
    });
  }
}
