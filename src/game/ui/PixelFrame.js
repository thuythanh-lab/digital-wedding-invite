/**
 * Draws a pixel-art frame (stepped corners, layered borders) into a Graphics
 * object, using logical units. `p` is the size of one "art pixel".
 */
export function drawPixelFrame(g, x, y, w, h, { p = 2, layers }) {
  layers.forEach(({ color, alpha = 1 }, i) => {
    const ix = x + i * p;
    const iy = y + i * p;
    const iw = w - i * p * 2;
    const ih = h - i * p * 2;
    if (iw <= p * 2 || ih <= p * 2) return;
    g.fillStyle(color, alpha);
    // Two overlapping rects = a rectangle with 1-pixel stepped corners.
    g.fillRect(ix + p, iy, iw - p * 2, ih);
    g.fillRect(ix, iy + p, p, ih - p * 2);
    g.fillRect(ix + iw - p, iy + p, p, ih - p * 2);
  });
}

/** Small downward triangle (the classic "more text" marker). */
export function drawPixelArrowDown(g, cx, cy, p, color) {
  g.fillStyle(color, 1);
  g.fillRect(cx - p * 2, cy, p * 5, p);
  g.fillRect(cx - p, cy + p, p * 3, p);
  g.fillRect(cx, cy + p * 2, p, p);
}
