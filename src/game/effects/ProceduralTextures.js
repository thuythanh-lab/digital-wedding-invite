import Phaser from 'phaser';
import { mulberry32 } from '../utils/rng.js';

/**
 * Small hand-built pixel textures (stars, moon, clouds, ridgelines) and smooth
 * light textures. Generated once at boot: no extra downloads, tiny memory.
 */

function canvasTex(scene, key, w, h, draw, { linear = false } = {}) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  tex.refresh();
  if (linear) tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Draw a pixel map: rows of characters, each char → colour (or '.' = empty). */
function pixmap(ctx, rows, palette, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = palette[ch];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    });
  });
}

function radial(ctx, w, h, stops) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function createProceduralTextures(scene) {
  canvasTex(scene, 'px', 2, 2, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 2, 2);
  });

  // Soft light blobs (linear filtered so glows stay smooth).
  canvasTex(scene, 'glow', 128, 128, (ctx, w, h) =>
    radial(ctx, w, h, [
      [0, 'rgba(255,255,255,1)'],
      [0.18, 'rgba(255,255,255,0.65)'],
      [0.45, 'rgba(255,255,255,0.22)'],
      [0.75, 'rgba(255,255,255,0.06)'],
      [1, 'rgba(255,255,255,0)'],
    ]), { linear: true });

  // A light falloff for the lightmap: brighter plateau, smooth edge.
  canvasTex(scene, 'light', 128, 128, (ctx, w, h) =>
    radial(ctx, w, h, [
      [0, 'rgba(255,255,255,1)'],
      [0.35, 'rgba(255,255,255,0.75)'],
      [0.7, 'rgba(255,255,255,0.25)'],
      [1, 'rgba(255,255,255,0)'],
    ]), { linear: true });

  // Meteor tail: bright head on the right, fading to the left.
  canvasTex(scene, 'streak', 128, 16, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0.95)');
    ctx.fillStyle = g;
    for (let y = 0; y < h; y++) {
      const d = Math.abs(y - (h - 1) / 2) / (h / 2);
      ctx.globalAlpha = Math.max(0, 1 - d * d);
      ctx.fillRect(0, y, w, 1);
    }
  }, { linear: true });

  // Moonlight shaft: a soft vertical gradient band.
  canvasTex(scene, 'beam', 32, 128, (ctx, w, h) => {
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x - (w - 1) / 2) / (w / 2);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      const a = Math.max(0, 1 - d * d);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 1, h);
    }
  }, { linear: true });

  // Screen vignette: clear centre, dark edges.
  canvasTex(scene, 'vignette', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { linear: true });

  // Horizontal mist band.
  canvasTex(scene, 'mist', 64, 32, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const d = Math.abs(y - (h - 1) / 2) / (h / 2);
      ctx.fillStyle = `rgba(255,255,255,${(1 - d) * (1 - d) * 0.9})`;
      ctx.fillRect(0, y, w, 1);
    }
  }, { linear: true });

  // ---- Pixel sprites (nearest filtered) -------------------------------
  const W = '#ffffff';
  const C = '#fff6d8';
  const G = '#ffd36b';
  const O = '#e0a14a';

  canvasTex(scene, 'sparkle', 5, 5, (ctx) =>
    pixmap(ctx, ['..w..', '..w..', 'wwWww', '..w..', '..w..'], { w: 'rgba(255,255,255,0.55)', W }));

  canvasTex(scene, 'dot3', 3, 3, (ctx) =>
    pixmap(ctx, ['.w.', 'wWw', '.w.'], { w: 'rgba(255,255,255,0.6)', W }));

  // The guiding star: a little four-pointed gem.
  canvasTex(scene, 'star-core', 11, 11, (ctx) =>
    pixmap(ctx, [
      '.....o.....',
      '.....g.....',
      '....gcg....',
      '....gcg....',
      '.ogccWccgo.',
      'ogcWWWWWcgo',
      '.ogccWccgo.',
      '....gcg....',
      '....gcg....',
      '.....g.....',
      '.....o.....',
    ], { o: O, g: G, c: C, W }));

  // Pixel moon with soft craters.
  canvasTex(scene, 'moon', 22, 22, (ctx) => {
    const r = 10.5;
    for (let y = 0; y < 22; y++) {
      for (let x = 0; x < 22; x++) {
        const dx = x - 10.5;
        const dy = y - 10.5;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        // Lit from the upper left.
        const shade = (dx + dy) / (2 * r);
        let c = '#eef0ff';
        if (shade > 0.35) c = '#c9cdf0';
        else if (shade > 0.05) c = '#dde1fb';
        if (d > r - 1) c = shade > 0.2 ? '#aab0de' : '#d3d8f8';
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    pixmap(ctx, [
      '..........',
      '...cc.....',
      '..cccc....',
      '...cc.....',
      '.......c..',
      '......ccc.',
      '.......c..',
    ], { c: '#c3c8ec' }, 6, 5);
    pixmap(ctx, ['cc.', 'ccc', '.c.'], { c: '#cfd3f2' }, 4, 13);
  });

  // Clouds: three silhouettes with a moonlit top edge.
  const cloudShapes = [
    [[10, 10, 9], [22, 7, 10], [34, 11, 8], [44, 13, 6], [4, 14, 5]],
    [[8, 9, 7], [18, 6, 9], [30, 8, 8], [38, 12, 6]],
    [[7, 7, 6], [16, 5, 7], [25, 8, 6]],
  ];
  cloudShapes.forEach((blobs, i) => {
    const w = Math.max(...blobs.map(([x, , r]) => x + r)) + 2;
    const h = 22;
    canvasTex(scene, `cloud${i}`, w, h, (ctx) => {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let inside = false;
          let top = false;
          for (const [bx, by, br] of blobs) {
            const dx = x - bx;
            const dy = (y - by - 4) * 1.35;
            const d2 = dx * dx + dy * dy;
            if (d2 <= br * br) {
              inside = true;
              const dyTop = (y - 1 - by - 4) * 1.35;
              if (dx * dx + dyTop * dyTop > br * br) top = true;
            }
          }
          if (y > 17) inside = false;
          if (!inside) continue;
          ctx.fillStyle = top ? '#7c8bc4' : y > 14 ? '#1f2a58' : y > 11 ? '#28336a' : '#34417c';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    });
  });

  // Falling-leaf particle.
  canvasTex(scene, 'leaf', 3, 2, (ctx) => pixmap(ctx, ['gg.', '.gG'], { g: '#5f8f3a', G: '#87b34c' }));

  // Ring for the "tap me" pulse.
  canvasTex(scene, 'ring', 32, 32, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.stroke();
  }, { linear: true });

  // Ridgelines for the title backdrop (180 art px wide, drawn at 2× scale).
  const ridge = (key, seed, base, rough, body, rim) =>
    canvasTex(scene, key, 180, 70, (ctx, w, h) => {
      const rnd = mulberry32(seed);
      // Midpoint displacement for a natural silhouette.
      const n = 256;
      const pts = new Array(n + 1).fill(0);
      pts[0] = base + rnd() * 10;
      pts[n] = base + rnd() * 10;
      for (let step = n; step > 1; step /= 2) {
        const amp = rough * (step / n);
        for (let i = step / 2; i < n; i += step) {
          pts[i] = (pts[i - step / 2] + pts[i + step / 2]) / 2 + (rnd() - 0.5) * amp;
        }
      }
      for (let x = 0; x < w; x++) {
        const top = Math.round(pts[Math.floor((x / w) * n)]);
        ctx.fillStyle = body;
        ctx.fillRect(x, top, 1, h - top);
        ctx.fillStyle = rim;
        ctx.fillRect(x, top, 1, 1);
      }
    });
  ridge('ridge-far', 11, 26, 70, '#232d5e', '#3d4c8c');
  ridge('ridge-near', 29, 40, 46, '#19224f', '#2a376c');
}
