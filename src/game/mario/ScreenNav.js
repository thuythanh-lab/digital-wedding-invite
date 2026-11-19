/**
 * ONE SWIPE = ONE SCREEN.
 *
 * The single input layer for screen navigation (replaces scroll-to-play).
 * It listens on the transparent #scroller layer above the canvas, which no
 * longer scrolls natively, so there is one handler and no momentum to fight:
 *
 *  - touch: one vertical swipe (≥ 40 px, mostly vertical) = one step
 *  - mouse wheel / trackpad: one gesture = one step; the rest of that gesture,
 *    including trackpad inertia, is ignored until the wheel goes quiet
 *  - keyboard (when the game has focus): ↓ PageDown Space = next, ↑ PageUp = previous
 *  - DOM buttons (#screen-nav): ▲ / ▼ and one dot per screen — the accessible fallback
 *
 * Taps still reach the layer as clicks (secret coins, HUD), because a swipe
 * that moved is never a click.
 */
export class ScreenNav {
  constructor({ el, count, labels, onNext, onPrev, onGo, onTap }) {
    this.el = el;
    this.count = count;
    this.onNext = onNext;
    this.onPrev = onPrev;
    this.onGo = onGo;
    this.onTap = onTap;
    this.lastTouchEnd = -1e9;
    this.enabled = false;
    this.acc = 0;
    this.lastWheel = 0;
    this.wheelLocked = false;

    el.addEventListener('touchstart', (e) => {
      if (!this.enabled || e.touches.length !== 1) { this.ts = null; return; }
      const t = e.touches[0];
      this.ts = { x: t.clientX, y: t.clientY, t: performance.now() };
    }, { passive: true });
    // no native scrolling / bounce on the game layer (pinch-zoom stays allowed via CSS)
    el.addEventListener('touchmove', (e) => { if (this.enabled && e.cancelable) e.preventDefault(); }, { passive: false });
    // A finger gesture is decided ONCE, here: a swipe (one page) or a tap
    // (handled right away, without waiting for — or also getting — the
    // browser's emulated click, which is cancelled).
    el.addEventListener('touchend', (e) => {
      if (!this.enabled || !this.ts) return;
      const t = e.changedTouches[0];
      const dy = t.clientY - this.ts.y; const dx = t.clientX - this.ts.x;
      const dt = performance.now() - this.ts.t;
      const slow = dt > 1000;
      this.ts = null;
      this.lastTouchEnd = performance.now();
      const dist = Math.hypot(dx, dy);
      const swipe = !(Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx) * 1.2 || (slow && Math.abs(dy) < 90));
      if (swipe) { if (dy < 0) this.onNext(); else this.onPrev(); return; }
      if (dist <= 24 && dt < 800) { // a tap (a little finger wobble is fine)
        if (e.cancelable) e.preventDefault();
        this.onTap?.(t.clientX, t.clientY, dist);
      }
    }, { passive: false });
    // mouse (desktop): a click is a tap; clicks that only echo a touch are ignored
    el.addEventListener('click', (e) => {
      if (!this.enabled || performance.now() - this.lastTouchEnd < 800) return;
      this.onTap?.(e.clientX, e.clientY, 0);
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.enabled) return;
      const now = performance.now();
      const newGesture = now - this.lastWheel > 240;
      this.lastWheel = now;
      if (newGesture) { this.wheelLocked = false; this.acc = 0; }
      if (this.wheelLocked) return; // still the same flick (or its inertia)
      this.acc += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      if (Math.abs(this.acc) >= 45) {
        const dir = Math.sign(this.acc);
        this.acc = 0;
        this.wheelLocked = true;
        if (dir > 0) this.onNext(); else this.onPrev();
      }
    }, { passive: false });

    el.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key)) { e.preventDefault(); this.onNext(); }
      if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); this.onPrev(); }
    });

    // accessible buttons
    this.ui = document.getElementById('screen-nav');
    this.prevBtn = this.ui.querySelector('.sn-prev');
    this.nextBtn = this.ui.querySelector('.sn-next');
    const dots = this.ui.querySelector('.sn-dots');
    this.dots = labels.map((label, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sn-dot';
      b.setAttribute('aria-label', label);
      b.addEventListener('click', () => this.enabled && this.onGo(i));
      dots.append(b);
      return b;
    });
    this.prevBtn.addEventListener('click', () => this.enabled && this.onPrev());
    this.nextBtn.addEventListener('click', () => this.enabled && this.onNext());
  }

  enable(on) {
    this.enabled = on;
    this.el.style.touchAction = on ? 'pinch-zoom' : '';
  }

  /** Reflect the current screen in the indicator; `show` hides it (e.g. under the RSVP box). */
  setState(index, { show = true, busy = false } = {}) {
    this.ui.hidden = !show;
    this.dots.forEach((d, i) => {
      d.classList.toggle('is-on', i === index);
      if (i === index) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
    });
    this.prevBtn.disabled = index <= 0;
    this.nextBtn.disabled = index >= this.count - 1;
    this.ui.classList.toggle('is-busy', busy);
  }
}
