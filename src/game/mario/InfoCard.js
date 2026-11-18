import { WEDDING } from '../config/event.vi.js';
import { MARIO_TEXT as T } from '../config/mario.vi.js';
import { RsvpDialog } from './RsvpDialog.js';

/**
 * Essential wedding information, always generated from the config
 * (event.vi.js), in this order of importance:
 *   names · TIỆC CƯỚI · time + weekday · date · venue · address · 📍 map.
 * Real HTML text (Be Vietnam Pro for the facts), so Vietnamese diacritics stay
 * crisp and screen readers can read it.
 */
export function fillInfoCard(el, { full = false } = {}) {
  const w = WEDDING;
  el.replaceChildren();
  const add = (tag, cls, text, attrs = {}) => {
    const n = document.createElement(tag);
    n.className = cls;
    if (text != null) n.textContent = text;
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    el.append(n);
    return n;
  };
  add('span', 'ic-tag', w.eventName);
  add(full ? 'h2' : 'p', 'ic-names', w.couple, full ? { id: 'qv-title' } : {});
  add('p', 'ic-time', `${w.time} · ${w.weekday}`);
  add('p', 'ic-date', w.date);
  add('p', 'ic-venue', w.venueName);
  add('p', 'ic-addr', w.venueAddress);
  if (full && w.venueFloor) add('p', 'ic-floor', w.venueFloor);
  if (w.mapUrl) {
    add('a', 'px-btn ic-map', T.mapButton, {
      href: w.mapUrl, target: '_blank', rel: 'noopener noreferrer', 'aria-label': T.mapButtonLabel,
    });
  }
  return el;
}

/**
 * "XEM THÔNG TIN THIỆP": a compact, readable summary for guests who would
 * rather not play — names, date, time, venue, map, and the same RSVP as the
 * game (same backend, same "only after it is saved" rule). Opening/closing it
 * never touches the game's scroll position.
 */
export class QuickView {
  constructor({ guest, reducedMotion, getAnswer, onConfirmed, onPlay, onPhotos, isStarted, photoCount }) {
    this.el = document.getElementById('info-modal');
    this.getAnswer = getAnswer;
    this.onPlay = onPlay;
    this.onPhotos = onPhotos;
    this.isStarted = isStarted;
    this.photoCount = photoCount;
    this.opener = null;
    fillInfoCard(this.el.querySelector('.qv-card'), { full: true });
    this.done = this.el.querySelector('.qv-done');
    this.doneText = this.el.querySelector('.qv-done-text');
    this.playBtn = this.el.querySelector('.qv-play');
    this.photosBtn = this.el.querySelector('.qv-photos');
    this.rsvp = new RsvpDialog({
      root: this.el.querySelector('.qv-rsvp'),
      guest,
      reducedMotion,
      inline: true,
      onConfirmed: (rec) => { onConfirmed(rec); this.renderAnswer(); },
    });
    this.el.querySelector('.qv-change').addEventListener('click', () => {
      this.done.hidden = true;
      this.rsvp.show();
      this.rsvp.select(0, true);
    });
    this.playBtn.addEventListener('click', () => { this.close(); this.onPlay(); });
    this.photosBtn.addEventListener('click', () => { this.close(false); this.onPhotos(); });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
    // tap on the dim backdrop closes it
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
  }

  get isOpen() { return !this.el.hidden; }

  renderAnswer() {
    const a = this.getAnswer();
    if (a) {
      this.rsvp.hide();
      this.done.hidden = false;
      this.doneText.textContent = a.attending ? T.answeredYes : T.answeredNo;
    } else {
      this.done.hidden = true;
      this.rsvp.show();
    }
  }

  open(opener) {
    this.opener = opener || document.activeElement;
    this.playBtn.textContent = this.isStarted() ? T.quickBack : T.quickPlay;
    this.photosBtn.textContent = T.quickPhotos(this.photoCount());
    this.photosBtn.hidden = !this.isStarted();
    this.el.hidden = false;
    this.el.querySelector('.pm-box').scrollTop = 0;
    this.renderAnswer();
    this.el.querySelector('.ic-names').setAttribute('tabindex', '-1');
    this.el.querySelector('.ic-names').focus({ preventScroll: true });
  }

  close(restoreFocus = true) {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.rsvp.hide();
    if (restoreFocus) this.opener?.focus?.({ preventScroll: true });
  }
}
