import { FONT_TITLE } from '../config/theme.js';
import { WEDDING, timeLine } from '../config/event.vi.js';
import { makeText } from '../utils/text.js';
import { drawPixelFrame } from './PixelFrame.js';
import { soundManager } from '../audio/SoundManager.js';

const INK = '#5a3a24'; // warm brown on ivory — readable
const GOLD_INK = '#9a6a2a';
const PAPER = 0xf8f1e2;

/**
 * The wedding invitation, drawn in the UI layer (logical units) with pixel
 * framing and crisp device-resolution text. It unfolds from a point (the
 * folded card in the world) and reveals its lines in order.
 *
 *   const card = new InvitationCard(scene, layout area);
 *   await card.unfold(fromX, fromY);
 *   await card.reveal();          // tap during the reveal to finish at once
 */
export class InvitationCard {
  constructor(scene, area) {
    this.scene = scene;
    this.area = area; // { x, y, w, h } in logical UI units
    this.root = scene.add.container(area.x + area.w / 2, area.y + area.h / 2).setDepth(60);
    scene.ui.add(this.root);
    this.parts = [];
    this.build();
  }

  build() {
    const { scene } = this;
    const { w, h } = this.area;
    const g = scene.add.graphics();
    const x0 = -w / 2;
    const y0 = -h / 2;
    drawPixelFrame(g, x0, y0, w, h, {
      p: 2,
      layers: [
        { color: 0x4a3528 },
        { color: 0xd6ad57 },
        { color: PAPER },
        { color: PAPER },
        { color: 0xe6c983 },
        { color: PAPER },
      ],
    });
    // Faint paper grain.
    g.fillStyle(0xe9dcc2, 0.5);
    for (let i = 0; i < 70; i++) {
      const gx = x0 + 14 + ((i * 53) % (w - 28));
      const gy = y0 + 14 + ((i * 97) % (h - 28));
      g.fillRect(Math.round(gx), Math.round(gy), 2, 2);
    }
    this.root.add(g);
    this.frame = g;

    // Floral corners (pixel blooms + sage), integer-scaled for crisp pixels.
    const L = scene.L;
    const s = Math.max(2, Math.round(2 * L.zoom)) / L.zoom;
    const corner = (cx, cy, flip) => {
      const c = scene.add.container(cx, cy);
      c.add(scene.add.image(0, 0, 'bloom-cream').setScale(s));
      c.add(scene.add.image(flip * 9, 4, 'bloom').setScale(s * 0.8));
      c.add(scene.add.image(flip * 4, 11, 'orange-blossom').setScale(s));
      c.add(scene.add.image(flip * -6, 8, 'bud').setScale(s));
      this.root.add(c);
      return c;
    };
    this.corners = [
      corner(x0 + 20, y0 + 20, 1), corner(-x0 - 20, y0 + 20, -1),
      corner(x0 + 20, -y0 - 24, 1), corner(-x0 - 20, -y0 - 24, -1),
    ];

    // Text lines, laid out to fit the available height.
    const lines = [
      { key: 'gem', h: 22 },
      { key: 'names', h: 58, make: () => makeText(scene, 0, 0, WEDDING.couple, {
        fontFamily: FONT_TITLE, fontStyle: '600', fontSize: '46px', color: GOLD_INK,
        padding: { top: 14, bottom: 6, left: 6, right: 6 },
      }) },
      { key: 'tagline', h: 30, make: () => makeText(scene, 0, 0, WEDDING.tagline, { fontSize: '20px', color: INK }) },
      { key: 'rule1', h: 22 },
      { key: 'date', h: 44, make: () => makeText(scene, 0, 0, WEDDING.date, {
        fontFamily: FONT_TITLE, fontStyle: '600', fontSize: '36px', color: INK,
        padding: { top: 10, bottom: 4, left: 4, right: 4 },
      }) },
      { key: 'time', h: 32, make: () => makeText(scene, 0, 0, timeLine(), { fontSize: '24px', color: INK }) },
      { key: 'rule2', h: 20 },
      { key: 'venue', h: 40, make: () => makeText(scene, 0, 0, WEDDING.venueName, {
        fontFamily: FONT_TITLE, fontStyle: '600', fontSize: '32px', color: GOLD_INK,
        padding: { top: 10, bottom: 4, left: 4, right: 4 },
      }) },
      { key: 'address', h: 30, make: () => makeText(scene, 0, 0, WEDDING.venueAddress, { fontSize: '22px', color: INK }) },
    ];
    const total = lines.reduce((a, l) => a + l.h, 0);
    const k = Math.min(1.25, (h - 36) / total); // breathe on tall screens, compress on small
    let y = -total * k / 2;
    this.items = {};
    lines.forEach((l) => {
      const cy = y + (l.h * k) / 2;
      y += l.h * k;
      let obj;
      if (l.make) {
        obj = l.make().setOrigin(0.5);
        const maxW = w - 44;
        if (obj.width > maxW) obj.setScale(maxW / obj.width);
        scene.uiTexts?.push(obj);
      } else if (l.key === 'gem') {
        obj = scene.add.image(0, 0, 'star-core').setScale(s).setTint(0xf0c060);
      } else {
        obj = scene.add.graphics();
        obj.fillStyle(0xc9a253, 1);
        obj.fillRect(-58, -1, 46, 2).fillRect(12, -1, 46, 2);
        obj.fillStyle(0xd6ad57, 1).fillRect(-3, -3, 6, 6);
        obj.fillStyle(PAPER, 1).fillRect(-1, -1, 2, 2);
      }
      obj.y = Math.round(cy);
      obj.setAlpha(0);
      this.root.add(obj);
      this.items[l.key] = obj;
    });
  }

  /** Grow from the folded card's screen position and unfold vertically. */
  unfold(fromX, fromY) {
    const { scene } = this;
    const tx = this.root.x;
    const ty = this.root.y;
    this.root.setPosition(fromX, fromY).setScale(0.12, 0.05).setAlpha(0.2);
    soundManager.sfx('unfold');
    return scene.script.tween({
      targets: this.root, x: tx, y: ty, scaleX: 1, alpha: 1, duration: 700, ease: 'Sine.easeOut',
    }).then(() => scene.script.tween({ targets: this.root, scaleY: 1, duration: 650, ease: 'Back.easeOut' }));
  }

  /** Reveal lines in order; a tap finishes immediately. */
  reveal() {
    const { scene } = this;
    const it = this.items;
    const order = [
      [['gem', 'rule1', 'rule2'], 0],
      [['names'], 600],
      [['tagline'], 1700],
      [['date'], 2600],
      [['time'], 3400],
      [['venue', 'address'], 4200],
    ];
    this.revealTimers = [];
    const show = (keys, rise = 6) => keys.forEach((k) => {
      const o = it[k];
      if (!o || o.alpha >= 1) return;
      const y = o._ty ?? o.y;
      o._ty = y;
      o.y = y + rise;
      scene.tweens.add({ targets: o, alpha: 1, y, duration: 900, ease: 'Sine.easeOut' });
    });
    order.forEach(([keys, at]) => {
      this.revealTimers.push(scene.time.delayedCall(at, () => {
        show(keys);
        if (keys.includes('names')) soundManager.synth('flourish', { volume: 0.9 });
      }));
    });
    const done = new Promise((resolve) => {
      this.finishReveal = () => {
        if (this.revealed) return;
        this.revealed = true;
        this.revealTimers.forEach((t) => t.remove());
        Object.values(it).forEach((o) => {
          scene.tweens.killTweensOf(o);
          o.setAlpha(1);
          if (o._ty !== undefined) o.y = o._ty;
        });
        resolve();
      };
      this.revealTimers.push(scene.time.delayedCall(5300, () => this.finishReveal()));
    });
    // A tap during the reveal shows everything at once.
    scene.time.delayedCall(400, () => scene.input.once('pointerdown', () => this.finishReveal?.()));
    return scene.script.guard(done);
  }

  destroy() {
    this.root.destroy();
  }
}

