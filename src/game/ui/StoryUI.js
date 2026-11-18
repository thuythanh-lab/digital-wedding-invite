import Phaser from 'phaser';
import { COLORS, FONT_TITLE } from '../config/theme.js';
import { makeText } from '../utils/text.js';
import { drawPixelFrame } from './PixelFrame.js';
import { soundManager } from '../audio/SoundManager.js';

/** Small chapter heading that fades in and out near the top (UI layer). */
export function showChapterCard(scene, small, big) {
  const L = scene.L;
  const c = scene.add.container(L.width / 2, L.safe.top + 78).setAlpha(0);
  const a = makeText(scene, 0, -16, small, { fontSize: '17px', color: '#c9c3a6' }).setOrigin(0.5);
  const b = makeText(scene, 0, 8, big, {
    fontFamily: FONT_TITLE, fontStyle: '600', fontSize: '30px', color: COLORS.inkGold,
    padding: { top: 10, bottom: 4, left: 4, right: 4 },
  }).setOrigin(0.5);
  [a, b].forEach((t) => t.setShadow(0, 2, '#05081a', 0, false, true));
  const rule = scene.add.graphics();
  rule.fillStyle(COLORS.gold, 0.7);
  rule.fillRect(-64, 30, 48, 2);
  rule.fillRect(16, 30, 48, 2);
  const gem = scene.add.image(0, 31, 'star-core').setTint(0xffe7b0);
  c.add([a, b, rule, gem]);
  scene.ui.add(c);
  scene.uiTexts.push(a, b);
  scene.tweens.add({ targets: c, alpha: 1, duration: 900, yoyo: true, hold: 1700, ease: 'Sine.easeInOut',
    onComplete: () => c.destroy() });
}

/**
 * World-space speech bubble ("Khám phá?") drawn in art pixels so it matches
 * the pixel art; text rasterised at device resolution.
 */
export class PromptBubble {
  constructor(scene, layer, x, y, text, art = 2) {
    this.c = scene.add.container(x, y).setDepth(5600).setAlpha(0);
    const t = makeText(scene, 0, -1, text, { fontSize: '11px', color: '#2a1c30', padding: { top: 3, bottom: 1, left: 1, right: 1 } }, art)
      .setOrigin(0.5);
    const w = Math.ceil(t.width) + 12;
    const h = 14;
    const g = scene.add.graphics();
    drawPixelFrame(g, -w / 2, -h / 2 - 1, w, h, { p: 1, layers: [{ color: 0x2a1c30 }, { color: 0xfbf6ec }] });
    g.fillStyle(0x2a1c30, 1).fillRect(-1, h / 2 - 1, 3, 1).fillRect(0, h / 2, 1, 2);
    g.fillStyle(0xfbf6ec, 1).fillRect(0, h / 2 - 1, 1, 1);
    this.c.add([g, t]);
    layer.add(this.c);
    this.scene = scene;
    this.text = t;
  }

  show() {
    this.scene.tweens.add({ targets: this.c, alpha: 1, y: this.c.y - 2, duration: 400, ease: 'Back.easeOut' });
    this.bob = this.scene.tweens.add({ targets: this.c, y: '-=1.5', duration: 900, yoyo: true, repeat: -1, delay: 400, ease: 'Sine.easeInOut' });
  }

  hide() {
    this.bob?.stop();
    this.scene.tweens.add({ targets: this.c, alpha: 0, duration: 250, onComplete: () => this.c.destroy() });
  }
}

/** Little emote bubble above a character's head: 'bang' (!) or 'dots' (…). */
export function emote(scene, layer, character, kind = 'bang', ms = 900) {
  const s = scene.add.image(character.x + 6, character.y - 31, `emote-${kind}`)
    .setOrigin(0.5, 1).setDepth(5650).setScale(0.2);
  layer.add(s);
  scene.tweens.add({ targets: s, scale: 1, duration: 220, ease: 'Back.easeOut' });
  scene.time.delayedCall(ms, () => scene.tweens.add({ targets: s, alpha: 0, duration: 200, onComplete: () => s.destroy() }));
  return s;
}

/**
 * Item discovery presentation (UI layer, logical units): the item rises in a
 * burst of light, a banner names it, and a tap continues.
 */
export class ItemDiscovery {
  constructor(scene) {
    this.scene = scene;
  }

  show({ textureKey, title, name, hint }) {
    const scene = this.scene;
    const L = scene.L;
    const cx = L.width / 2;
    const cy = L.height * 0.4;
    const root = scene.add.container(0, 0).setDepth(90);
    scene.ui.add(root);
    scene.ui.bringToTop(root);

    const dim = scene.add.rectangle(0, 0, L.width, L.height + 2, 0x05070f).setOrigin(0).setAlpha(0);
    const rays = scene.add.container(cx, cy);
    for (let i = 0; i < 10; i++) {
      rays.add(scene.add.image(0, 0, 'beam').setOrigin(0.5, 0).setDisplaySize(26, 170)
        .setAngle(i * 36).setTint(COLORS.goldSoft).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD));
    }
    rays.setScale(0.2).setAlpha(0);
    const halo = scene.add.image(cx, cy, 'glow').setScale(1.6).setTint(0xffd98a).setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    // Pixel-perfect: an integer number of device pixels per item pixel.
    const devicePx = Math.max(4, Math.round(6 * L.zoom));
    const item = scene.add.image(cx, cy + 30, textureKey).setScale(devicePx / L.zoom).setAlpha(0);

    const bw = Math.min(L.width - 40, 300);
    const by = cy + 96;
    const frame = scene.add.graphics();
    drawPixelFrame(frame, cx - bw / 2, by - 34, bw, 76, {
      p: 2, layers: [{ color: COLORS.frameDark }, { color: COLORS.frameLight }, { color: COLORS.frameGold },
        { color: COLORS.frameDark }, { color: COLORS.frameFill, alpha: 0.97 }],
    });
    const t1 = makeText(scene, cx, by - 12, title, {
      fontSize: '32px', color: COLORS.inkGold,
      padding: { top: 8, bottom: 4, left: 4, right: 4 },
    }).setOrigin(0.5);
    t1.setShadow(0, 2, '#05081a', 0, false, true);
    const t2 = makeText(scene, cx, by + 18, name, { fontSize: '22px', color: COLORS.ink }).setOrigin(0.5);
    const t3 = makeText(scene, cx, Math.min(L.height - L.safe.bottom - 30, by + 66), hint, {
      fontSize: '17px', color: '#a9a6c4',
    }).setOrigin(0.5).setAlpha(0);
    const banner = scene.add.container(0, 16).setAlpha(0);
    banner.add([frame, t1, t2]);
    root.add([dim, rays, halo, item, banner, t3]);
    scene.uiTexts.push(t1, t2, t3);

    soundManager.synth('jingle', { volume: 0.9 });
    scene.tweens.add({ targets: dim, alpha: 0.6, duration: 400 });
    scene.tweens.add({ targets: rays, scale: 1, alpha: 1, duration: 700, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1 });
    scene.tweens.add({ targets: halo, alpha: 0.55, duration: 600 });
    scene.tweens.add({ targets: item, alpha: 1, y: cy, duration: 700, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: item, y: cy - 4, duration: 1100, yoyo: true, repeat: -1, delay: 700, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: banner, alpha: 1, y: 0, duration: 500, delay: 450, ease: 'Sine.easeOut' });
    scene.tweens.add({ targets: t3, alpha: 1, duration: 400, delay: 1500,
      onComplete: () => scene.tweens.add({ targets: t3, alpha: 0.35, duration: 800, yoyo: true, repeat: -1 }) });

    return scene.script.tap(1500).then(() => {
      soundManager.sfx('confirm');
      return scene.script.tween({ targets: root, alpha: 0, duration: 450 }).then(() => root.destroy());
    });
  }
}
