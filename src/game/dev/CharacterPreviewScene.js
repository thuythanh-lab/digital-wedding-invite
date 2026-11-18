import Phaser from 'phaser';
import { COLORS, FONT_TITLE } from '../config/theme.js';
import { viewport, fitCamera, WORLD_W } from '../utils/viewport.js';
import { makeText } from '../utils/text.js';
import { drawPixelFrame } from '../ui/PixelFrame.js';
import { createForestGround } from '../effects/ForestGround.js';
import { MinhCharacter } from '../characters/MinhCharacter.js';
import { ThuyCharacter } from '../characters/ThuyCharacter.js';
import { loadCharacterSheets } from '../characters/characterAnimations.js';
import { DevButton } from './DevButton.js';

const ART = 2; // logical units per art pixel in the real forest
const NIGHT_TINT = 0x8b93c9;
const GRID_DIRS = ['down', 'left', 'right', 'up'];

/**
 * DEVELOPMENT ONLY — `?preview=characters`
 * Review Minh (groom) and Thủy (bride): the couple standing together at a
 * pixel-perfect enlargement, all four directions at once, real in-game
 * scale beside forest sprites, and touch controls for every animation.
 * Not included in production builds.
 */
export class CharacterPreviewScene extends Phaser.Scene {
  constructor() {
    super('CharacterPreview');
  }

  preload() {
    loadCharacterSheets(this);
  }

  create() {
    this.state = this.state || {
      anim: 'idle', dir: 'down', night: false, stroll: false, grid: false, bouquet: true,
    };
    this.state.stroll = false;
    this.build(viewport.layout);
    this.onLayout = () => this.scene.restart();
    viewport.on('change', this.onLayout);
    this.events.once('shutdown', () => viewport.off('change', this.onLayout));

    const kb = this.input.keyboard;
    if (kb) {
      const map = { LEFT: 'left', RIGHT: 'right', UP: 'up', DOWN: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
      Object.entries(map).forEach(([k, d]) => kb.on(`keydown-${k}`, () => this.setAnim('walk', d)));
      kb.on('keydown-SPACE', () => this.setAnim('idle', this.state.dir));
      kb.on('keydown-L', () => this.runAction('look'));
      kb.on('keydown-N', () => this.runAction('nod'));
      kb.on('keydown-E', () => this.runAction('expressive'));
      kb.on('keydown-Q', () => this.runSpecial());
      kb.on('keydown-B', () => this.toggle('bouquet'));
      kb.on('keydown-G', () => this.toggle('grid'));
    }
  }

  build(L) {
    this.L = L;
    fitCamera(this.cameras.main, L);
    this.cameras.main.setBackgroundColor('#0b1020');
    const H = L.height;
    const top = L.safe.top + 10;
    const bottom = H - Math.max(L.safe.bottom, 4) - 8;
    const snap = (v) => Math.round(v * L.zoom) / L.zoom; // align to device pixels
    this.snap = snap;

    // ---- Header ------------------------------------------------------------------
    makeText(this, WORLD_W / 2, top + 14, 'XEM TRƯỚC NHÂN VẬT', {
      fontFamily: FONT_TITLE, fontStyle: '600', fontSize: '26px', color: COLORS.inkGold,
      padding: { top: 8, bottom: 2, left: 2, right: 2 },
    }).setOrigin(0.5);
    makeText(this, WORLD_W / 2, top + 37, 'Chỉ dành cho nhà phát triển', { fontSize: '15px', color: '#9aa0c4' })
      .setOrigin(0.5);

    // ---- Controls: three rows inside the bottom safe area ---------------------------------
    const btnH = 48;
    const gap = 4;
    const rowY = [2, 1, 0].map((k) => bottom - btnH / 2 - k * (btnH + gap));
    const row = (defs, y) => {
      const w = (WORLD_W - 16 - gap * (defs.length - 1)) / defs.length;
      return defs.map(([label, fn], i) => new DevButton(this, 8 + w / 2 + i * (w + gap), y, w, btnH, label, fn));
    };
    const animDefs = [['idle', 'down', 'Đứng yên'], ['walk', 'down', 'Đi xuống'], ['walk', 'up', 'Đi lên'],
      ['walk', 'left', 'Đi trái'], ['walk', 'right', 'Đi phải']];
    this.animButtons = row(animDefs.map(([a, d, l]) => [l, () => this.setAnim(a, d)]), rowY[0]);
    this.animButtons.forEach((b, i) => { b.anim = animDefs[i][0]; b.dir = animDefs[i][1]; });
    row([
      ['Nhìn quanh', () => this.runAction('look')],
      ['Gật đầu', () => this.runAction('nod')],
      ['Cử chỉ', () => this.runAction('expressive')],
      ['Đặc biệt', () => this.runSpecial()],
    ], rowY[1]);
    [this.btnBouquet, this.btnGrid, this.btnNight, this.btnStroll] = row([
      ['Hoa cưới', () => this.toggle('bouquet')],
      ['4 hướng', () => this.toggle('grid')],
      ['Ngày', () => this.toggle('night')],
      ['Dạo bước', () => this.toggleStroll()],
    ], rowY[2]);

    // ---- In-game scale strip ------------------------------------------------------------
    const stripH = 138;
    const stripBottom = rowY[0] - btnH / 2 - 8;
    const stripTop = stripBottom - stripH;
    createForestGround(this, 'preview-ground', WORLD_W / ART, stripH / ART, 30, 11);
    this.stripObjects = [this.add.image(0, stripTop, 'preview-ground').setOrigin(0).setScale(ART).setDepth(0)];
    this.add.graphics().setDepth(900).lineStyle(2, COLORS.frameGold, 0.8).strokeRect(1, stripTop, WORLD_W - 2, stripH);
    makeText(this, 10, stripTop + 5, 'Kích thước thật trong game', { fontSize: '16px', color: COLORS.inkGold })
      .setDepth(901).setShadow(0, 1, '#000', 0, false, true);
    const prop = (tex, f, x, y) => {
      const s = this.add.image(snap(x), snap(y), tex, f).setOrigin(0.5, 1).setScale(ART).setDepth(100 + y);
      this.stripObjects.push(s);
    };
    const gy = stripBottom - 22;
    prop('bigTrees', 'green2', 44, gy + 4);
    prop('bigTrees', 'pine', 320, gy - 8);
    prop('smallTrees', 'green0', 272, gy + 14);
    prop('bushes', 'big', 96, gy + 16);
    prop('redFlowers', 'pair', 238, gy + 2);
    prop('mushrooms', 'cluster', 298, gy + 18);
    this.stripArea = { x0: 80, x1: 290, y0: stripTop + 48, y1: stripBottom - 6 };
    this.small = {
      minh: new MinhCharacter(this, { x: snap(158), y: snap(gy + 4), scale: ART, depthBase: 100 }),
      thuy: new ThuyCharacter(this, { x: snap(200), y: snap(gy + 4), scale: ART, depthBase: 100 }),
    };

    // ---- Big panel -------------------------------------------------------------------------
    const panelTop = top + 52;
    const panelBottom = stripTop - 6;
    const panelH = panelBottom - panelTop;
    this.panel = { top: panelTop, bottom: panelBottom, h: panelH };
    const g = this.add.graphics();
    drawPixelFrame(g, 6, panelTop, WORLD_W - 12, panelH, {
      p: 2, layers: [{ color: 0x03050d }, { color: COLORS.frameGold }, { color: 0x0f1a1c }],
    });
    this.panelNote = makeText(this, WORLD_W / 2, panelTop + 13, '', { fontSize: '15px', color: '#8f96bd' })
      .setOrigin(0.5);
    this.bigGroup = [];
    this.big = [];
    this.buildBig();
    this.refresh();
    this.applyAnim();
  }

  /** Couple view (two big sprites) or the 4-direction grid. */
  buildBig() {
    this.bigGroup.forEach((o) => o.destroy());
    (this.big || []).forEach((b) => b.c.destroy());
    this.bigGroup = [];
    const { top, h } = this.panel;
    const L = this.L;
    const snap = this.snap;
    this.big = [];

    if (!this.state.grid) {
      // Integer device pixels per art pixel → pixel-perfect enlargement.
      const devicePx = Math.max(2, Math.floor(((h - 60) * L.zoom) / 32));
      const s = devicePx / L.zoom;
      const feetY = snap(top + 26 + (h - 60) / 2 + (29 * s) / 2);
      const gapX = 8.5 * s;
      [[WORLD_W / 2 - gapX, 'minh'], [WORLD_W / 2 + gapX, 'thuy']].forEach(([x, id]) => {
        const sh = this.add.ellipse(snap(x), feetY, 17 * s, 5 * s, 0x000000, 0.35);
        this.bigGroup.push(sh);
        const C = id === 'minh' ? MinhCharacter : ThuyCharacter;
        const c = new C(this, { x: snap(x), y: feetY, scale: s, shadow: false, sortByY: false, depthBase: 50 });
        this.big.push({ c, dir: null });
      });
      this.panelNote.setText(`Cô dâu & chú rể · phóng to ${devicePx}× điểm ảnh`);
      const lbl = makeText(this, WORLD_W / 2, top + h - 22, 'Minh  ·  Thủy', { fontSize: '19px' }).setOrigin(0.5);
      this.bigGroup.push(lbl);
    } else {
      const colW = (WORLD_W - 24) / 4;
      const rowH = (h - 40) / 2;
      const devicePx = Math.max(2, Math.floor(Math.min((colW - 6) / 20, (rowH - 16) / 31) * L.zoom));
      const s = devicePx / L.zoom;
      ['minh', 'thuy'].forEach((id, r) => {
        GRID_DIRS.forEach((dir, i) => {
          const x = snap(12 + colW * (i + 0.5));
          const y = snap(top + 28 + rowH * (r + 1) - 8);
          const C = id === 'minh' ? MinhCharacter : ThuyCharacter;
          const c = new C(this, { x, y, scale: s, shadow: false, sortByY: false, depthBase: 50, facing: dir });
          this.big.push({ c, dir });
        });
      });
      this.panelNote.setText(`Bốn hướng · phóng to ${devicePx}× điểm ảnh`);
    }
  }

  // ------------------------------------------------------------ controls
  everyone() {
    return [...this.big.map((b) => b.c), this.small.minh, this.small.thuy];
  }

  setAnim(anim, dir) {
    this.cancelTimers();
    this.state.anim = anim;
    this.state.dir = dir;
    if (this.state.stroll) this.toggleStroll(false);
    this.applyAnim();
    this.refresh();
  }

  applyAnim() {
    const { anim, dir, bouquet } = this.state;
    this.everyone().forEach((c) => c.setBouquet?.(bouquet));
    this.big.forEach(({ c, dir: fixed }) => {
      const d = fixed || dir;
      if (anim === 'walk') c.walkInPlace(d);
      else c.idle(d);
    });
    if (!this.state.stroll) {
      [this.small.minh, this.small.thuy].forEach((c) => (anim === 'walk' ? c.walkInPlace(dir) : c.idle(dir)));
    }
  }

  cancelTimers() {
    this.specialTimer?.remove();
    this.specialTimer = null;
  }

  runAction(name) {
    this.cancelTimers();
    if (this.state.stroll) this.toggleStroll(false);
    this.everyone().forEach((c) => c.playAction(name));
  }

  runSpecial() {
    this.cancelTimers();
    if (this.state.stroll) this.toggleStroll(false);
    this.everyone().forEach((c) => c.special());
    this.specialTimer = this.time.delayedCall(2200, () => this.applyAnim());
  }

  toggle(key) {
    this.state[key] = !this.state[key];
    if (key === 'grid') this.buildBig();
    this.applyAnim();
    this.refresh();
  }

  toggleStroll(force) {
    const on = force ?? !this.state.stroll;
    this.state.stroll = on;
    [this.small.minh, this.small.thuy].forEach((c) => c.stopMoving());
    if (on) {
      this.strollLoop(this.small.minh, 0);
      this.strollLoop(this.small.thuy, 1);
    } else {
      this.applyAnim();
    }
    this.refresh();
  }

  async strollLoop(c, phase) {
    const a = this.stripArea;
    const pts = [
      { x: a.x0 + 16, y: a.y1 }, { x: a.x0 + 16, y: a.y0 + 8 },
      { x: a.x1 - 16, y: a.y0 + 8 }, { x: a.x1 - 16, y: a.y1 },
    ];
    let i = phase * 2;
    while (this.state.stroll && c.sprite.active) {
      const p = pts[i % pts.length];
      // eslint-disable-next-line no-await-in-loop
      await c.moveTo(p.x, p.y, { speed: 34 * ART });
      i++;
      if (!this.state.stroll) break;
      if (i % 4 === 0) {
        // eslint-disable-next-line no-await-in-loop
        await c.playAction('look');
      }
    }
  }

  refresh() {
    const { night, stroll, anim, dir, grid, bouquet } = this.state;
    this.btnNight.setLabel(night ? 'Đêm' : 'Ngày').setActive(night);
    this.btnStroll.setActive(stroll);
    this.btnGrid.setActive(grid);
    this.btnBouquet.setActive(bouquet);
    this.animButtons.forEach((b) => b.setActive(!stroll && b.anim === anim && (anim === 'idle' || b.dir === dir)));
    const tint = night ? NIGHT_TINT : 0xffffff;
    this.stripObjects.forEach((o) => o.setTint(tint));
    [this.small.minh, this.small.thuy].forEach((c) => c.setTint(tint));
  }
}

