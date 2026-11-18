import { submitRsvp } from './rsvp.js';
import { soundManager } from '../audio/SoundManager.js';
import { MARIO_TEXT as T } from '../config/mario.vi.js';

/**
 * Retro RPG-style RSVP dialogue box (DOM, so it is accessible, keyboard- and
 * touch-friendly and never blurry). It opens by itself when Minh & Thủy reach
 * the RSVP spot. A blinking ▶ cursor marks the selected answer (the first one
 * by default). Success is only reported after the backend confirms. Sending
 * and error messages replace the question line, so the box never grows over
 * the couple; after a failure the chosen answer is marked ↻ THỬ LẠI (retry).
 */
export class RsvpDialog {
  /**
   * @param root   the element holding .dlg-text, .dlg-name and .dlg-choice buttons
   *               (the in-game #rsvp box, or the RSVP part of the quick view)
   * @param inline true for the quick view: no typing effect, no sound cue
   */
  constructor({ root, guest, reducedMotion, onConfirmed, inline = false }) {
    this.guest = guest;
    this.reducedMotion = reducedMotion || inline;
    this.inline = inline;
    this.onConfirmed = onConfirmed;
    this.el = root || document.getElementById('rsvp');
    this.textEl = this.el.querySelector('.dlg-text');
    this.nameRow = this.el.querySelector('.dlg-name');
    this.nameInput = this.el.querySelector('.dlg-name input');
    this.buttons = [...this.el.querySelectorAll('.dlg-choice')];
    this.busy = false;
    this.visible = false;
    this._typeTimer = 0;

    this.nameRow.hidden = !!guest.name;
    this.buttons.forEach((btn, i) => {
      btn.textContent = btn.dataset.answer === 'yes' ? T.rsvpYes : T.rsvpNo;
      btn.dataset.retry = T.rsvpRetryTag;
      btn.addEventListener('click', () => this.choose(btn.dataset.answer === 'yes'));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.select((i + (e.key === 'ArrowDown' ? 1 : this.buttons.length - 1)) % this.buttons.length, true);
        }
      });
      btn.addEventListener('pointerenter', () => this.select(i, false));
      btn.addEventListener('focus', () => this.select(i, false));
    });
  }

  question() {
    const n = this.guest.name || this.nameInput.value.trim();
    return n ? T.rsvpQuestion(n) : T.rsvpQuestionAnon;
  }

  /** Show a message in the question line (sending / error), without typing. */
  say(str, error = false) {
    clearTimeout(this._typeTimer);
    this.textEl.textContent = str;
    this.el.classList.toggle('is-error', error);
  }

  /** Move the ▶ cursor (and focus, for keyboard users). */
  select(i, focus) {
    this.sel = i;
    this.buttons.forEach((b, k) => b.classList.toggle('is-selected', k === i));
    if (focus) this.buttons[i].focus({ preventScroll: true });
  }

  /** Height of the open box in CSS px (measured invisibly, with the full question). */
  measure() {
    const el = this.el;
    const was = { hidden: el.hidden, vis: el.style.visibility, text: this.textEl.textContent };
    el.hidden = false;
    el.style.visibility = 'hidden';
    // reserve room for the longer of the question and the error message
    const h = Math.max(...[this.question(), T.rsvpError].map((str) => {
      this.textEl.textContent = str;
      return el.offsetHeight;
    })) || 230;
    this.textEl.textContent = was.text;
    el.style.visibility = was.vis;
    el.hidden = was.hidden;
    return h;
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.el.hidden = false;
    this.el.classList.remove('is-error');
    this.buttons.forEach((b) => b.classList.remove('is-retry'));
    this.setBusy(false);
    this.select(0, false);
    if (!this.inline) soundManager.sfx('dialog');
    this.type(this.question());
    void this.el.offsetWidth; // commit the closed state, then animate open (no rAF dependency)
    this.el.classList.add('is-open');
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.el.classList.remove('is-open');
    clearTimeout(this._typeTimer);
    if (this.el.contains(document.activeElement)) document.activeElement.blur();
    this.el.hidden = true;
  }

  /** Short typewriter effect (skipped with reduced motion). */
  type(str) {
    clearTimeout(this._typeTimer);
    if (this.reducedMotion) {
      this.textEl.textContent = str;
      return;
    }
    let i = 0;
    const step = () => {
      i += 2;
      this.textEl.textContent = str.slice(0, i);
      if (i < str.length) this._typeTimer = setTimeout(step, 22);
    };
    step();
  }

  setBusy(b) {
    this.busy = b;
    this.buttons.forEach((btn) => { btn.disabled = b; });
    this.nameInput.disabled = b;
    this.el.classList.toggle('is-busy', b);
  }

  async choose(attending) {
    if (this.busy) return;
    soundManager.unlock();
    const name = this.guest.name || this.nameInput.value.trim();
    if (!name) {
      this.say(T.rsvpNeedName, true);
      this.nameInput.focus();
      soundManager.sfx('bump');
      return;
    }
    this.select(attending ? 0 : 1, false);
    this.buttons.forEach((b) => b.classList.remove('is-retry'));
    soundManager.sfx('select');
    this.setBusy(true);
    this.say(T.rsvpSending);
    try {
      const record = await submitRsvp({ name, id: this.guest.id, attending });
      // confirmed by the backend: say so briefly (buttons stay disabled), then go on
      const [title, line] = attending ? T.rsvpSavedYes : T.rsvpSavedNo;
      clearTimeout(this._typeTimer);
      this.textEl.replaceChildren(Object.assign(document.createElement('strong'), { textContent: title }), ' ', line);
      this.el.classList.remove('is-busy', 'is-error');
      this.el.classList.add('is-saved');
      await new Promise((r) => setTimeout(r, this.inline ? 900 : 1300));
      this.el.classList.remove('is-saved');
      this.setBusy(false);
      this.hide();
      this.onConfirmed?.(record);
    } catch (e) {
      console.warn('[rsvp] not saved:', e?.code, e?.message);
      this.say(e?.code === 'not-configured' ? T.rsvpNotConfigured : T.rsvpError, true);
      soundManager.sfx('bump');
      this.setBusy(false);
      if (e?.code !== 'not-configured') this.buttons[attending ? 0 : 1].classList.add('is-retry');
    }
  }
}
