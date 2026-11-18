/**
 * Scroll pacing: maps the guest's scroll position (CSS px) ↔ level progress b.
 *
 * Why not one constant? Equal scroll per progress unit made the camera drop
 * through the Secret Pipe ~40× faster per pixel than the walking parts, and
 * let the whole level fit in less than one screen of scrolling. Instead:
 *
 *  1. Each SECTION gets a scroll budget in "screens" (one screen = the phone's
 *     height at load, clamped), so a normal swipe moves a predictable share of
 *     the story on every phone.
 *  2. INSIDE a section, scroll is distributed by how much actually moves on
 *     screen (camera + characters, sampled from the deterministic level), with
 *     a floor so poses/reading beats still advance. Visual speed per pixel is
 *     therefore roughly even within a section — no teleporting, no dead zones.
 *  3. A short moving average smooths sensitivity changes at section edges.
 *
 * The table is built once at load from a pure function of b, so it never
 * changes while the guest scrolls (mobile address-bar resizes don't move them).
 */
export class ScrollPace {
  /**
   * @param sections [{ id, label, kind: 'move'|'info', b0, b1, screens }]
   * @param motionAt (b0, b1) → on-screen motion between two progress values
   * @param screenPx  px of one "screen" for this device (fixed at load)
   */
  constructor({ sections, motionAt, screenPx, step = 0.5, smoothB = 2 }) {
    this.sections = sections;
    this.step = step;
    const bEnd = sections[sections.length - 1].b1;
    const n = Math.ceil(bEnd / step);
    const motion = new Float64Array(n);
    for (let i = 0; i < n; i++) motion[i] = motionAt(i * step, Math.min(bEnd, (i + 1) * step));
    const px = new Float64Array(n); // px for each step, before smoothing
    const range = (sec) => [Math.round(sec.b0 / step), Math.min(n, Math.round(sec.b1 / step))];
    this.range = range;
    sections.forEach((sec) => {
      const [i0, i1] = range(sec);
      let sum = 0;
      for (let i = i0; i < i1; i++) sum += motion[i];
      const mean = sum / Math.max(1, i1 - i0);
      // reading sections keep a generous floor (poses at the calendar, the
      // flower fix, the RSVP spot), movement sections a small one
      // (absolute minimum too, so one tiny camera nudge can't take a still section's whole budget)
      const floor = Math.max(mean * (sec.kind === 'info' ? 0.7 : 0.25), sec.kind === 'info' ? 0.4 : 0.15);
      let wsum = 0;
      for (let i = i0; i < i1; i++) wsum += motion[i] + floor;
      const budget = sec.screens * screenPx;
      for (let i = i0; i < i1; i++) px[i] = budget * (motion[i] + floor) / wsum;
    });
    // gentle smoothing of sensitivity, then re-normalise each section budget
    const w = Math.round(smoothB / step);
    const sm = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let a = 0; let c = 0;
      for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) { a += px[j]; c++; }
      sm[i] = a / c;
    }
    sections.forEach((sec) => {
      const [i0, i1] = range(sec);
      let a = 0; let b = 0;
      for (let i = i0; i < i1; i++) { a += px[i]; b += sm[i]; }
      for (let i = i0; i < i1; i++) sm[i] *= a / (b || 1);
    });
    this.cum = new Float64Array(n + 1); // cum[i] = px at b = i·step
    for (let i = 0; i < n; i++) this.cum[i + 1] = this.cum[i] + sm[i];
    this.perStep = sm;
    this.motion = motion;
    this.bEnd = bEnd;
  }

  /** Scroll position (px) for progress b. */
  pxAt(b) {
    const x = Math.max(0, Math.min(this.bEnd, b)) / this.step;
    const i = Math.min(this.cum.length - 2, Math.floor(x));
    return this.cum[i] + (this.cum[i + 1] - this.cum[i]) * (x - i);
  }

  /** Progress b for scroll position px (inverse, binary search). */
  bAt(px) {
    const c = this.cum;
    if (px <= 0) return 0;
    if (px >= c[c.length - 1]) return this.bEnd;
    let lo = 0; let hi = c.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (c[mid] <= px) lo = mid; else hi = mid; }
    const span = c[hi] - c[lo] || 1;
    return (lo + (px - c[lo]) / span) * this.step;
  }

  sectionAt(b) {
    return this.sections.find((s) => b >= s.b0 && b < s.b1) || this.sections[this.sections.length - 1];
  }

  /** On-screen motion per scroll pixel at b (logical units / px) — for the debug overlay. */
  unitsPerPx(b) {
    const i = Math.max(0, Math.min(this.perStep.length - 1, Math.floor(b / this.step)));
    return this.motion[i] / (this.perStep[i] || 1);
  }

  /** Per-section summary: px, share of a screen, average and peak motion per px. */
  report(screenPx) {
    return this.sections.map((s) => {
      const [i0, i1] = this.range(s);
      let px = 0; let mo = 0; let peak = 0;
      for (let i = i0; i < i1; i++) { px += this.perStep[i]; mo += this.motion[i]; peak = Math.max(peak, this.motion[i] / this.perStep[i]); }
      return { section: s.label, kind: s.kind, px: Math.round(px), screens: +(px / screenPx).toFixed(2), avgUnitsPerPx: +(mo / px).toFixed(2), peakUnitsPerPx: +peak.toFixed(2) };
    });
  }
}
