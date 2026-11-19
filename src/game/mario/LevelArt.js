/**
 * Procedural pixel art for the platform level (original designs, drawn at
 * boot into small canvases; 1 texture pixel = 1 "art pixel", displayed at ×2).
 * Palette: warm terracotta, sage, sky blue, ivory, muted gold, brick red.
 */

export const PAL = {
  sky: '#a9d9ea',
  skyDeep: '#8fcbe0',
  cloud: '#fffaf0',
  cloudShade: '#d8ecf3',
  gold: '#c9a24a',
  goldLight: '#ecc96a',
  goldDark: '#8f6a25',
  brick: '#b4523a',
  brickLight: '#d27756',
  brickDark: '#7d2f22',
  mortar: '#5e2419',
  sage: '#8fb07e',
  sageLight: '#b9d3a4',
  sageDark: '#5d7f55',
  sageDeep: '#3f5d3f',
  ivory: '#f8f0dd',
  ivoryShade: '#e6d7b8',
  ink: '#3b2620',
  terracotta: '#c8704e',
  terraLight: '#e0936c',
  terraDark: '#8c4430',
  dirt: '#8a4f36',
  dirtDark: '#6e3c29',
  dirtLight: '#a7684a',
  stone: '#b39a86',
  water: '#7cc3d8',
  waterLight: '#c6ecf4',
  wood: '#9a6a43',
  woodDark: '#6b4529',
  peachSky: '#f4dcae',
  rose: '#e7a29a',
  white: '#ffffff',
  green: '#4caf50',
};

function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  const r = (x, y, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, ww, hh); };
  const p = (x, y, c) => r(x, y, 1, 1, c);
  draw({ ctx, r, p, w, h });
  tex.refresh();
}

/** Draw a bitmap from rows of characters using a colour map. */
function bitmap(r, rows, map, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = map[row[x]];
      if (c) r(ox + x, oy + y, 1, 1, c);
    }
  });
}

export function createLevelArt(scene) {
  // ---------------------------------------------------------------- bricks
  canvasTex(scene, 'brick', 16, 16, ({ r }) => {
    r(0, 0, 16, 16, PAL.mortar);
    const brick = (x, y, w) => {
      r(x, y, w, 7, PAL.brick);
      r(x, y, w, 1, PAL.brickLight);
      r(x, y, 1, 7, PAL.brickLight);
      r(x, y + 6, w, 1, PAL.brickDark);
    };
    brick(0, 0, 7); brick(8, 0, 7);
    brick(-4, 8, 7); brick(4, 8, 7); brick(12, 8, 7);
  });
  canvasTex(scene, 'grassTop', 16, 6, ({ r, p }) => {
    r(0, 0, 16, 4, PAL.sage);
    r(0, 0, 16, 1, PAL.sageLight);
    r(0, 4, 16, 2, PAL.sageDark);
    [1, 6, 11].forEach((x) => p(x, 5, 'rgba(0,0,0,0)'));
    [2, 9, 13].forEach((x) => p(x, 1, PAL.sageLight));
    [4, 10].forEach((x) => r(x, 4, 2, 2, PAL.sage));
  });
  canvasTex(scene, 'dirt', 16, 16, ({ r, p }) => {
    r(0, 0, 16, 16, PAL.dirt);
    [[2, 3], [9, 1], [13, 7], [5, 10], [11, 13], [1, 14], [7, 6]].forEach(([x, y]) => p(x, y, PAL.dirtDark));
    [[4, 4], [12, 3], [8, 12], [2, 9]].forEach(([x, y]) => p(x, y, PAL.dirtLight));
    r(10, 9, 2, 1, PAL.dirtLight);
  });
  canvasTex(scene, 'plank', 8, 5, ({ r }) => {
    r(0, 0, 8, 4, PAL.wood);
    r(0, 0, 8, 1, '#c08b5c');
    r(7, 0, 1, 4, PAL.woodDark);
    r(0, 4, 8, 1, PAL.woodDark);
  });

  // ---------------------------------------------------------------- pipe (terracotta clay, ivory rim, gold band — original design)
  canvasTex(scene, 'pipeBody', 24, 8, ({ r }) => {
    r(0, 0, 24, 8, PAL.terracotta);
    r(0, 0, 2, 8, PAL.terraDark);
    r(22, 0, 2, 8, PAL.terraDark);
    r(4, 0, 3, 8, PAL.terraLight);
    r(8, 0, 1, 8, '#f0b08a');
    r(17, 0, 2, 8, '#b05f42');
    r(2, 6, 20, 1, '#b05f42');
  });
  canvasTex(scene, 'pipeRim', 30, 10, ({ r }) => {
    r(0, 0, 30, 10, PAL.ivory);
    r(0, 0, 30, 1, PAL.ink);
    r(0, 9, 30, 1, PAL.ink);
    r(0, 0, 1, 10, PAL.ink);
    r(29, 0, 1, 10, PAL.ink);
    r(1, 1, 28, 1, PAL.white);
    r(1, 4, 28, 2, PAL.gold);
    r(1, 4, 28, 1, PAL.goldLight);
    r(24, 1, 5, 8, PAL.ivoryShade);
    r(3, 1, 2, 8, PAL.white);
  });
  canvasTex(scene, 'pipeHole', 26, 3, ({ r }) => {
    r(0, 0, 26, 3, '#2a1712');
    r(0, 0, 26, 1, '#4a2a20');
  });

  // ---------------------------------------------------------------- sky things
  canvasTex(scene, 'cloud', 36, 14, ({ r }) => {
    const c = PAL.cloud;
    r(8, 4, 20, 8, c); r(4, 7, 28, 6, c); r(12, 1, 10, 4, c); r(22, 3, 6, 3, c); r(2, 9, 32, 4, c);
    r(2, 12, 32, 1, PAL.cloudShade); r(6, 11, 6, 1, PAL.cloudShade); r(24, 11, 7, 1, PAL.cloudShade);
    r(13, 2, 3, 1, PAL.white);
  });
  canvasTex(scene, 'cloudSmall', 20, 8, ({ r }) => {
    r(4, 2, 12, 5, PAL.cloud); r(1, 4, 18, 3, PAL.cloud); r(7, 0, 6, 2, PAL.cloud);
    r(1, 7, 18, 1, PAL.cloudShade);
  });
  ['bird0', 'bird1'].forEach((k, i) => canvasTex(scene, k, 7, 4, ({ r }) => {
    const c = '#4a3a3a';
    if (i === 0) { r(0, 0, 1, 1, c); r(1, 1, 2, 1, c); r(3, 2, 1, 1, c); r(4, 1, 2, 1, c); r(6, 0, 1, 1, c); }
    else { r(0, 2, 2, 1, c); r(2, 2, 3, 1, c); r(3, 1, 1, 1, c); r(5, 2, 2, 1, c); }
  }));

  // Rolling hills (sage) — a single wide bump.
  canvasTex(scene, 'hill', 64, 24, ({ r }) => {
    for (let x = 0; x < 64; x++) {
      const t = (x - 32) / 32;
      const h = Math.round(24 * Math.sqrt(Math.max(0, 1 - t * t)));
      r(x, 24 - h, 1, h, PAL.sageLight);
      if (h > 1) r(x, 24 - h, 1, 1, '#d2e5c0');
    }
    [[20, 12], [40, 14], [30, 8], [48, 18], [14, 18]].forEach(([x, y]) => r(x, y, 2, 1, PAL.sage));
  });
  canvasTex(scene, 'hillWarm', 64, 22, ({ r }) => {
    for (let x = 0; x < 64; x++) {
      const t = (x - 32) / 32;
      const h = Math.round(22 * Math.sqrt(Math.max(0, 1 - t * t)));
      r(x, 22 - h, 1, h, '#e2ae84');
      if (h > 1) r(x, 22 - h, 1, 1, '#efc49f');
    }
  });
  // Distant rooftops for the venue garden.
  canvasTex(scene, 'roofs', 48, 20, ({ r }) => {
    const house = (x, w, h, roof) => {
      r(x, 20 - h, w, h, '#f1dcb8');
      for (let i = 0; i < Math.ceil(w / 2) + 1; i++) r(x - 1 + i, 20 - h - i, w + 2 - 2 * i, 1, roof);
      r(x + 2, 20 - h + 3, 2, 2, '#c9a24a');
    };
    house(2, 12, 8, '#c8704e');
    house(18, 10, 11, '#b4523a');
    house(32, 14, 7, '#c8704e');
  });

  // ---------------------------------------------------------------- collectibles
  // Wedding-ring "coins": 3 spin frames.
  canvasTex(scene, 'ring', 30, 10, ({ r, p }) => {
    // frame 0: full ring
    const g = PAL.goldLight; const d = PAL.goldDark; const m = PAL.gold;
    r(3, 2, 4, 1, g); r(2, 3, 1, 4, g); r(7, 3, 1, 4, m); r(3, 7, 4, 1, d); r(3, 1, 4, 1, PAL.white);
    p(4, 0, '#bfe8ff'); p(5, 0, '#bfe8ff'); p(4, 1, PAL.white);
    // frame 1: 3/4
    r(13, 2, 3, 1, g); r(12, 3, 1, 4, g); r(16, 3, 1, 4, m); r(13, 7, 3, 1, d); p(14, 1, '#bfe8ff');
    // frame 2: edge
    r(24, 2, 2, 6, m); r(24, 2, 1, 6, g); p(24, 1, '#bfe8ff');
  });
  const ringTex = scene.textures.get('ring');
  ringTex.add('r0', 0, 0, 0, 10, 10);
  ringTex.add('r1', 0, 10, 0, 10, 10);
  ringTex.add('r2', 0, 20, 0, 10, 10);

  canvasTex(scene, 'sparkle', 5, 5, ({ r }) => {
    r(2, 0, 1, 5, PAL.white); r(0, 2, 5, 1, PAL.white); r(2, 2, 1, 1, PAL.goldLight);
  });
  canvasTex(scene, 'dust', 4, 4, ({ r }) => { r(1, 0, 2, 4, PAL.ivory); r(0, 1, 4, 2, PAL.ivory); });

  // Surprise Box — an original wedding "mystery block": rose tile, gold studs,
  // a little ivory question mark; once bumped it turns into a plain warm tile
  // with a tiny heart. (Deliberately not modelled on any game's block art.)
  canvasTex(scene, 'mysteryBlock', 12, 12, ({ r }) => {
    r(0, 0, 12, 12, PAL.ink);
    r(1, 1, 10, 10, PAL.terraLight); r(1, 1, 10, 1, PAL.rose); r(1, 10, 10, 1, PAL.terraDark);
    r(1, 1, 1, 1, PAL.goldLight); r(10, 1, 1, 1, PAL.goldLight); r(1, 10, 1, 1, PAL.goldLight); r(10, 10, 1, 1, PAL.goldLight);
    r(4, 3, 4, 1, PAL.ivory); r(7, 4, 1, 2, PAL.ivory); r(5, 6, 2, 1, PAL.ivory); r(5, 8, 2, 1, PAL.ivory);
  });
  canvasTex(scene, 'mysteryUsed', 12, 12, ({ r }) => {
    r(0, 0, 12, 12, PAL.ink);
    r(1, 1, 10, 10, PAL.terraDark); r(1, 1, 10, 1, PAL.terracotta);
    r(1, 1, 1, 1, PAL.goldDark); r(10, 1, 1, 1, PAL.goldDark); r(1, 10, 1, 1, PAL.goldDark); r(10, 10, 1, 1, PAL.goldDark);
    r(4, 5, 1, 1, PAL.rose); r(7, 5, 1, 1, PAL.rose); r(4, 6, 4, 1, PAL.rose); r(5, 7, 2, 1, PAL.rose);
  });
  // tiny invitation card that pops out of it (rose band, gold seal)
  canvasTex(scene, 'inviteCard', 11, 8, ({ r }) => {
    r(0, 0, 11, 8, PAL.ink);
    r(1, 1, 9, 6, PAL.ivory); r(1, 1, 9, 2, PAL.terracotta); r(5, 4, 1, 1, PAL.goldLight); r(3, 5, 5, 1, PAL.ivoryShade);
  });

  // ---------------------------------------------------------------- props
  // Little desk calendar on a post (page reads "24").
  canvasTex(scene, 'calendar', 14, 30, ({ r }) => {
    r(6, 14, 2, 16, PAL.woodDark);
    r(0, 0, 14, 15, PAL.ink);
    r(1, 1, 12, 13, PAL.ivory);
    r(1, 1, 12, 4, PAL.brick);
    r(3, 0, 1, 2, PAL.goldLight); r(10, 0, 1, 2, PAL.goldLight);
    // "24" in 3×5 digits
    bitmap(r, ['111', '001', '111', '100', '111'], { 1: PAL.ink }, 3, 7);
    bitmap(r, ['101', '101', '111', '001', '001'], { 1: PAL.ink }, 8, 7);
  });
  // Treasure-map sign.
  canvasTex(scene, 'mapSign', 20, 30, ({ r, p }) => {
    r(9, 12, 2, 18, PAL.woodDark);
    r(0, 0, 20, 14, PAL.ink);
    r(1, 1, 18, 12, '#efdcb1');
    r(2, 3, 6, 1, PAL.sageDark); r(3, 6, 8, 1, PAL.water); r(10, 4, 1, 6, PAL.terracotta);
    r(12, 9, 4, 1, PAL.terracotta); r(5, 9, 3, 1, PAL.sageDark);
    p(15, 3, PAL.brick); p(16, 4, PAL.brick); p(15, 5, PAL.brick); p(17, 3, PAL.brick); p(17, 5, PAL.brick); p(16, 4, PAL.brick);
  });
  // Emote bubbles.
  const bubble = (key, glyph, color) => canvasTex(scene, key, 13, 13, ({ r }) => {
    r(1, 0, 11, 1, PAL.ink); r(1, 10, 11, 1, PAL.ink); r(0, 1, 1, 9, PAL.ink); r(12, 1, 1, 9, PAL.ink);
    r(1, 1, 11, 9, PAL.white);
    r(4, 11, 3, 1, PAL.ink); r(5, 12, 1, 1, PAL.ink); r(5, 10, 1, 1, PAL.white);
    bitmap(r, glyph, { 1: color }, 3, 2);
  });
  bubble('emoteExcl', ['  1  ', '  1  ', '  1  ', '     ', '  1  ', '     ', '     '], PAL.brick);
  bubble('emoteQ', [' 111 ', '1   1', '   1 ', '  1  ', '     ', '  1  ', '     '], PAL.ink);
  bubble('emoteDots', ['     ', '     ', '     ', '     ', '1 1 1', '     ', '     '], PAL.ink);
  bubble('emoteHeart', [' 1 1 ', '11111', '11111', ' 111 ', '  1  ', '     ', '     '], PAL.brick);
  bubble('emoteCheck', ['    1', '   11', '1 11 ', '111  ', ' 1   ', '     ', '     '], PAL.green);
  bubble('emoteSweat', ['   1 ', '  11 ', ' 111 ', ' 111 ', '  1  ', '     ', '     '], '#5aaed0');

  // Big green checkmark (Minh's approval).
  canvasTex(scene, 'checkBig', 11, 9, ({ r }) => {
    bitmap(r, [
      '         22',
      '        212',
      '       212 ',
      '22    212  ',
      '212  212   ',
      ' 212212    ',
      '  2112     ',
      '   22      ',
    ], { 1: PAL.green, 2: '#24632a' });
  });

  // Flag (ivory heart on terracotta) + pole cap.
  canvasTex(scene, 'flag', 16, 11, ({ r }) => {
    r(0, 0, 16, 11, PAL.terracotta);
    r(0, 10, 16, 1, PAL.terraDark);
    r(15, 0, 1, 11, PAL.terraDark);
    bitmap(r, [' 1 1 ', '11111', '11111', ' 111 ', '  1  '], { 1: PAL.ivory }, 6, 3);
  });
  // …and the plain finish flag it starts as (it turns into the heart flag after the RSVP)
  canvasTex(scene, 'flagPlain', 16, 11, ({ r }) => {
    r(0, 0, 16, 11, PAL.terracotta);
    for (let y = 0; y < 10; y += 2) for (let x = (y / 2) % 2 ? 2 : 0; x < 15; x += 4) r(x, y, 2, 2, PAL.ivory);
    r(0, 10, 16, 1, PAL.terraDark);
    r(15, 0, 1, 11, PAL.terraDark);
  });
  canvasTex(scene, 'poleCap', 6, 6, ({ r }) => {
    r(1, 0, 4, 6, PAL.goldLight); r(0, 1, 6, 4, PAL.goldLight); r(4, 1, 1, 4, PAL.goldDark); r(1, 1, 1, 1, PAL.white);
  });

  // Turtle, two walk frames (original: sage shell with ivory rim).
  ['turtle0', 'turtle1'].forEach((k, i) => canvasTex(scene, k, 16, 10, ({ r }) => {
    const shell = PAL.sage; const dk = PAL.sageDark;
    r(3, 1, 9, 1, PAL.sageDeep); r(2, 2, 11, 4, shell); r(1, 5, 13, 2, shell);
    r(4, 3, 2, 2, dk); r(8, 3, 2, 2, dk); r(6, 2, 2, 1, PAL.sageLight);
    r(1, 7, 13, 1, PAL.ivory);
    r(13, 4, 3, 3, '#b8c98a'); r(15, 4, 1, 1, PAL.ink);
    const legY = 8;
    if (i === 0) { r(2, legY, 2, 2, '#9fb571'); r(10, legY, 2, 2, '#9fb571'); }
    else { r(4, legY, 2, 2, '#9fb571'); r(12, legY, 2, 2, '#9fb571'); }
  }));
  // Butterfly, two frames.
  ['fly0', 'fly1'].forEach((k, i) => canvasTex(scene, k, 7, 5, ({ r }) => {
    r(3, 1, 1, 3, PAL.ink);
    if (i === 0) { r(0, 0, 3, 2, PAL.rose); r(4, 0, 3, 2, PAL.rose); r(1, 2, 2, 2, PAL.goldLight); r(4, 2, 2, 2, PAL.goldLight); }
    else { r(1, 1, 2, 2, PAL.rose); r(4, 1, 2, 2, PAL.rose); }
  }));

  // Garden arch (hedge) — 56 × 52; flowers are drawn on it except the one Thủy fixes.
  canvasTex(scene, 'arch', 56, 52, ({ r }) => {
    const leaf = PAL.sage; const dk = PAL.sageDark; const lt = PAL.sageLight;
    // posts
    r(2, 18, 9, 34, leaf); r(45, 18, 9, 34, leaf);
    r(2, 18, 2, 34, lt); r(52, 18, 2, 34, dk); r(9, 18, 2, 34, dk); r(45, 18, 2, 34, lt);
    // arch top (stepped semicircle)
    for (let x = 0; x < 56; x++) {
      const t = (x - 27.5) / 27.5;
      const top = Math.round(20 - 18 * Math.sqrt(Math.max(0, 1 - t * t)));
      const inner = x > 10 && x < 45 ? Math.round(22 - 12 * Math.sqrt(Math.max(0, 1 - ((x - 27.5) / 17) ** 2))) : 52;
      r(x, top, 1, Math.max(0, Math.min(inner, 52) - top), leaf);
      r(x, top, 1, 1, lt);
    }
    // flowers
    [[6, 22], [5, 34], [8, 44], [48, 24], [49, 38], [47, 46], [12, 9], [20, 4], [36, 4], [43, 10], [28, 2]]
      .forEach(([x, y], i) => {
        const c = i % 3 === 0 ? PAL.ivory : i % 3 === 1 ? PAL.rose : PAL.terraLight;
        r(x, y, 3, 3, c); r(x + 1, y + 1, 1, 1, PAL.goldLight);
      });
    [[16, 14], [40, 14], [24, 8]].forEach(([x, y]) => r(x, y, 2, 1, dk));
  });
  canvasTex(scene, 'archFlower', 5, 5, ({ r }) => {
    r(1, 0, 3, 5, PAL.rose); r(0, 1, 5, 3, PAL.rose); r(2, 2, 1, 1, PAL.goldLight); r(1, 1, 1, 1, '#f6c8c1');
  });
  // Tiny lantern for the fairy-light string.
  canvasTex(scene, 'bulb', 3, 3, ({ r }) => { r(0, 0, 3, 3, PAL.goldLight); r(1, 1, 1, 1, PAL.white); });

  // Bushes & flowers drawn side-on (match the brick world better than top-down sprites).
  canvasTex(scene, 'bush', 24, 12, ({ r }) => {
    r(3, 4, 18, 8, PAL.sage); r(0, 7, 24, 5, PAL.sage); r(7, 1, 10, 4, PAL.sage);
    r(7, 1, 10, 1, PAL.sageLight); r(3, 4, 4, 1, PAL.sageLight); r(0, 7, 3, 1, PAL.sageLight);
    r(0, 11, 24, 1, PAL.sageDark); r(15, 6, 2, 1, PAL.sageDark); r(8, 8, 2, 1, PAL.sageDark);
  });
  canvasTex(scene, 'flowers', 14, 8, ({ r }) => {
    [[1, 3, PAL.rose], [5, 1, PAL.ivory], [9, 3, PAL.terraLight], [12, 2, PAL.goldLight]].forEach(([x, y, c]) => {
      r(x + 1, y + 2, 1, 8 - y - 2, PAL.sageDark);
      r(x, y, 3, 2, c); r(x + 1, y - 1 < 0 ? 0 : y - 1, 1, 1, c);
    });
  });
  canvasTex(scene, 'tree', 26, 38, ({ r }) => {
    r(11, 22, 4, 16, PAL.woodDark); r(11, 22, 1, 16, PAL.wood);
    const blob = (x, y, w, h) => { r(x + 2, y, w - 4, h, PAL.sage); r(x, y + 2, w, h - 4, PAL.sage); };
    blob(2, 6, 22, 18); blob(5, 0, 16, 12);
    r(7, 0, 12, 1, PAL.sageLight); r(4, 6, 4, 1, PAL.sageLight); r(2, 8, 1, 6, PAL.sageLight);
    r(2, 21, 22, 1, PAL.sageDark); r(17, 12, 3, 2, PAL.sageDark); r(8, 15, 2, 2, PAL.sageDark);
    r(12, 5, 2, 2, PAL.rose); r(18, 9, 2, 2, PAL.ivory); r(6, 12, 2, 2, PAL.rose);
  });
  // ---------------------------------------------------------------- v2 collectibles & props
  // Collectible heart (7 × 6) with outline and shine.
  canvasTex(scene, 'heart', 7, 6, ({ r }) => {
    bitmap(r, [
      '.11.11.',
      '1221221',
      '1232221',
      '.12221.',
      '..121..',
      '...1...',
    ], { 1: '#7d2f22', 2: '#e2574c', 3: '#ffd0c8' });
  });
  canvasTex(scene, 'heartBit', 3, 3, ({ r }) => { bitmap(r, ['1.1', '111', '.1.'], { 1: '#ff8a7a' }); });

  // Secret photo coin (12 × 12): gold disc with an embossed camera.
  canvasTex(scene, 'photoCoin', 12, 12, ({ r }) => {
    bitmap(r, [
      '...1111...',
      '.11222211.',
      '1223333221',
      '1234444321',
      '1234554321',
      '1234554321',
      '1234444321',
      '1223333221',
      '.12222221.',
      '...1111...',
    ], { 1: '#6b4a12', 2: '#c9a24a', 3: '#ecc96a', 4: '#5e4415', 5: '#f8f0dd' }, 1, 1);
    r(4, 3, 2, 1, '#5e4415'); // camera top bump
    r(2, 1, 2, 1, '#fff7d8');
  });
  // Regular decorative coin (different: smaller, silver-gold star coin).
  canvasTex(scene, 'decoCoin', 8, 8, ({ r }) => {
    bitmap(r, [
      '..1111..',
      '.122221.',
      '12233221',
      '12333321',
      '12233221',
      '12322321',
      '.122221.',
      '..1111..',
    ], { 1: '#8f6a25', 2: '#ecc96a', 3: '#fffbe8' });
  });
  // Minh's notebook and map.
  canvasTex(scene, 'notebook', 7, 6, ({ r }) => {
    r(0, 0, 7, 6, '#3b2620'); r(1, 1, 5, 4, '#f8f0dd'); r(3, 0, 1, 6, '#b4523a');
    r(1, 2, 2, 1, '#9aa3a8'); r(4, 2, 2, 1, '#9aa3a8'); r(4, 4, 1, 1, '#9aa3a8');
  });
  canvasTex(scene, 'mapProp', 10, 7, ({ r }) => {
    r(0, 0, 10, 7, '#6b4529'); r(1, 1, 8, 5, '#efdcb1'); r(4, 1, 1, 5, '#d7c08f');
    r(2, 2, 2, 1, '#5d7f55'); r(6, 3, 2, 1, '#7cc3d8'); r(7, 4, 1, 1, '#b4523a'); r(2, 4, 1, 1, '#b4523a');
  });
  // Fork signpost: two blank arrows (left & right).
  canvasTex(scene, 'forkSign', 26, 30, ({ r }) => {
    r(12, 6, 2, 24, PAL.woodDark);
    bitmap(r, [
      '..111111111.',
      '.1222222221.',
      '122222222221',
      '.1222222221.',
      '..111111111.',
    ], { 1: PAL.woodDark, 2: PAL.wood }, 1, 4);
    bitmap(r, [
      '.111111111..',
      '.1222222221.',
      '122222222221',
      '.1222222221.',
      '.111111111..',
    ], { 1: PAL.woodDark, 2: '#c08b5c' }, 13, 12);
    r(4, 6, 6, 1, PAL.ivory); r(16, 14, 6, 1, PAL.ivory);
  });

  // A single tall flower (rotates around its base when it is crooked).
  canvasTex(scene, 'tallFlower', 9, 16, ({ r }) => {
    r(4, 6, 1, 10, PAL.sageDark); r(5, 10, 2, 1, PAL.sage); r(6, 9, 1, 1, PAL.sage); r(2, 12, 2, 1, PAL.sage);
    bitmap(r, ['..111..', '.12221.', '1223221', '.12221.', '..111..'], { 1: '#b8665c', 2: PAL.rose, 3: PAL.goldLight }, 1, 1);
  });
  // Arrow sign pointing left (towards the venue door).
  canvasTex(scene, 'arrowSign', 20, 26, ({ r }) => {
    r(11, 8, 2, 18, PAL.woodDark);
    bitmap(r, [
      '...1111111111111.',
      '..12222222222221.',
      '.122223222222221.',
      '12223333333322221',
      '.122223222222221.',
      '..12222222222221.',
      '...1111111111111.',
    ], { 1: PAL.woodDark, 2: '#c08b5c', 3: PAL.ivory }, 1, 1);
  });

  // ---------------------------------------------------------------- Great Drop bits
  canvasTex(scene, 'leaf', 4, 3, ({ r }) => { r(1, 0, 2, 1, PAL.sageLight); r(0, 1, 4, 1, PAL.sage); r(1, 2, 2, 1, PAL.sageDark); });
  canvasTex(scene, 'leafRose', 3, 3, ({ r }) => { r(1, 0, 1, 3, PAL.rose); r(0, 1, 3, 1, PAL.rose); r(1, 1, 1, 1, PAL.goldLight); });
  canvasTex(scene, 'mote', 2, 2, ({ r }) => { r(0, 0, 2, 2, '#ffe9a8'); r(0, 0, 1, 1, PAL.white); });
  canvasTex(scene, 'dustMote', 2, 2, ({ r }) => { r(0, 0, 2, 2, '#c9b8a6'); });
  canvasTex(scene, 'streak', 1, 10, ({ r }) => { r(0, 0, 1, 10, 'rgba(255,255,255,0.75)'); r(0, 0, 1, 3, 'rgba(255,255,255,0.35)'); });
  canvasTex(scene, 'shroom', 7, 6, ({ r }) => {
    r(1, 0, 5, 1, '#7fe0d6'); r(0, 1, 7, 2, '#56c2b8'); r(2, 1, 1, 1, '#d8fff9'); r(5, 2, 1, 1, '#d8fff9');
    r(3, 3, 1, 3, '#e6d7b8');
  });
  canvasTex(scene, 'glow', 16, 16, ({ ctx }) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(127,224,214,0.55)');
    g.addColorStop(1, 'rgba(127,224,214,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });

  // Small "RSVP" post sign.
  canvasTex(scene, 'postSign', 22, 26, ({ r }) => {
    r(10, 10, 2, 16, PAL.woodDark);
    r(0, 0, 22, 12, PAL.woodDark); r(1, 1, 20, 10, PAL.wood); r(1, 1, 20, 1, '#c08b5c');
  });
}
