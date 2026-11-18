import Phaser from 'phaser';
import { makeNoise } from './ForestGround.js';
import { mulberry32 } from '../utils/rng.js';

/**
 * Original pixel art for Chương II, generated once at runtime.
 * Palette follows the existing forest (dark plum outline, moonlit stone)
 * and the garden's warm ivory / champagne / sage / peach.
 */

const O = '#2a1c30';
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

function canvas(scene, key, w, h, draw, linear = false) {
  if (scene.textures.exists(key)) return null;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  const img = ctx.createImageData(w, h);
  const api = {
    w, h, data: img.data,
    set(x, y, c, a = 255) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      const v = typeof c === 'string' ? hex(c) : c;
      img.data[i] = v[0]; img.data[i + 1] = v[1]; img.data[i + 2] = v[2]; img.data[i + 3] = a;
    },
    get(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return 0;
      return img.data[(y * w + x) * 4 + 3];
    },
  };
  draw(api, ctx);
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  if (linear) tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return tex;
}

function pixmap(scene, key, rows, pal) {
  const w = Math.max(...rows.map((r) => r.length));
  canvas(scene, key, w, rows.length, (c) => {
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) c.set(x, y, pal[ch]); }));
  });
}

/** Outline any filled region (pixels with alpha) in the given colour. */
function outline(c, col = O) {
  const fill = [];
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if (!c.get(x, y)) continue;
      if (!c.get(x - 1, y) || !c.get(x + 1, y) || !c.get(x, y - 1) || !c.get(x, y + 1)) fill.push([x, y]);
    }
  }
  fill.forEach(([x, y]) => c.set(x, y, col));
}

// ---------------------------------------------------------------- the gate
export const GATE = {
  W: 96,
  H: 112,
  door: { x: 20, y: 46, w: 28, h: 66 }, // left door, in gate px (right door mirrored)
  lock: { x: 48, y: 76 }, // centre of the round lock
};

function drawGate(scene) {
  const { W, H } = GATE;
  const STONE = ['#3a3848', '#525166', '#6c6c84', '#87889f', '#a4a6bd'].map(hex);
  const MOSS = ['#46663a', '#5f8244', '#7aa152'].map(hex);
  const n = makeNoise(77);
  const rnd = mulberry32(78);
  const runes = [];
  const flowers = [];
  canvas(scene, 'gate-frame', W, H, (c) => {
    const cx = W / 2;
    const archCY = 48;
    const inside = (x, y) => {
      const px = x + 0.5;
      const py = y + 0.5;
      // pillars + plinths
      if (py > 28 && ((px >= 2 && px <= 20) || (px >= W - 20 && px <= W - 2))) return 'pillar';
      if (py > H - 9 && ((px >= 0 && px <= 22) || (px >= W - 22 && px <= W))) return 'pillar';
      // capitals
      if (py > 23 && py <= 29 && ((px >= 0 && px <= 22) || (px >= W - 22 && px <= W))) return 'cap';
      // spires with an orb (distinctive silhouette)
      for (const sx of [11, W - 11]) {
        const t = (23 - py) / 16;
        if (py > 7 && py <= 23 && Math.abs(px - sx) <= 1.2 + 5 * (1 - t) * 0.6) return 'spire';
        if (Math.hypot(px - sx, py - 5) <= 3.2) return 'orb';
      }
      // arch ring + tympanum (filled half-disc above the doors)
      const r = Math.hypot(px - cx, py - archCY);
      if (py <= archCY && r <= 40) return r >= 31 ? 'arch' : 'tymp';
      if (py > archCY - 1 && py <= GATE.door.y && px > 18 && px < W - 18) return 'lintel';
      // crest above the keystone: three leaves
      if (Math.hypot(px - cx, py - 6) <= 4.5) return 'crest';
      if (Math.hypot(px - (cx - 6), py - 9) <= 3) return 'crest';
      if (Math.hypot(px - (cx + 6), py - 9) <= 3) return 'crest';
      return null;
    };
    const kind = [];
    for (let y = 0; y < H; y++) {
      kind[y] = [];
      for (let x = 0; x < W; x++) kind[y][x] = inside(x, y);
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = kind[y][x];
        if (!k) continue;
        let v = 0.55 + (n(x * 0.25, y * 0.25) - 0.5) * 0.5;
        if (k === 'pillar' || k === 'cap') {
          const lx = x < W / 2 ? (x - 2) / 18 : (x - (W - 20)) / 18;
          v += 0.3 - lx * 0.5;
          if (k === 'pillar' && (y - 29) % 8 === 0) v -= 0.45; // block seams
          if (k === 'pillar' && (y - 29) % 16 < 8 && (x === 11 || x === W - 11)) v -= 0.4;
        }
        if (k === 'arch') {
          const ang = Math.atan2(y - archCY, x - cx);
          if (Math.abs((ang * 180) / Math.PI % 16) < 1.3) v -= 0.5; // voussoirs
          v += 0.1;
        }
        if (k === 'tymp') v -= 0.15 + ((x + y) % 9 === 0 ? 0.2 : 0);
        if (k === 'spire' || k === 'orb' || k === 'crest') v += 0.25 - (x % 23) * 0.01;
        let col = STONE[Math.max(0, Math.min(4, Math.floor(v * 5)))];
        const m = n(x * 0.12 + 300, y * 0.12);
        if ((k === 'pillar' || k === 'arch' || k === 'cap') && m > 0.68) col = MOSS[Math.min(2, Math.floor((m - 0.68) * 10))];
        if (k === 'orb') col = hex(v > 0.7 ? '#e6e4f0' : '#b9b7cc');
        c.set(x, y, col);
      }
    }
    // Tympanum relief: a rising sun / star made of rays.
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      for (let r = 6; r < 26; r++) {
        if (r % 2) continue;
        c.set(Math.round(cx + Math.cos(a) * r), Math.round(archCY + Math.sin(a) * r), STONE[0]);
      }
    }
    outline(c);
    // Carved runes on the pillars (remember where, for the glowing overlay).
    for (let y = 36; y < H - 14; y += 11) {
      for (const x0 of [8, W - 14]) {
        const glyph = [[0, 0], [1, 1], [2, 0], [1, 2], [0, 3], [2, 3]].filter(() => rnd() < 0.8);
        glyph.forEach(([gx, gy]) => {
          c.set(x0 + gx, y + gy, STONE[0]);
          runes.push([x0 + gx, y + gy]);
        });
      }
    }
    // Arch runes.
    for (let i = 0; i < 11; i++) {
      const a = Math.PI + ((i + 0.5) / 11) * Math.PI;
      const x = Math.round(cx + Math.cos(a) * 35.5);
      const y = Math.round(archCY + Math.sin(a) * 35.5);
      c.set(x, y, STONE[0]);
      runes.push([x, y]);
    }
    // Vines curling over the arch and down the pillars, with tiny glowing flowers.
    const vine = (pts) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let s = 0; s <= steps; s++) {
          const x = Math.round(x0 + ((x1 - x0) * s) / steps);
          const y = Math.round(y0 + ((y1 - y0) * s) / steps + Math.sin(s * 0.7) * 0.8);
          c.set(x, y, MOSS[s % 3 === 0 ? 2 : 0]);
          if (s % 7 === 3) {
            c.set(x + 1, y, MOSS[1]);
            c.set(x - 1, y + 1, MOSS[1]);
          }
          if (s % 13 === 6) {
            c.set(x, y - 1, rnd() < 0.5 ? '#bff2ea' : '#ffe08a');
            flowers.push([x, y - 1]);
          }
        }
      }
    };
    vine([[22, 16], [30, 10], [40, 9], [48, 12], [58, 9], [68, 11], [76, 17]]);
    vine([[18, 22], [14, 34], [17, 48], [13, 62], [16, 78]]);
    vine([[78, 22], [83, 36], [80, 52], [84, 70], [81, 88], [84, 100]]);
  });
  canvas(scene, 'gate-runes', W, H, (c) => {
    runes.forEach(([x, y]) => c.set(x, y, '#ffd86b'));
  });
  GATE.flowers = flowers;

  // Doors: heavy carved stone with a gold inlay and half of the round lock each.
  const DOOR = ['#38323f', '#463f50', '#554d61'].map(hex);
  const { w: dw, h: dh } = GATE.door;
  ['l', 'r'].forEach((side) => {
    canvas(scene, `gate-door-${side}`, dw, dh, (c) => {
      for (let y = 0; y < dh; y++) {
        for (let x = 0; x < dw; x++) {
          const lx = side === 'l' ? x : dw - 1 - x; // 0 = outer edge
          let v = 1;
          if (lx > 3 && lx < dw - 4 && ((y > 4 && y < 28) || (y > 34 && y < dh - 5))) v = 0; // sunken panels
          if (lx === 4 || lx === dw - 5) v = 2;
          const col = DOOR[v];
          c.set(x, y, col);
          if (lx === dw - 2 && y > 2 && y < dh - 2) c.set(x, y, '#b8913f'); // gold inlay at the join
        }
      }
      // half lock ring at the join
      const ly = GATE.lock.y - GATE.door.y;
      const jx = side === 'l' ? dw : 0;
      for (let y = ly - 8; y <= ly + 8; y++) {
        for (let x = 0; x < dw; x++) {
          const d = Math.hypot(x + 0.5 - jx, y + 0.5 - ly);
          if (d <= 7.5 && d >= 5.5) c.set(x, y, d > 6.6 ? '#8f6a2c' : '#e2bb63');
          else if (d < 5.5) c.set(x, y, '#2a2230');
        }
      }
      outline(c);
    });
  });
  // Keyhole + star on the lock (drawn over both doors when closed).
  pixmap(scene, 'gate-keyhole', ['..o..', '.oyo.', 'oyyyo', '.oyo.', '..o..', '.....', '..k..', '.kkk.', '..k..'],
    { o: '#8f6a2c', y: '#ffe08a', k: '#0d0810' });
  canvas(scene, 'gate-light', 56, 66, (c) => {
    for (let y = 0; y < 66; y++) {
      const t = y / 65;
      const r = Math.round(255);
      const g = Math.round(240 - t * 30);
      const b = Math.round(196 - t * 70);
      for (let x = 0; x < 56; x++) c.set(x, y, [r, g, b]);
    }
  }, true);
}

// ---------------------------------------------------------------- ruins & garden props
function drawProps(scene) {
  const STONE = ['#3a3848', '#525166', '#6c6c84', '#87889f'].map(hex);
  const rnd = mulberry32(5);
  const block = (key, w, h, broken) => canvas(scene, key, w, h, (c) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (broken && y < 4 && (x * 7 + y * 3) % 5 < (4 - y)) continue;
        let v = 2 - (x > w / 2 ? 1 : 0) + (y % 6 === 0 ? -1 : 0);
        if (y < 2 && rnd() < 0.6) v = -1; // moss on top
        c.set(x, y, v < 0 ? '#5f8244' : STONE[Math.max(0, Math.min(3, v))]);
      }
    }
    outline(c);
  });
  block('ruin-pillar', 9, 26, true);
  block('ruin-pillar-low', 9, 14, true);
  block('ruin-block', 14, 8, false);

  pixmap(scene, 'pedestal', [
    '.oooooooooooooo.',
    'oLLLLLLLLLLLLLLo',
    'oMMMMMMMMMMMMMMo',
    '.ooMMMMMMMMMMoo.',
    '...oLMMMMMMMo...',
    '...oLMMMMMMMo...',
    '...oLMMsMMMMo...',
    '...oLMMssMMMo...',
    '...oLMMMMMMMo...',
    '..ooLMMMMMMMoo..',
    '.oLLLLLLLLLLLLo.',
    'oMMMMMMMMMMMMMMo',
    'oDDDDDDDDDDDDDDo',
    '.oooooooooooooo.',
  ], { o: O, L: '#ece5d4', M: '#d2c8b2', D: '#ada28a', s: '#8aa27c' });

  pixmap(scene, 'lantern', [
    '..ooo..',
    '.oLLLo.',
    'oLLLLLo',
    '.oyyyo.',
    '.oyYyo.',
    '.oyyyo.',
    'oLLLLLo',
    '..oMo..',
    '..oMo..',
    '..oMo..',
    '.oMMMo.',
    '.ooooo.',
  ], { o: O, L: '#e6dfcd', M: '#c9bfa6', y: '#ffd98a', Y: '#fff3c4' });

  // Butterflies (two frames) and petals.
  const BP = { w: '#fff6e6', W: '#f3c9a2', b: '#5a4636' };
  pixmap(scene, 'butterfly-0', ['ww.ww', 'wWbWw', '.w.w.'], BP);
  pixmap(scene, 'butterfly-1', ['.....', '.wbw.', '..w..'], BP);
  pixmap(scene, 'petal', ['pq', 'qp'], { p: '#fbe6d6', q: '#f2c8b4' });
  pixmap(scene, 'orange-blossom', ['.o.', 'oyo', '.o.'], { o: '#f4a259', y: '#ffe9a8' });
  pixmap(scene, 'bloom-cream', ['.c.c.', 'cWcWc', '.cyc.', 'cWcWc', '.csc.', '..s..'],
    { c: '#f6ead0', W: '#fffaf0', y: '#f6d77a', s: '#7f9a6f' });
  pixmap(scene, 'gold-mote', ['y'], { y: '#ffe7a3' });

  // Envelope: closed, seal broken, open; and the folded card.
  const EP = {
    O: '#4a3528', W: '#f6eedc', w: '#e4d7bb', g: '#d6ad57', r: '#8e2c3a', R: '#c25563',
    s: '#8aa27c', c: '#fff8e8', k: '#d9cba9',
  };
  const env = [
    '.OOOOOOOOOOOOOOOO.',
    'OgwWWWWWWWWWWWWwgO',
    'OWgwWWWWWWWWWWwgWO',
    'OWWgwWWWWWWWWwgWWO',
    'OWWWgwWWWWWWwgWWWO',
    'OWWWWgwWWWWwgWWWWO',
    'OWWWWWgwrrwgWWWWWO',
    'OWWWWWWrRrrWWWWWWO',
    'OWWWWWWrrrrsWWWWWO',
    'OWWWWWWWrrcsWWWWWO',
    'OwWWWWWWWWWWWWWWwO',
    'OwwwwwwwwwwwwwwwwO',
    '.OOOOOOOOOOOOOOOO.',
  ];
  pixmap(scene, 'envelope', env, EP);
  const broken = env.map((r) => r.replace(/r/g, (m, i) => (i % 2 ? 'W' : 'r')).replace('R', 'W'));
  pixmap(scene, 'envelope-broken', broken, EP);
  pixmap(scene, 'envelope-open', [
    '........OO........',
    '......OOggOO......',
    '....OOgkkkkgOO....',
    '..OOgkkkkkkkkgOO..',
    'OOgkkkkkkkkkkkkgOO',
    'OkkkkkkkkkkkkkkkkO',
    'OkkkkkkkkkkkkkkkkO',
    'OgWWWWWWWWWWWWWWgO',
    'OWgWWWWWWWWWWWWgWO',
    'OWWgWWWWWWWWWWgWWO',
    'OWWWgwWWWWWWwgWWWO',
    'OWWWWgwWWWWwgWWWWO',
    'OwWWWWgwwwwgWWWWwO',
    'OwwwwwwwwwwwwwwwwO',
    '.OOOOOOOOOOOOOOOO.',
  ], EP);
  pixmap(scene, 'card-folded', [
    '.OOOOOOOOOOOO.',
    'OggggggggggggO',
    'OgWWWWWWWWWWgO',
    'OgWWWWccWWWWgO',
    'OgWWWWWWWWWWgO',
    'OgwwwwwwwwwwgO',
    'OgWWWWWWWWWWgO',
    'OggggggggggggO',
    '.OOOOOOOOOOOO.',
  ], EP);

  // Wedding arbour: an arch of vines and ivory flowers on two light posts.
  canvas(scene, 'arbor', 46, 44, (c) => {
    const cx = 23;
    const cy = 22;
    for (let y = 0; y < 44; y++) {
      for (let x = 0; x < 46; x++) {
        const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (y <= cy && r >= 17 && r <= 22) c.set(x, y, (x + y) % 3 ? '#7f9a6f' : '#6a8460');
        if (y > cy && ((x >= 1 && x <= 4) || (x >= 41 && x <= 44))) c.set(x, y, x % 4 === 1 ? '#a8885e' : '#c9a77a');
      }
    }
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + (i / 25) * Math.PI;
      const r = 19.5 + (rnd() - 0.5) * 3;
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      const col = i % 4 === 0 ? '#f4a259' : i % 3 === 0 ? '#fbe6d6' : '#fffaf0';
      c.set(x, y, col);
      c.set(x + 1, y, col);
      c.set(x, y + 1, '#f6d77a');
    }
    for (let y = cy; y < 40; y += 3) {
      c.set(3, y, '#fffaf0');
      c.set(42, y + 1, '#fbe6d6');
    }
    outline(c);
  });

  // Soft vertical fade (hides the far side of the gate until it opens).
  canvas(scene, 'fade-v', 8, 64, (c) => {
    for (let y = 0; y < 64; y++) {
      const a = Math.round(255 * Math.min(1, (64 - y) / 40));
      for (let x = 0; x < 8; x++) c.set(x, y, [255, 255, 255], a);
    }
  }, true);
}

/** Garden trees: Fantasy Lands trees recoloured to sage with orange and cream blossoms. */
function drawBlossomTrees(scene) {
  const SAGE = ['#3e5340', '#56704f', '#728d66', '#93ab83', '#b5c8a2'].map(hex);
  ['green1', 'green3', 'green6'].forEach((f, idx) => {
    const key = `blossom-tree-${idx}`;
    if (scene.textures.exists(key)) return;
    const fr = scene.textures.getFrame('bigTrees', f);
    const tex = scene.textures.createCanvas(key, fr.width, fr.height);
    const ctx = tex.getContext();
    ctx.drawImage(fr.source.image, fr.cutX, fr.cutY, fr.width, fr.height, 0, 0, fr.width, fr.height);
    const im = ctx.getImageData(0, 0, fr.width, fr.height);
    const d = im.data;
    const rnd = mulberry32(90 + idx);
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (g > r && g > b) {
        const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
        const c = SAGE[Math.min(4, Math.floor(l * 6))];
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        const y = Math.floor(i / 4 / fr.width);
        if (y < 20 && rnd() < 0.08) {
          const bc = hex(rnd() < 0.55 ? '#f4a259' : '#fff3dc');
          d[i] = bc[0]; d[i + 1] = bc[1]; d[i + 2] = bc[2];
        }
      }
    }
    ctx.putImageData(im, 0, 0);
    tex.refresh();
  });
}

export function createGateArt(scene) {
  drawGate(scene);
  drawProps(scene);
  drawBlossomTrees(scene);
}
