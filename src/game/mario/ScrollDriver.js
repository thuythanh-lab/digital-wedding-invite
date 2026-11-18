/**
 * Scroll-to-play: a transparent, natively scrolling layer above the canvas.
 * Its scrollTop is the single input that drives the level (momentum, wheel,
 * keyboard and scrollbars all work for free). The canvas never scrolls; the
 * Phaser scene reads `value` every frame and renders the level for it.
 */
export class ScrollDriver {
  constructor() {
    this.el = document.getElementById('scroller');
    this.spacer = document.getElementById('scroll-spacer');
    this._anim = 0;
    this._cancelAnim = () => this.stopAnimation();
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((ev) =>
      this.el.addEventListener(ev, this._cancelAnim, { passive: true }));
  }

  get value() { return this.el.scrollTop; }

  get max() { return Math.max(0, this.el.scrollHeight - this.el.clientHeight); }

  /** Scrollable distance in CSS px (the spacer adds one screen of height). */
  setLength(px) {
    this.spacer.style.height = `${Math.round(px) + this.el.clientHeight}px`;
  }

  /** Re-apply the length after the frame changes size. */
  refresh(px) { this.setLength(px); }

  enable(on) {
    this.el.classList.toggle('is-locked', !on);
    if (on) this.el.focus({ preventScroll: true });
  }

  stopAnimation() {
    cancelAnimationFrame(this._anim);
    this._anim = 0;
  }

  /** Eased programmatic scroll; any guest input cancels it. */
  animateTo(px, ms = 1200) {
    this.stopAnimation();
    const from = this.el.scrollTop;
    const to = Math.max(0, Math.min(px, this.max));
    if (ms <= 0 || Math.abs(to - from) < 2) {
      this.el.scrollTop = to;
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
      this.el.scrollTop = from + (to - from) * e;
      if (k < 1) this._anim = requestAnimationFrame(step);
      else this._anim = 0;
    };
    this._anim = requestAnimationFrame(step);
  }
}
