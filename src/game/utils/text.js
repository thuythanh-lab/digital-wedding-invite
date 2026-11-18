import { FONT_BODY, TEXT_METRICS_SAMPLE } from '../config/theme.js';
import { viewport } from './viewport.js';

/**
 * Text that stays sharp under camera zoom: the glyphs are rasterised at
 * (logical size × zoom), i.e. at real device resolution.
 */
export function makeText(scene, x, y, str, style = {}, zoomMult = 1) {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT_BODY,
    fontSize: '20px',
    color: '#f3e6c0',
    testString: TEXT_METRICS_SAMPLE,
    padding: { top: 4, bottom: 2, left: 2, right: 2 },
    ...style,
  });
  const z = (viewport.layout?.zoom || 1) * zoomMult;
  t.setResolution(Math.min(z, 6));
  return t;
}

/** Re-rasterise texts after a zoom change. */
export function refreshTextResolution(texts, zoomMult = 1) {
  const z = (viewport.layout?.zoom || 1) * zoomMult;
  texts.forEach((t) => t?.active && t.setResolution(Math.min(z, 6)));
}
