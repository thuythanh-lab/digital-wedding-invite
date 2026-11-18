import { mulberry32 } from '../utils/rng.js';

/**
 * Paints the forest floor into a single 1×-scale canvas texture:
 * grass in soft patches (colours sampled from the Fantasy Lands grass tile)
 * and a winding dirt path (colours from the Fantasy Lands path tile) with
 * irregular, hand-drawn-looking edges. One texture = one draw call, and no
 * visible tile repetition.
 */

export const GRASS = ['#5d8a36', '#6a9a3d', '#75a743', '#7fb04a', '#8bbb52'];
export const PATH = { base: '#c09473', dark: '#ad7757', rim: '#8f6046', light: '#d4ae8c' };

// Smooth value noise.
export function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const size = 64;
  const grid = Array.from({ length: size * size }, () => rnd());
  const at = (x, y) => grid[((y % size + size) % size) * size + ((x % size + size) % size)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

/** Path centre-line and half width at a given world y. */
export function pathAt(y, focusY) {
  const t = y - focusY;
  const cx = 90 + 20 * Math.sin(t * 0.017) + 8 * Math.sin(t * 0.043 + 0.5) - 8 * Math.sin(0.5);
  const hw = 12 + 2.5 * Math.sin(t * 0.031 + 1.1);
  return { cx, hw };
}

export function createForestGround(scene, key, w, h, focusY, seed = 7) {
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
  const grass = GRASS.map(hex);
  const P = Object.fromEntries(Object.entries(PATH).map(([k, v]) => [k, hex(v)]));
  const put = (i, c) => {
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = 255;
  };

  for (let y = 0; y < h; y++) {
    const { cx, hw } = pathAt(y, focusY);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // Irregular path edge.
      const edgeJitter = (n2(x * 0.35, y * 0.35) - 0.5) * 4;
      const d = Math.abs(x - cx) - (hw + edgeJitter);
      const th = (bayer[(y % 4) * 4 + (x % 4)] + 0.5) / 16;

      if (d < -1.2) {
        // Dirt: base with darker speckle patches and the odd pale pebble.
        const v = n1(x * 0.22 + 100, y * 0.22);
        let c = v > 0.62 + th * 0.1 ? P.dark : P.base;
        if (rnd() < 0.012) c = P.light;
        put(i, c);
      } else if (d < 0) {
        put(i, rnd() < 0.7 ? P.rim : P.dark);
      } else {
        // Grass: big soft patches + fine dither; darker near the path edge.
        let v = n1(x * 0.06, y * 0.06) * 0.7 + n2(x * 0.2, y * 0.2) * 0.3;
        if (d < 3) v -= 0.18 * (1 - d / 3);
        const t = Math.max(0, Math.min(0.999, v)) * (grass.length - 1);
        const k = Math.floor(t);
        const c = t - k > th ? grass[Math.min(k + 1, grass.length - 1)] : grass[k];
        put(i, c);
        // Occasional bright blades overhanging the path.
        if (d < 1.5 && rnd() < 0.25) put(i, grass[4]);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return tex;
}
