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

  viewport.on('change', (l) => {
    game.scale.resize(l.pixelW, l.pixelH);
    game.scale.setZoom(1 / l.dpr);
  });

  soundManager.attach(game);
  new MusicToggle(document.getElementById('music-toggle'), soundManager);
}

/**
 * On-screen keyboard: browsers that only shrink the *visual* viewport (iOS
 * Safari) would hide the bottom-anchored RSVP box behind the keyboard. Expose
 * the covered height as --kb so the box can sit just above it.
 */
function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    const open = kb > 40;
    document.documentElement.style.setProperty('--kb', `${open ? Math.round(kb) : 0}px`);
    document.documentElement.classList.toggle('kb-open', open);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}

trackKeyboard();
boot();
