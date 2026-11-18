/**
 * Deterministic level path.
 * ------------------------------------------------------------------
 * Everything in the level is a pure function of one number: the
 * progress `b` (in "progress units"), which comes straight from the
 * page's scroll position. Scrolling back simply evaluates the same
 * functions at a smaller `b`, so the whole level is reversible and
 * nothing depends on how fast the guest scrolls.
 *
 * Segments:
 *   run  — walk along a platform
 *   jump — ballistic hop from (x0,y0) to (x1,y1) with apex `h` above y0
 *   pipe — straight line, hidden inside a pipe
 *   fall — drop out of a pipe (accelerating)
 *   glide — the Gentle Glide: a small hop off a ledge, then a slow, swaying
 *           float out into open sky and back in, landing softly on (x1,y1)
 * `len` is how many progress units the segment takes (its pacing).
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
/** Mostly steady fall with a gentle start and a gentle (not hovering) finish. */
export const dropEase = (t) => 0.55 * t + 0.45 * smooth(t);

function jumpCoeffs(y0, y1, h) {
  const D = y1 - y0;
  let ta;
  if (Math.abs(D) < 1e-6) ta = 0.5;
  else ta = (-h + Math.sqrt(Math.max(0, h * h + D * h))) / D;
  ta = Math.min(0.95, Math.max(0.05, ta));
  const c = h / (ta * ta);
  return { a: -2 * c * ta, c };
}

export class LevelPath {
  constructor(segments) {
    let s = 0;
    this.segments = segments.map((seg) => {
      const out = { ...seg, start: s };
      if (seg.type === 'jump') Object.assign(out, jumpCoeffs(seg.y0, seg.y1, seg.h || 20));
      s += seg.len;
      out.end = s;
      return out;
    });
    this.length = s;
  }

  segAt(d) {
    const segs = this.segments;
    if (d <= 0) return segs[0];
    for (let i = 0; i < segs.length; i++) if (d < segs[i].end) return segs[i];
    return segs[segs.length - 1];
  }

  /** Start distance of the first segment with this id. */
  startOf(id) { return this.segments.find((s) => s.id === id).start; }
  endOf(id) { return this.segments.find((s) => s.id === id).end; }

  /** Distance along a run segment where x is reached. */
  dAtX(id, x) {
    const s = this.segments.find((g) => g.id === id);
    return s.start + ((x - s.x0) / (s.x1 - s.x0)) * s.len;
  }

  /** Position of a character at path distance d. */
  at(d) {
    const seg = this.segAt(d);
    const t = clamp01((d - seg.start) / seg.len);
    const dx = seg.x1 - seg.x0;
    const dir = dx > 0.01 ? 'right' : dx < -0.01 ? 'left' : null;
    let x = lerp(seg.x0, seg.x1, t);
    let y;
    switch (seg.type) {
      case 'jump': y = seg.y0 + seg.a * t + seg.c * t * t; break;
      case 'fall': y = seg.y0 + (seg.y1 - seg.y0) * t * t; break;
      case 'drop': {
        // The Great Drop: eases in (subtle acceleration) and out (slows before
        // landing, but not to a hover). x and y share the same easing, so the
        // fall line is straight and the camera (same curve) keeps them framed.
        const e = dropEase(t);
        x = lerp(seg.x0, seg.x1, e);
        y = lerp(seg.y0, seg.y1, e);
        break;
      }
      case 'glide': {
        // small confident hop (first quarter), then a light float down: the
        // descent eases in and slows toward touchdown without ever hovering
        const u = clamp01((t - 0.1) / 0.9);
        const e = 0.35 * u + 0.65 * smooth(u);
        y = lerp(seg.y0, seg.y1, e) - (seg.h || 0) * Math.sin(Math.PI * Math.min(1, t / 0.24));
        x = lerp(seg.x0, seg.x1, t)
          + (seg.out || 0) * Math.sin(Math.PI * t) // drift out into the open sky…
          + (seg.sway || 0) * Math.sin(4 * Math.PI * t) * Math.sin(Math.PI * t); // …swaying gently
        break;
      }
      default: y = lerp(seg.y0, seg.y1, t);
    }
    if (seg.type === 'pipe' || seg.type === 'fall') x = seg.x0;
    return { x, y, dir, type: seg.type, seg, t, airborne: seg.type === 'jump' || seg.type === 'fall' || seg.type === 'drop' || seg.type === 'glide' };
  }

  /**
   * Where the camera wants to look for path distance d:
   * focus = ground height, anchor = where that ground sits on screen (0..1).
   */
  focus(d) {
    const seg = this.segAt(d);
    const t = clamp01((d - seg.start) / seg.len);
    const f0 = seg.camFrom ?? seg.y0;
    const f1 = seg.camTo ?? seg.y1;
    const a0 = seg.anchorFrom ?? seg.anchor ?? 0.66;
    const a1 = seg.anchorTo ?? seg.anchor ?? 0.66;
    const e = seg.type === 'drop' ? dropEase(t) : smooth(t);
    return { y: lerp(f0, f1, e), anchor: lerp(a0, a1, e) };
  }
}

/**
 * Piecewise-linear map from progress b to a character's path distance.
 * keys: [[b, d], ...] sorted by b. Outside the keys the slope is 1, so the
 * character keeps walking at the guest's pace.
 */
export function keyed(keys, b) {
  if (!keys.length) return b;
  if (b <= keys[0][0]) return keys[0][1] - (keys[0][0] - b);
  for (let i = 1; i < keys.length; i++) {
    const [b1, d1] = keys[i];
    if (b <= b1) {
      const [b0, d0] = keys[i - 1];
      return lerp(d0, d1, (b - b0) / (b1 - b0));
    }
  }
  const [bl, dl] = keys[keys.length - 1];
  return dl + (b - bl);
}

/** 0..1 ramp of b between b0 and b1. */
export const ramp = (b, b0, b1) => clamp01((b - b0) / (b1 - b0));
