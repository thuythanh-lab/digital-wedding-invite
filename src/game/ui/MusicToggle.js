import { STRINGS } from '../config/strings.vi.js';

/**
 * The music toggle is a real DOM <button>: always tappable, keyboard
 * accessible, and positioned with CSS safe-area insets.
 */
export class MusicToggle {
  constructor(el, sound) {
    this.el = el;
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.toggleMute();
    });
    // Stop taps on the button from also reaching the game canvas.
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    sound.onChange((muted) => {
      el.setAttribute('aria-pressed', String(!muted));
      el.setAttribute('aria-label', muted ? STRINGS.ui.musicOff : STRINGS.ui.musicOn);
      el.title = muted ? STRINGS.ui.musicOff : STRINGS.ui.musicOn;
    });
  }
}

export function showMusicToggle() {
  const el = document.getElementById('music-toggle');
  if (el) el.hidden = false;
}
