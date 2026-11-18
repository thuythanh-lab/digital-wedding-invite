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

class ViewportManager extends Phaser.Events.EventEmitter {
  constructor() {
    super();
    this.layout = null;
    this._raf = 0;
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
    const framed = vw / vh > PHONE_MAX_ASPECT;

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
      landscapePhone: touch && vw > vh,
      cssToLogical,
    };
  }

  /** Apply CSS sizing for the frame and notify listeners. */
  update() {
    const prev = this.layout;
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
    if (hint) hint.hidden = !l.landscapePhone;

    const changed =
      !prev || prev.pixelW !== l.pixelW || prev.pixelH !== l.pixelH || prev.dpr !== l.dpr ||
      prev.safe.top !== l.safe.top || prev.safe.bottom !== l.safe.bottom;
    if (changed) this.emit('change', l, prev);
    return l;
  }

  start() {
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    window.visualViewport?.addEventListener('resize', this._onResize);
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
