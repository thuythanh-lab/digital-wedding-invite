import { GRASS, PATH, makeNoise } from '../effects/ForestGround.js';
import { mulberry32 } from '../utils/rng.js';

/**
 * Reusable forest building blocks for story scenes (art-pixel world units).
 * Same palette and sprites as the Prologue forest so chapters match.
 */

// ---------------------------------------------------------------- geometry
function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const L2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2));
  const qx = ax + t * vx;
  const qy = ay + t * vy;
  return Math.hypot(px - qx, py - qy);
}

/** Smooth a coarse polyline (Chaikin) so paths wind naturally. */
export function smoothPath(points, rounds = 3) {
  let pts = points.map((p) => [...p]);
  for (let r = 0; r < rounds; r++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

export function distToPath(path, x, y) {
  let d = Infinity;
  const p = path.pts;
  for (let i = 0; i < p.length - 1; i++) {
    d = Math.min(d, distToSegment(x, y, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
  }
  return d;
}

export function inClearing(c, x, y, grow = 0) {
  const dx = (x - c.x) / (c.rx + grow);
  const dy = (y - c.y) / (c.ry + grow);
  return dx * dx + dy * dy <= 1;
}

// ---------------------------------------------------------------- ground
/**
 * Paint grass + any number of winding dirt paths and soft clearings into one
 * canvas texture. `paths`: [{ pts: [[x,y]...], hw }], `clearings`:
 * [{ x, y, rx, ry }]. Paths with `hidden: true` are skipped unless
 * `showHidden` is set (used to reveal a path later by cross-fading).
 */
export function paintGround(scene, key, w, h, {
  paths = [], clearings = [], seed = 7, showHidden = false, grassPalette = GRASS,
} = {}) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const n1 = makeNoise(seed);
  const n2 = makeNoise(seed + 1);
  const rnd = mulberry32(seed + 2);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const grass = grassPalette.map(hex);
  const P = Object.fromEntries(Object.entries(PATH).map(([k, v]) => [k, hex(v)]));
  const put = (i, c) => {
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = 255;
  };
  const active = paths.filter((p) => showHidden || !p.hidden);
  const STONE = {
    base: hex('#d9d0bc'), dark: hex('#c8bea8'), light: hex('#ece5d4'), seam: hex('#a99e86'), rim: hex('#8f846e'),
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const th = (bayer[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
      const jitter = (n2(x * 0.35, y * 0.35) - 0.5) * 4;
      let d = Infinity;
      let stone = false;
      for (const p of active) {
        const hw = p.hw + (p.stone ? 0 : 2 * Math.sin(y * 0.031 + x * 0.01 + (p.phase || 0)));
        const dd = distToPath(p, x, y) - (hw + (p.stone ? jitter * 0.25 : jitter));
        if (dd < d) {
          d = dd;
          stone = !!p.stone;
        }
      }
      for (const c of clearings) {
        if (c.stone && inClearing(c, x, y)) {
          d = -5;
          stone = true;
        }
      }
      if (stone && d < 0) {
        // Pale stone pavers with soft seams (garden walkways).
        const S = STONE;
        const seam = (x % 7 === 0 && y % 6 < 5) || ((y + (Math.floor(x / 7) % 2) * 3) % 6 === 0);
        let c = seam ? S.seam : (n1(x * 0.3 + 300, y * 0.3) > 0.6 ? S.dark : S.base);
        if (!seam && rnd() < 0.03) c = S.light;
        if (d > -1.2) c = S.rim;
        put(i, c);
      } else if (d < -1.2) {
        const v = n1(x * 0.22 + 100, y * 0.22);
        let c = v > 0.62 + th * 0.1 ? P.dark : P.base;
        if (rnd() < 0.012) c = P.light;
        put(i, c);
      } else if (d < 0) {
        put(i, rnd() < 0.7 ? P.rim : P.dark);
      } else {
        let v = n1(x * 0.06, y * 0.06) * 0.7 + n2(x * 0.2, y * 0.2) * 0.3;
        if (d < 3) v -= 0.18 * (1 - d / 3);
        if (clearings.some((c) => inClearing(c, x, y))) v += 0.14; // lusher, softer grass
        const t = Math.max(0, Math.min(0.999, v)) * (grass.length - 1);
        const k = Math.floor(t);
        put(i, t - k > th ? grass[Math.min(k + 1, grass.length - 1)] : grass[k]);
        if (d < 1.5 && rnd() < 0.25) put(i, grass[4]);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return tex;
}

// ---------------------------------------------------------------- mossy stones
export function ensureMossyRocks(scene) {
  if (scene.textures.exists('mossRock0')) return;
  const frames = ['big', 'mid', 'tall', 'midB'];
  frames.forEach((f, idx) => {
    const fr = scene.textures.getFrame('rocks', f);
    const tex = scene.textures.createCanvas(`mossRock${idx}`, fr.width, fr.height + 1);
    const ctx = tex.getContext();
    ctx.drawImage(fr.source.image, fr.cutX, fr.cutY, fr.width, fr.height, 0, 1, fr.width, fr.height);
    const im = ctx.getImageData(0, 0, fr.width, fr.height + 1);
    const d = im.data;
    const rnd = mulberry32(31 + idx);
    // Moss on the top surface of the stone.
    for (let x = 0; x < fr.width; x++) {
      for (let y = 0; y < fr.height + 1; y++) {
        const i = (y * fr.width + x) * 4;
        if (d[i + 3] === 0) continue;
        if (y <= 2 + Math.floor(rnd() * 2) && rnd() < 0.85) {
          const c = rnd() < 0.5 ? [111, 143, 69] : [86, 118, 58];
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        }
        break;
      }
    }
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] && rnd() < 0.08 && d[i] > 70) {
        d[i] = 98; d[i + 1] = 128; d[i + 2] = 64;
      }
    }
    ctx.putImageData(im, 0, 0);
    tex.refresh();
  });
}

// ---------------------------------------------------------------- flora
/**
 * Scatter trees and undergrowth avoiding `blocked(x, y, margin)` areas.
 * Returns { mushroomLights, swayers } for lighting and wind animation.
 */
export function scatterFlora(scene, layer, rng, w, h, blocked, opts = {}) {
  const {
    trees = 70, bushes = 12, berries = 4, rocks = 8, mushrooms = 6, flowers = 10,
    logs = 3, stumps = 3, sticks = 6, tufts = 90, sortedDepth = 100, decorDepth = 2, shadowDepth = 1,
    keepOut = [],
  } = opts;
  const placed = [];
  const clear = (x, y, d) => placed.every((p) => (p.x - x) ** 2 + ((p.y - y) * 1.3) ** 2 > d * d);
  const outside = (x, y) => keepOut.every((k) => Math.hypot((x - k.x) / k.rx, (y - k.y) / k.ry) > 1);
  const mushroomLights = [];
  const swayers = [];
  const sprite = (tex, frame, x, y, shadow) => {
    if (shadow) {
      layer.add(scene.add.image(x, y - 1, 'groundShadow').setDisplaySize(shadow, shadow * 0.45)
        .setAlpha(0.8).setDepth(shadowDepth));
    }
    const s = scene.add.image(Math.round(x), Math.round(y), tex, frame).setOrigin(0.5, 1)
      .setDepth(sortedDepth + y).setFlipX(rng.chance(0.5));
    layer.add(s);
    return s;
  };

  const greens = ['green0', 'green1', 'green2', 'green3', 'green4', 'green5', 'green6', 'green7'];
  let tries = 0;
  let n = 0;
  while (n < trees && tries < trees * 40) {
    tries++;
    const x = rng.range(-8, w + 8);
    const y = rng.range(8, h + 26);
    if (blocked(x, y, 14) || !outside(x, y) || !clear(x, y, 16)) continue;
    placed.push({ x, y });
    n++;
    const roll = rng.next();
    if (roll < 0.15) sprite('bigTrees', 'pine', x, y, 20);
    else if (roll < 0.21) sprite('bigTrees', rng.pick(['autumn1', 'autumn3', 'autumn6']), x, y, 22);
    else if (roll < 0.33) sprite('smallTrees', rng.pick(['green0', 'green2', 'green5', 'pine']), x, y, 16);
    else sprite('bigTrees', rng.pick(greens), x, y, 22);
  }

  const scatter = (count, tex, frames, margin, o = {}) => {
    let k = 0;
    let t = 0;
    while (k < count && t < count * 80) {
      t++;
      const x = rng.range(4, w - 4);
      const y = rng.range(8, h - 4);
      if (o.nearPath ? !o.nearPath(x, y) : blocked(x, y, margin)) continue;
      if (!outside(x, y) || !clear(x, y, o.space ?? 8)) continue;
      placed.push({ x, y });
      const s = sprite(tex, rng.pick(frames), x, y);
      o.after?.(s, x, y);
      k++;
    }
  };
  const nearPath = (x, y) => blocked(x, y, 0) === false && blocked(x, y, 12) === true;
  scatter(bushes, 'bushes', ['big', 'small', 'wide', 'big', 'wide', 'smallAutumn'], 3, { space: 12 });
  scatter(berries, 'bushesBerries', ['big', 'wide', 'small'], 4, { space: 12 });
  ensureMossyRocks(scene);
  scatter(rocks, 'mossRock0', [undefined], 1, {
    space: 9, nearPath,
    after: (s) => s.setTexture(`mossRock${rng.int(0, 3)}`),
  });
  scatter(mushrooms, 'mushrooms', ['few', 'cluster', 'one', 'cluster'], 4, {
    space: 10, after: (s, x, y) => mushroomLights.push({ x, y: y - 4 }),
  });
  scatter(flowers, 'redFlowers', ['single', 'pair', 'bunch', 'pair'], 0, {
    space: 7, nearPath,
    after: (s) => swayers.push({ o: s, x: s.x, amp: 0.5, sp: rng.range(0.8, 1.3), ph: rng.range(0, 6) }),
  });
  // (Upright logs are left out: at night they read like a standing figure.)
  scatter(logs, 'logs', ['short', 'long'], 6, { space: 16 });
  scatter(stumps, 'stumps', ['a', 'b', 'c', 'd'], 4, { space: 10 });
  scatter(sticks, 'sticks', ['a', 'b', 'c'], -2, { space: 5 });

  for (let i = 0; i < tufts; i++) {
    const x = rng.range(0, w);
    const y = rng.range(0, h);
    if (blocked(x, y, -1)) continue;
    const g = scene.add.image(Math.round(x), Math.round(y), 'grass',
      rng.pick(['tuft', 'tuftB', 'low', 'lowB', 'sprigs', 'sprigsB', 'scatter', 'scatterB']))
      .setOrigin(0.5, 1).setDepth(decorDepth).setFlipX(rng.chance(0.5));
    layer.add(g);
    if (rng.chance(0.5)) swayers.push({ o: g, x: g.x, amp: 0.45, sp: rng.range(0.7, 1.2), ph: rng.range(0, 6) });
  }
  return { mushroomLights, swayers };
}

/** Drifting leaves over the whole world. */
export function addLeaves(scene, layer, w, depth = 3000) {
  const e = scene.add.particles(0, 0, 'leaf', {
    x: { min: 0, max: w },
    y: -6,
    lifespan: 14000,
    speedY: { min: 10, max: 18 },
    speedX: { min: -6, max: 6 },
    rotate: { start: 0, end: 360 },
    alpha: { start: 0.9, end: 0.6 },
    tint: [0x6f9a4a, 0xa8c45a, 0x8a6d3b],
    frequency: 1400,
  }).setDepth(depth);
  layer.add(e);
  return e;
}

export function swayUpdate(swayers, t) {
  for (const s of swayers) s.o.x = s.x + Math.sin(t * s.sp + s.ph) * s.amp;
}

