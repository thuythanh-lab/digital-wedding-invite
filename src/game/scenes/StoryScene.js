import Phaser from 'phaser';
import { COLORS } from '../config/theme.js';
import { viewport, fitCamera } from '../utils/viewport.js';
import { refreshTextResolution } from '../utils/text.js';
import { DialogueBox } from '../ui/DialogueBox.js';
import { SceneScript } from '../systems/SceneScript.js';
import { CameraDirector } from '../systems/CameraDirector.js';
import { soundManager } from '../audio/SoundManager.js';

export const ART = 2; // logical units per art pixel in story worlds

/**
 * Base for narrative scenes (Chapter I onward).
 * Provides: a world layer drawn by a 2× camera, a UI layer drawn by a 1×
 * camera, a dialogue box, vignette, full-screen cover for fades, an iris
 * wipe, a CameraDirector and a SceneScript guard, plus resize handling.
 */
export class StoryScene extends Phaser.Scene {
  setupStage(worldW, worldH, { bg = '#0b1410', vignette = 0.85 } = {}) {
    this.worldSize = { w: worldW, h: worldH };
    this.world = this.add.layer();
    this.ui = this.add.layer();
    this.uiCam = this.cameras.add(0, 0, 1, 1, false, 'ui');
    this.cameras.main.ignore(this.ui);
    this.uiCam.ignore(this.world);
    this.cameras.main.setBackgroundColor(bg);
    this.script = new SceneScript(this);
    this.director = new CameraDirector(this, this.cameras.main, this.worldSize);
    this.uiTexts = [];
    this.busy = false;

    this.dialogue = new DialogueBox(this, this.ui);
    this.uiTexts.push(...this.dialogue.texts);
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(vignette);
    this.ui.add(this.vignette);
    this.ui.bringToTop(this.dialogue.container);
    this.cover = this.add.rectangle(0, 0, 10, 10, COLORS.canopy).setOrigin(0).setAlpha(1).setDepth(100);
    this.iris = this.add.graphics().setDepth(101).setVisible(false);
    this.ui.add([this.cover, this.iris]);

    // Taps go to the dialogue first (complete / close).
    this.input.on('pointerdown', () => {
      soundManager.unlock();
      this.dialogue.handleTap();
    });

    this.applyLayout(viewport.layout);
    this.onLayout = (l) => this.applyLayout(l);
    viewport.on('change', this.onLayout);
    this.events.once('shutdown', () => viewport.off('change', this.onLayout));
    this.events.on('update', (t, dt) => this.dialogue.update(dt));
  }

  applyLayout(L) {
    this.L = L;
    fitCamera(this.cameras.main, L, ART);
    fitCamera(this.uiCam, L, 1);
    this.dialogue.layout(L);
    this.vignette.setDisplaySize(L.width, L.height);
    this.cover.setSize(L.width, L.height + 2);
    this.director.refresh();
    refreshTextResolution(this.uiTexts);
    this.onLayoutChanged?.(L);
  }

  /** Short line of narration; resolves when the guest dismisses it. */
  say(line) {
    return this.script.guard(this.dialogue.say(line));
  }

  fadeIn(ms = 900, color = COLORS.canopy) {
    this.cover.setFillStyle(color).setAlpha(1);
    return this.script.tween({ targets: this.cover, alpha: 0, duration: ms, ease: 'Sine.easeOut' });
  }

  fadeOut(ms = 900, color = COLORS.canopy) {
    this.cover.setFillStyle(color);
    return this.script.tween({ targets: this.cover, alpha: 1, duration: ms, ease: 'Sine.easeIn' });
  }

  /** World point → UI (logical screen) point. */
  toScreen(x, y) {
    const cam = this.cameras.main;
    return { x: (x - cam.scrollX) * ART, y: (y - cam.scrollY) * ART };
  }

  /**
   * Iris wipe centred on a world point: closes (1 → 0) or opens (0 → 1).
   * Drawn as a very thick ring, so it works on every renderer.
   */
  irisWipe(worldX, worldY, close = true, ms = 700) {
    const L = this.L;
    const maxR = Math.hypot(L.width, L.height);
    const g = this.iris.setVisible(true);
    const p = { r: close ? maxR : 0 };
    const draw = () => {
      const c = this.toScreen(worldX, worldY);
      const thick = maxR * 2;
      g.clear();
      g.lineStyle(thick, COLORS.canopy, 1);
      g.strokeCircle(c.x, c.y, p.r + thick / 2);
    };
    draw();
    return this.script.tween({
      targets: p, r: close ? 0 : maxR, duration: ms, ease: close ? 'Sine.easeIn' : 'Sine.easeOut',
      onUpdate: draw,
    }).then(() => {
      if (!close) g.setVisible(false);
    });
  }
}
