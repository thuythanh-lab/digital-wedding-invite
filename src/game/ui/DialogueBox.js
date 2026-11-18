import { COLORS } from '../config/theme.js';
import { makeText } from '../utils/text.js';
import { drawPixelFrame, drawPixelArrowDown } from './PixelFrame.js';
import { soundManager } from '../audio/SoundManager.js';

const CHAR_MS = 38;

/**
 * Classic RPG dialogue box, anchored to the bottom safe area.
 * Tap while typing → finish the line instantly. Tap when done → close.
 * Lives in logical UI coordinates (360 × H); add it to a UI layer.
 */
export class DialogueBox {
  constructor(scene, layer) {
    this.scene = scene;
    this.layer = layer;
    this.container = scene.add.container(0, 0).setAlpha(0).setVisible(false);
    layer?.add(this.container);
    this.bg = scene.add.graphics();
    this.arrow = scene.add.graphics();
    this.text = makeText(scene, 0, 0, '', {
      fontSize: '24px',
      color: COLORS.ink,
      lineSpacing: 4,
    });
    this.text.setShadow(0, 2, '#05081a', 0, false, true);
    this.container.add([this.bg, this.text, this.arrow]);

    this.full = '';
    this.shown = 0;
    this.typing = false;
    this.open = false;
    this.acc = 0;
    this.resolve = null;
    this.blinkT = 0;
  }

  layout(L) {
    const p = 2;
    const side = 10;
    const x = side + L.safe.left;
    const w = L.width - x - side - L.safe.right;
    const h = 104;
    const bottom = L.height - Math.max(L.safe.bottom, 6) - 12;
    const y = bottom - h;
    this.box = { x, y, w, h };

    this.bg.clear();
    drawPixelFrame(this.bg, x, y, w, h, {
      p,
      layers: [
        { color: COLORS.frameDark },
        { color: COLORS.frameLight },
        { color: COLORS.frameGold },
        { color: COLORS.frameDark },
        { color: COLORS.frameFill, alpha: 0.96 },
      ],
    });
    // Inner sheen line.
    this.bg.fillStyle(0xffffff, 0.05);
    this.bg.fillRect(x + p * 6, y + p * 5, w - p * 12, p);

    const pad = 20;
    this.text.setPosition(x + pad, y + 18);
    this.text.setWordWrapWidth(w - pad * 2, true);
    this.arrowPos = { x: x + w - 22, y: y + h - 20 };
    this.drawArrow(0);
  }

  drawArrow(offset) {
    this.arrow.clear();
    drawPixelArrowDown(this.arrow, this.arrowPos.x, this.arrowPos.y + offset, 2, COLORS.gold);
  }

  /** Show a line; resolves when the player dismisses it. */
  say(line) {
    this.full = line;
    this.shown = 0;
    this.acc = 0;
    this.typing = true;
    this.open = true;
    this.text.setText('');
    this.arrow.setVisible(false);
    this.container.setVisible(true);
    this.container.y = 10;
    soundManager.sfx('dialog');
    this.scene.tweens.add({ targets: this.container, alpha: 1, y: 0, duration: 260, ease: 'Sine.easeOut' });
    return new Promise((r) => { this.resolve = r; });
  }

  /** Returns true if the tap was consumed by the dialogue. */
  handleTap() {
    if (!this.open) return false;
    if (this.typing) {
      this.shown = this.full.length;
      this.text.setText(this.full);
      this.finishTyping();
      return true;
    }
    this.close();
    return true;
  }

  finishTyping() {
    this.typing = false;
    this.arrow.setVisible(true);
  }

  close() {
    this.open = false;
    soundManager.sfx('select', { volume: 0.25 });
    this.scene.tweens.add({
      targets: this.container, alpha: 0, y: 8, duration: 220, ease: 'Sine.easeIn',
      onComplete: () => {
        this.container.setVisible(false);
        const r = this.resolve;
        this.resolve = null;
        r?.();
      },
    });
  }

  update(dt) {
    if (this.typing) {
      this.acc += dt;
      let changed = false;
      while (this.acc >= CHAR_MS && this.shown < this.full.length) {
        this.acc -= CHAR_MS;
        this.shown += 1;
        changed = true;
        const ch = this.full[this.shown - 1];
        // Pause a little longer on punctuation; quiet blip every few letters.
        if (ch === ',' || ch === '.') this.acc -= CHAR_MS * 2;
        if (this.shown % 3 === 0 && ch !== ' ') soundManager.sfx('blip');
      }
      if (changed) this.text.setText(this.full.slice(0, this.shown));
      if (this.shown >= this.full.length) this.finishTyping();
    }
    if (this.arrow.visible) {
      this.blinkT += dt;
      const off = Math.round((Math.sin(this.blinkT / 180) + 1) * 1.5);
      this.drawArrow(off);
    }
  }

  get texts() {
    return [this.text];
  }
}
