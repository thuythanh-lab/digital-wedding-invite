// Visual constants shared by every scene.

export const FONT_TITLE = 'Handjet';
export const FONT_BODY = 'VT323';

/**
 * Phaser measures text height from a sample string. Vietnamese stacks tone
 * marks above circumflexes (Ệ, Ể, Ẫ), so include them or the tops get clipped.
 */
export const TEXT_METRICS_SAMPLE = 'ỆỂẪỖẶ|Ẩgjpqy';

export const COLORS = {
  // Night sky, top → horizon
  sky: ['#04071a', '#070c24', '#0b1331', '#111b42', '#18244f', '#22305e', '#2e3b6b'],
  horizonGlow: '#3a3f73',
  mountainFar: 0x232d5e,
  mountainNear: 0x19224f,
  treeFar: 0x121a42,
  treeMid: 0x0b112e,
  treeNear: 0x050816,
  rim: 0x1b275a,

  gold: 0xf5cf73,
  goldSoft: 0xffe3a3,
  starCore: 0xfff6d8,
  moon: 0xe9ecff,
  firefly: 0xffd36b,

  ink: '#f3e6c0',
  inkDim: '#b9b39a',
  inkGold: '#f5cf73',
  shadow: '#05081a',

  // Dialogue frame
  frameDark: 0x0b0f22,
  frameLight: 0xe9dcb5,
  frameGold: 0xc9a253,
  frameFill: 0x121936,

  // Forest lighting
  forestAmbient: 0x283268,
  moonlight: 0x8da2e6,
  starLight: 0xffcf7a,
  mushroomLight: 0x7fe0d6,
  canopy: 0x070d16,
};

export const DEPTH = {
  sky: 0,
  stars: 5,
  moon: 8,
  mountains: 10,
  treesFar: 20,
  mist: 25,
  treesMid: 30,
  treesNear: 40,
  fireflies: 50,
  ground: 0,
  world: 100,
  light: 5000,
  glow: 5100,
  foreground: 6000,
  ui: 10000,
};
