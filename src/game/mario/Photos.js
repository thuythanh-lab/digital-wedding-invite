import { soundManager } from '../audio/SoundManager.js';
import { MARIO_TEXT as T } from '../config/mario.vi.js';

/**
 * Three secret photo coins → three wedding photos.
 *
 * Put the real photos in  public/assets/photos/  as
 *   wedding-photo-01.jpg · wedding-photo-02.jpg · wedding-photo-03.jpg
 * (≈1200 px on the long side, JPEG quality ~80 keeps each under ~250 KB).
 * Photos are only downloaded when a guest opens one. Until a file exists the
 * viewer shows an honest "coming soon" card — never a stand-in picture.
 *
 * Discovery is remembered in this browser only (localStorage) and is never
 * sent to the RSVP backend.
 */
// Relative URLs (no leading "/") so they also work under a GitHub Pages sub-path.
// Originals: public/assets/images/*.png (01 Golden Hour Lift in the Garden ·
// 02 Golden-Hour Wedding Embrace · 03 Handmade Wedding Collage for Thủy and Minh).
export const PHOTOS = [
  { id: 1, src: 'assets/photos/wedding-photo-01.jpg', thumb: 'assets/photos/wedding-photo-01-thumb.jpg', hint: T.photoHint1 },
  { id: 2, src: 'assets/photos/wedding-photo-02.jpg', thumb: 'assets/photos/wedding-photo-02-thumb.jpg', hint: T.photoHint2 },
  { id: 3, src: 'assets/photos/wedding-photo-03.jpg', thumb: 'assets/photos/wedding-photo-03-thumb.jpg', hint: T.photoHint3 },
];

const KEY = 'mt.photos.v1';
const pad = (n) => String(n).padStart(2, '0');

function load() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return new Set(Array.isArray(arr) ? arr.filter((n) => [1, 2, 3].includes(n)) : []);
  } catch {
    return new Set();
  }
}

export class PhotoBook {
  constructor({ scroller, onChange }) {
    this.scroller = scroller;
    this.onChange = onChange;
    this.found = load();
    this.isOpen = false;
    this.modal = document.getElementById('photo-modal');
    this.gallery = document.getElementById('gallery');
    this.img = this.modal.querySelector('img');
    this.missing = this.modal.querySelector('.pm-missing');
    this.title = this.modal.querySelector('.pm-title');
    this.sub = this.modal.querySelector('.pm-sub');
    this.modal.querySelector('.pm-close').addEventListener('click', () => this.close());
    this.gallery.querySelector('.gl-close').addEventListener('click', () => this.closeGallery());
    [this.modal, this.gallery].forEach((el) => {
      el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); el === this.modal ? this.close() : this.closeGallery(); } });
      // Taps on the dimmed backdrop never reach the game.
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
    });
    this.img.addEventListener('load', () => { this.img.hidden = false; this.missing.hidden = true; });
    this.img.addEventListener('error', () => { this.img.hidden = true; this.missing.hidden = false; });
  }

  get count() { return this.found.size; }

  has(id) { return this.found.has(id); }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify([...this.found])); } catch { /* private mode */ }
    this.onChange?.(this.count);
  }

  /** Called when a secret coin is tapped. */
  discover(id) {
    if (!this.found.has(id)) {
      this.found.add(id);
      this.save();
    }
    this.show(id, T.photoFound);
  }

  show(id, heading) {
    const p = PHOTOS[id - 1];
    this.title.textContent = heading;
    this.sub.textContent = T.photoMoment(pad(id));
    this.img.hidden = true;
    this.missing.hidden = true;
    this.img.alt = T.photoMoment(pad(id));
    this.img.removeAttribute('src');
    this.img.src = p.src; // lazy: requested only now
    this.lock(true);
    this.modal.hidden = false;
    this.modal.querySelector('.pm-close').focus({ preventScroll: true });
  }

  close() {
    this.modal.hidden = true;
    soundManager.sfx('select');
    if (this.gallery.hidden) this.lock(false);
    else this.gallery.querySelector('.gl-close').focus({ preventScroll: true });
  }

  /** Gallery: found photos + mystery tiles. `atEnd` lets guests unlock the rest. */
  openGallery(atEnd) {
    const grid = this.gallery.querySelector('.gl-grid');
    grid.textContent = '';
    PHOTOS.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gl-tile';
      const found = this.has(p.id);
      const num = document.createElement('span');
      num.className = 'gl-num';
      num.textContent = `#${pad(p.id)}`;
      if (found) {
        btn.classList.add('is-found');
        btn.setAttribute('aria-label', T.photoMoment(pad(p.id)));
        // the found photo itself, as a small thumbnail (loaded only when the gallery opens)
        const th = document.createElement('img');
        th.className = 'gl-thumb';
        th.alt = '';
        th.decoding = 'async';
        th.loading = 'lazy';
        th.src = p.thumb;
        btn.append(th, num);
        btn.addEventListener('click', () => this.show(p.id, T.photoMoment(pad(p.id))));
      } else {
        btn.setAttribute('aria-label', `${T.photoLocked} — ${p.hint}`);
        const q = document.createElement('span');
        q.className = 'gl-q';
        q.textContent = '?';
        const hint = document.createElement('span');
        hint.className = 'gl-hint';
        hint.textContent = p.hint;
        btn.append(q, num, hint);
        btn.addEventListener('click', () => {
          if (!atEnd) return;
          this.found.add(p.id);
          this.save();
          soundManager.sfx('photoCoin');
          this.openGallery(atEnd);
          this.show(p.id, T.photoGift);
        });
      }
      grid.append(btn);
    });
    this.gallery.querySelector('.gl-count').textContent = T.photoCount(this.count);
    this.gallery.querySelector('.gl-note').textContent = this.count < 3 ? (atEnd ? T.photoUnlockNote : T.photoHintNote) : '';
    this.lock(true);
    this.gallery.hidden = false;
    this.gallery.querySelector('.gl-close').focus({ preventScroll: true });
  }

  closeGallery() {
    this.gallery.hidden = true;
    soundManager.sfx('select');
    this.lock(false);
  }

  lock(on) {
    this.isOpen = on;
    // overflow:hidden keeps scrollTop, so the guest returns to the exact spot.
    this.scroller.el.classList.toggle('is-locked', on);
    if (!on) this.scroller.el.focus({ preventScroll: true });
  }
}
