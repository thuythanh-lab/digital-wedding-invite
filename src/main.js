import Phaser from 'phaser';

// Fonts with full Vietnamese coverage, self-hosted (no external requests).
import '@fontsource/vt323/latin-400.css';
import '@fontsource/vt323/latin-ext-400.css';
import '@fontsource/vt323/vietnamese-400.css';
import '@fontsource/handjet/latin-600.css';
import '@fontsource/handjet/latin-ext-600.css';
import '@fontsource/handjet/vietnamese-600.css';
// Highly readable Vietnamese face for the essential wedding information.
import '@fontsource/be-vietnam-pro/latin-500.css';
import '@fontsource/be-vietnam-pro/latin-ext-500.css';
import '@fontsource/be-vietnam-pro/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/latin-700.css';
import '@fontsource/be-vietnam-pro/latin-ext-700.css';
import '@fontsource/be-vietnam-pro/vietnamese-700.css';

import './styles.css';
import { createGameConfig } from './game/config/gameConfig.js';
import { viewport } from './game/utils/viewport.js';
import { soundManager } from './game/audio/SoundManager.js';
import { MusicToggle } from './game/ui/MusicToggle.js';
import { FONT_BODY, FONT_TITLE } from './game/config/theme.js';
import { LevelScene } from './game/scenes/LevelScene.js';

async function loadFonts() {
  // Ask for the actual Vietnamese glyph ranges so the right subsets are fetched.
  const sample = 'MINH THỦY ĐỊA ĐIỂM SẴN SÀNG CHƯA HOÀN THÀNH ẤẦẨẪẬ ỞỚỜỢ';
  const tasks = [`600 48px "${FONT_TITLE}"`, `400 24px "${FONT_BODY}"`, '500 16px "Be Vietnam Pro"', '700 16px "Be Vietnam Pro"'].map((f) =>
    document.fonts.load(f, sample).catch(() => null),
  );
  // Never block the game for more than ~2.5 s on a slow connection.
  await Promise.race([Promise.all(tasks), new Promise((r) => setTimeout(r, 2500))]);
}

async function boot() {
  const layout = viewport.start();
  await loadFonts();

  // Development-only tools (?preview=characters | forest). The DEV branch is
  // removed from production builds, so guests never receive this code.
  let scenes = [LevelScene];
  const preview = new URLSearchParams(window.location.search).get('preview');
  if (import.meta.env.DEV && preview) {
    const [{ DEV_SCENES }, { BootScene }] = await Promise.all([
      import('./game/dev/devScenes.js'),
      import('./game/scenes/BootScene.js'),
    ]);
    scenes = [BootScene, ...DEV_SCENES];
    document.getElementById('scroller')?.remove();
  }

  const game = new Phaser.Game(createGameConfig(layout, scenes));
  window.__game = game; // handy for debugging in the browser console
  if (import.meta.env.DEV) window.__sound = soundManager; // dev-only, for audio tests

  viewport.on('change', (l) => {
    game.scale.resize(l.pixelW, l.pixelH);
    game.scale.setZoom(1 / l.dpr);
  });

  soundManager.attach(game);
  new MusicToggle(document.getElementById('music-toggle'), soundManager);
  // small, non-intrusive "bật âm thanh" button if the browser keeps sound off
  const soundHint = document.getElementById('sound-hint');
  if (soundHint) {
    soundManager.onProblem((problem) => { soundHint.hidden = !problem; });
    soundHint.addEventListener('pointerdown', (e) => e.stopPropagation());
    soundHint.addEventListener('click', (e) => { e.stopPropagation(); soundManager.retry(); });
  }
}

/**
 * On-screen keyboard (RSVP name field): only the HTML overlay adapts — the
 * game canvas, camera and current screen are left alone (viewport.js freezes
 * its layout while a field has focus).
 *
 * Works for both kinds of mobile browser: iOS Safari keeps the window size and
 * shrinks/pans the *visual* viewport; Messenger/Facebook's in-app browser
 * shrinks the window itself. Either way we measure which part of the game
 * frame is actually visible and expose it as CSS variables:
 *   --kb       px of the frame hidden below the visible area (under the keyboard)
 *   --kb-room  px of the frame that is visible
 * Event-driven (focus, visualViewport resize/scroll, window resize): no timers.
 */
function trackKeyboard() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  const field = () => {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && a.closest('#rsvp, #info-modal') ? a : null;
  };
  const update = () => {
    const input = field();
    const frame = document.getElementById('frame');
    if (!input || !frame) {
      root.classList.remove('kb-open');
      root.style.removeProperty('--kb');
      root.style.removeProperty('--kb-room');
      return;
    }
    const fr = frame.getBoundingClientRect();
    const visTop = Math.max(fr.top, vv ? vv.offsetTop : 0);
    const visBottom = Math.min(fr.bottom, vv ? vv.offsetTop + vv.height : window.innerHeight);
    root.style.setProperty('--kb', `${Math.round(Math.max(0, fr.bottom - visBottom))}px`);
    root.style.setProperty('--kb-room', `${Math.round(Math.max(180, visBottom - visTop))}px`);
    root.classList.add('kb-open');
    // keep the field itself in view inside its (now scrollable) panel — never
    // scrollIntoView, which would also scroll the game frame
    const panel = input.closest('#rsvp, .pm-box');
    if (panel) {
      const pr = panel.getBoundingClientRect(); const ir = input.getBoundingClientRect();
      if (ir.bottom > pr.bottom - 8) panel.scrollTop += ir.bottom - pr.bottom + 8;
      else if (ir.top < pr.top + 8) panel.scrollTop -= pr.top + 8 - ir.top;
    }
  };
  vv?.addEventListener('resize', update);
  vv?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', () => setTimeout(update, 0)); // after focus has moved on
  update();
}

trackKeyboard();
boot();
