// Image registry + hand-measured frame rectangles for the Fantasy Lands sheets.
// Rectangles are [x, y, w, h] tight bounding boxes (measured from alpha).

const FL = 'assets/images/fantasy-lands/';

export const IMAGES = {
  bigTrees: FL + 'big-trees.png',
  smallTrees: FL + 'small-trees.png',
  bushes: FL + 'bushes.png',
  bushesBerries: FL + 'bushes-berries.png',
  grass: FL + 'grass.png',
  redFlowers: FL + 'red-flowers.png',
  mushrooms: FL + 'brown-mushrooms.png',
  rocks: FL + 'rocks.png',
  logs: FL + 'tree-logs.png',
  stumps: FL + 'tree-stumps.png',
  sticks: FL + 'sticks.png',
  groundShadow: FL + 'ground-shadow.png',
};

const range = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

export const FRAMES = {
  bigTrees: {
    ...Object.fromEntries(range(8, (i) => [`green${i}`, [3 + 32 * i, 1, 23, 31]])),
    ...Object.fromEntries(range(8, (i) => [`autumn${i}`, [3 + 32 * i, 33, 23, 31]])),
    pine: [7, 72, 19, 35],
    bare: [39, 73, 19, 34],
  },
  smallTrees: {
    ...Object.fromEntries(range(8, (i) => [`green${i}`, [6 + 32 * i, 7, 20, 21]])),
    ...Object.fromEntries(range(8, (i) => [`autumn${i}`, [6 + 32 * i, 39, 20, 21]])),
    pine: [5, 67, 21, 25],
    bare: [39, 68, 17, 24],
  },
  bushes: {
    big: [0, 1, 16, 13], bigAutumn: [32, 0, 16, 13],
    small: [2, 21, 12, 7], smallAutumn: [34, 20, 12, 7],
    wide: [7, 35, 18, 9], wideAutumn: [39, 34, 18, 9],
  },
  bushesBerries: { big: [0, 1, 16, 13], small: [2, 21, 12, 7], wide: [7, 35, 18, 9] },
  grass: {
    tuft: [3, 4, 9, 8], tuftB: [35, 4, 9, 8],
    low: [4, 22, 9, 5], lowB: [36, 22, 9, 5],
    sprigs: [0, 38, 13, 6], sprigsB: [32, 38, 13, 6],
    scatter: [0, 48, 16, 16], scatterB: [32, 48, 16, 16],
  },
  redFlowers: { single: [6, 21, 3, 7], pair: [18, 17, 9, 13], bunch: [32, 12, 16, 20] },
  mushrooms: { one: [6, 7, 3, 3], few: [18, 4, 12, 10], cluster: [33, 3, 14, 13] },
  rocks: {
    pebbles: [3, 6, 8, 6], mid: [19, 5, 10, 7], big: [33, 2, 14, 13],
    pebblesB: [3, 19, 10, 9], midB: [19, 19, 10, 9], tall: [34, 19, 13, 10],
  },
  logs: { short: [1, 7, 14, 4], shortV: [22, 1, 4, 14], tallV: [37, 2, 6, 28], long: [2, 21, 28, 6] },
  stumps: { a: [4, 7, 7, 4], b: [21, 5, 6, 6], c: [4, 22, 7, 5], d: [21, 20, 6, 7] },
  sticks: { a: [5, 6, 4, 6], b: [20, 4, 9, 8], c: [34, 2, 12, 13] },
};
