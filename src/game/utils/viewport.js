import Phaser from 'phaser';

/**
 * Responsive viewport system
 * ---------------------------------------------------------------
 * Design reference: 360 × 640 logical units (9:16).
 *
 *  - The logical WORLD WIDTH is always 360 units.
 *  - The visible logical HEIGHT follows the device aspect ratio
 *    (≈640 on 9:16, ≈780 on modern 19.5:9 phones). Scenes extend their
 *    environments vertically and keep key content in a central band.
 *  - The canvas is rendered at full device-pixel resolution and each scene
 *    camera is zoomed by `zoom` (device px per logical unit), so pixel art
 *    stays sharp and Vietnamese text renders crisply at any DPR.
 *  - On wide screens (desktop, tablets, landscape) the game is shown as a
 *    centred phone-shaped column of at most 440 CSS px.
 */

export const WORLD_W = 360;
const FRAMED_MAX_W = 430;
const PHONE_MAX_ASPECT = 0.7; // width / height; anything wider is "framed"
const MAX_DPR = 3;

function readSafeArea() {
  const probe = document.getElementById('safe-probe');
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = getComputedStyle(probe);
  const n = (v) => parseFloat(v) || 0;
  return {
    top: n(cs.paddingTop),
    right: n(cs.paddingRight),
    bottom: n(cs.paddingBottom),
    left: n(cs.paddingLeft),
  };
}

function isTouchDevice() {
  return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
}

/** A text field has focus — on phones the on-screen keyboard is (about to be) open. */
export function editingText() {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
}

/**
 * PHYSICAL orientation of the device. Never width > height of the window: an
 * open keyboard (Messenger / Facebook in-app browsers shrink the window) makes a
 * portrait phone look "landscape".
 */
export function physicalLandscape() {
  if (typeof window.orientation === 'number') return Math.abs(window.orientation) === 90; // iOS, older Android
  const t = window.screen?.orientation?.type;
  if (t) return t.startsWith('landscape');
  const sw = window.screen?.width; const sh = window.screen?.height;
  if (sw && sh) return sw > sh;
  return window.innerWidth > window.innerHeight;
}

class ViewportManager extends Phaser.Events.EventEmitter {
  constructor() {
    super();
    this.layout = null;
    this._raf = 0;
    this._tallest = {}; // tallest window height seen per width (the keyboard only ever shrinks it)
    this._onResize = () => {
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => this.update());
    };
  }

  /** Compute the layout for the current window without applying it. */
  measure() {
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    const touch = isTouchDevice();
    this._tallest[vw] = Math.max(this._tallest[vw] || 0, vh);
    const landscape = touch && physicalLandscape();
    // phones in portrait always fill the screen; aspect decides only for
    // desktops / tablets and is judged on the un-shrunk height
    const framed = landscape || (vw / this._tallest[vw] > PHONE_MAX_ASPECT);

    let cssW;
    let cssH;
    if (!framed) {
      cssW = vw;
      cssH = vh;
    } else {
      // Leave breathing room around the floating column on large screens.
      const margin = !touch && vh > 720 ? 24 : 0;
      cssH = vh - margin * 2;
      cssW = Math.min(Math.round(cssH * 9 / 16), FRAMED_MAX_W, vw);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const pixelW = Math.round(cssW * dpr);
    const pixelH = Math.round(cssH * dpr);
    const zoom = pixelW / WORLD_W; // device pixels per logical unit
    const viewH = pixelH / zoom; // visible logical height
    const cssToLogical = WORLD_W / cssW;

    // Safe areas only matter when the game touches the physical screen edges.
    const safeCss = framed ? { top: 0, right: 0, bottom: 0, left: 0 } : readSafeArea();
    const safe = {
      top: safeCss.top * cssToLogical,
      right: safeCss.right * cssToLogical,
      bottom: safeCss.bottom * cssToLogical,
      left: safeCss.left * cssToLogical,
    };

    return {
      cssW,
      cssH,
      dpr,
      pixelW,
      pixelH,
      zoom,
      width: WORLD_W,
      height: viewH,
      safe,
      safeCss,
      framed,
      landscapePhone: landscape,
      cssToLogical,
    };
  }

  /** Apply CSS sizing for the frame and notify listeners. */
  update() {
    const prev = this.layout;
    // Keyboard open: keep the game exactly as it is (no re-layout, no camera
    // move, no rotate hint). The RSVP box adapts to the visible area on its own.
    if (editingText()) { this._kbW = window.innerWidth; if (prev) return prev; }
    // …and while it is still closing (the field blurs first, the window grows
    // back a moment later): stay frozen until the height is restored or the
    // width changes (a real rotation)
    if (prev && this._kbW) {
      const w = window.innerWidth;
      if (w === this._kbW && window.innerHeight < (this._tallest[w] || 0) - 160) return prev;
      this._kbW = 0;
    }
    const l = this.measure();
    this.layout = l;

    const root = document.documentElement;
    root.style.setProperty('--frame-w', `${l.cssW}px`);
    root.style.setProperty('--frame-h', `${l.cssH}px`);
    root.style.setProperty('--safe-top', `${l.safeCss.top}px`);
    root.style.setProperty('--safe-right', `${l.safeCss.right}px`);
    root.style.setProperty('--safe-bottom', `${l.safeCss.bottom}px`);
    root.style.setProperty('--safe-left', `${l.safeCss.left}px`);
    document.body.classList.toggle('is-framed', l.framed && !l.landscapePhone);

    const hint = document.getElementById('rotate-hint');
    if (hint) hint.hidden = !l.landscapePhone || editingText();

    const changed =
      !prev || prev.pixelW !== l.pixelW || prev.pixelH !== l.pixelH || prev.dpr !== l.dpr ||
      prev.safe.top !== l.safe.top || prev.safe.bottom !== l.safe.bottom;
    // address bars / toolbars only change the height a little: scenes keep their framing
    l.heightOnly = !!prev && prev.cssW === l.cssW && prev.framed === l.framed && Math.abs(prev.cssH - l.cssH) < 160;
    if (changed) this.emit('change', l, prev);
    return l;
  }

  start() {
    // (no visualViewport listener: keyboard, pinch-zoom and toolbar changes of the
    // *visible* area must not re-layout the game)
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    window.screen?.orientation?.addEventListener?.('change', this._onResize);
    // keyboard closed: apply whatever changed meanwhile (e.g. a real rotation)
    document.addEventListener('focusout', () => setTimeout(this._onResize, 0));
    return this.update();
  }
}

export const viewport = new ViewportManager();

/**
 * Configure a camera so that logical (0,0) is the top-left of the screen and
 * one logical unit = `layout.zoom * mult` device pixels.
 */
export function fitCamera(camera, layout, mult = 1) {
  camera.setOrigin(0, 0);
  camera.setSize(layout.pixelW, layout.pixelH);
  camera.setZoom(layout.zoom * mult);
}
