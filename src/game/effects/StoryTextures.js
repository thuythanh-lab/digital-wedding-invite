/**
 * Small pixel textures for Chapter I, generated once at boot.
 */

function pixmap(scene, key, rows, palette) {
  if (scene.textures.exists(key)) return;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = palette[ch];
    if (!c) return;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, 1);
  }));
  tex.refresh();
}

export function createStoryTextures(scene) {
  const O = '#2a1c30';
  const W = '#fbf6ec';
  pixmap(scene, 'emote-bang', [
    '.ooooooo.',
    'oWWWWWWWo',
    'oWWWoWWWo',
    'oWWWoWWWo',
    'oWWWoWWWo',
    'oWWWWWWWo',
    'oWWWoWWWo',
    '.ooooooo.',
    '...oWo...',
    '....o....',
  ], { o: O, W });
  pixmap(scene, 'emote-dots', [
    '.ooooooo.',
    'oWWWWWWWo',
    'oWWWWWWWo',
    'oWoWoWoWo',
    'oWWWWWWWo',
    '.ooooooo.',
    '...oWo...',
    '....o....',
  ], { o: O, W });

  // The mouth of the tree hollow (grows when the tree "opens").
  pixmap(scene, 'hollow-mouth', [
    '...dddd...',
    '..dkkkkd..',
    '.dkkkkkkd.',
    'dkkkkkkkkd',
    'dkkkkkkkkd',
    'dkkkkkkkkd',
    'dkkkkkkkkd',
  ], { d: '#3a2030', k: '#07040a' });

  // Flowers that open at the end of the chapter.
  pixmap(scene, 'bud', ['.g.', 'gWg', '.g.', '.s.'], { g: '#7f9a6f', W: '#e9e2cf', s: '#5f7d52' });
  pixmap(scene, 'bloom', [
    '.W.W.',
    'WpWpW',
    '.WyW.',
    'WpWpW',
    '.WsW.',
    '..s..',
  ], { W: '#fbf6ec', p: '#efc3c9', y: '#f6d77a', s: '#5f7d52' });
  pixmap(scene, 'bloom-blush', [
    '.p.p.',
    'pWpWp',
    '.pyp.',
    'pWpWp',
    '.psp.',
    '..s..',
  ], { W: '#fbf6ec', p: '#e8aab3', y: '#f6d77a', s: '#5f7d52' });

  // The Promise Key: Kenney Tiny Town key (tile 117) recoloured to gold, with
  // a small rose gem in the bow; then split into two fragments.
  if (!scene.textures.exists('promise-key') && scene.textures.exists('kenneyKey')) {
    const src = scene.textures.get('kenneyKey').getSourceImage();
    const w = src.width;
    const h = src.height;
    const tex = scene.textures.createCanvas('promise-key', w, h);
    const ctx = tex.getContext();
    ctx.drawImage(src, 0, 0);
    const im = ctx.getImageData(0, 0, w, h);
    const d = im.data;
    const gold = [[94, 52, 30], [176, 112, 40], [232, 176, 62], [255, 226, 128], [255, 246, 206]];
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      let c;
      if (l < 60) c = [58, 30, 26]; // keep a dark warm outline
      else c = gold[Math.min(4, Math.floor(((l - 60) / 195) * 5))];
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
    ctx.putImageData(im, 0, 0);
    // Rose gem in the centre of the bow (left side of the key).
    let gx = -1;
    let gy = -1;
    for (let x = 0; x < w / 2 && gx < 0; x++) {
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] && x > 2) { gx = x + 2; gy = Math.round(h / 2) - 1; break; }
      }
    }
    if (gx > 0) {
      ctx.fillStyle = '#e8899a';
      ctx.fillRect(gx, gy, 2, 2);
      ctx.fillStyle = '#ffd6dd';
      ctx.fillRect(gx, gy, 1, 1);
    }
    tex.refresh();
    ['a', 'b'].forEach((k, idx) => {
      const half = scene.textures.createCanvas(`key-half-${k}`, w / 2, h);
      half.getContext().drawImage(tex.getSourceImage(), idx * (w / 2), 0, w / 2, h, 0, 0, w / 2, h);
      half.refresh();
    });
  }
}
