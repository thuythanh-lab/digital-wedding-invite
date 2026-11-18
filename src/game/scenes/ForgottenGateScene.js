import Phaser from 'phaser';
import { COLORS, FONT_TITLE } from '../config/theme.js';
import { STRINGS } from '../config/strings.vi.js';
import { StoryScene, ART } from './StoryScene.js';
import { GuidingStar } from '../effects/GuidingStar.js';
import { Fireflies } from '../effects/Fireflies.js';
import { GATE } from '../effects/GateArt.js';
import { NightLighting } from '../systems/NightLighting.js';
import { Hotspot } from '../systems/Hotspot.js';
import { storyState } from '../systems/StoryState.js';
import {
  paintGround, scatterFlora, smoothPath, distToPath, inClearing, addLeaves, swayUpdate,
} from '../world/ForestKit.js';
import { MinhCharacter } from '../characters/MinhCharacter.js';
import { ThuyCharacter } from '../characters/ThuyCharacter.js';
import { loadCharacterSheets } from '../characters/characterAnimations.js';
import { PromptBubble, emote, showChapterCard } from '../ui/StoryUI.js';
import { InvitationCard } from '../ui/InvitationCard.js';
import { PixelButton } from '../ui/PixelButton.js';
import { SmallButton } from '../ui/SmallButton.js';
import { soundManager } from '../audio/SoundManager.js';
import { AUDIO_KEYS } from '../audio/audioKeys.js';
import { makeText } from '../utils/text.js';
import { makeRng, mulberry32 } from '../utils/rng.js';

// World (art px): garden (north) · gate · hidden forest path (south).
const WW = 180;
const WH = 1180;
const SORT = 100;
const G = { x: 90, baseY: 690 }; // gate: bottom-centre
const GATE_TOP = G.baseY - GATE.H;
const LOCK = { x: G.x, y: GATE_TOP + GATE.lock.y };
const PLAZA = { x: 90, y: 310 };
const COUPLE_Y = 342; // where they stand before the letter
const LETTER = { x: 90, y: 286 };
const VEIL_BOTTOM = 580;

const FOREST_PATH = {
  hw: 7,
  pts: smoothPath([[62, 1200], [70, 1130], [96, 1070], [112, 1000], [96, 935], [82, 870], [92, 800], [90, 712], [90, 690]]),
};
const GARDEN_PATH = { hw: 9, stone: true, pts: smoothPath([[90, 640], [90, 560], [88, 470], [90, 380], [90, 330]], 2) };
const PLAZA_CLEARING = { x: PLAZA.x, y: PLAZA.y + 12, rx: 40, ry: 26, stone: true };
const GARDEN_GRASS = ['#7c9862', '#89a66b', '#96b274', '#a4bf80', '#b3cb8d'];
const NIGHT_AMBIENT = 0x2b336a;
const DAY_AMBIENT = 0xffecd4; // warm morning

function routeUp(path, fromY, toY, dx = 0) {
  return path.pts.filter(([, y]) => y <= fromY && y >= toY)
    .sort((a, b) => b[1] - a[1])
    .filter((p, i, arr) => i % 2 === 0 || i === arr.length - 1)
    .map(([x, y]) => ({ x: x + dx, y }));
}
function pathX(path, y) {
  let best = path.pts[0];
  path.pts.forEach((p) => { if (Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p; });
  return best[0];
}

/**
 * CHƯƠNG II — Cánh cổng bị lãng quên.
 * Hidden path → the forgotten gate (the Promise Key, a stuck gate, a nudge)
 * → through the light, night becomes morning → the wedding garden → the
 * sealed letter → the wedding invitation.
 *
 * init data: { start: 'path' | 'gate' | 'garden' | 'letter' | 'reveal' }
 * (non-default starts are used by the dev preview).
 */
export class ForgottenGateScene extends StoryScene {
  constructor() {
    super('ForgottenGate');
  }

  init(data) {
    this.startAt = data?.start || 'path';
  }

  preload() {
    loadCharacterSheets(this);
  }

  create() {
    this.setupStage(WW, WH);
    this.rng = makeRng(424);
    this.revealDone = false;
    this.ending = false;

    // The Promise Key from Chapter I opens this gate.
    if (!storyState.get('hasPromiseKey')) {
      // Only reachable by jumping straight here; keep the story consistent.
      console.info('[story] Promise Key granted on entry (direct jump to Chương II).');
      storyState.set('hasPromiseKey', true);
    }

    soundManager.preloadMusic(this, AUDIO_KEYS.music.warm);
    this.buildWorld();
    this.buildCast();
    this.director.anchorY = 0.62;

    const day = ['garden', 'letter', 'reveal'].includes(this.startAt);
    if (day) {
      soundManager.playMusic(AUDIO_KEYS.music.warm.key, { volume: 0.5, fadeIn: 1500 });
      this.applyGardenState(this.startAt === 'garden' ? 'entrance' : 'plaza');
    } else {
      soundManager.playMusic(AUDIO_KEYS.music.forest.key, { volume: 0.45, fadeIn: 2000 });
      soundManager.startAmbience(0.8);
    }
    this.events.once('shutdown', () => soundManager.stopAmbience());
    this.play();
  }

  // ================================================================ world
  buildWorld() {
    // Ground: garden (sage + stone) and forest path in one texture.
    paintGround(this, 'gate-ground', WW, WH, {
      paths: [FOREST_PATH, GARDEN_PATH], clearings: [PLAZA_CLEARING], seed: 61,
    });
    this.world.add(this.add.image(0, 0, 'gate-ground').setOrigin(0).setDepth(0));
    // The garden half gets its own lighter sage grass painted over the north.
    paintGround(this, 'garden-ground', WW, VEIL_BOTTOM + 40, {
      paths: [GARDEN_PATH], clearings: [PLAZA_CLEARING], seed: 62, grassPalette: GARDEN_GRASS,
    });
    const gg = this.add.image(0, 0, 'garden-ground').setOrigin(0).setDepth(0.2);
    this.world.add(gg);

    // ---- Forest (south): tall dark trees, ruins growing denser near the gate.
    const forestBlocked = (x, y, m) => y < G.baseY + 6 || distToPath(FOREST_PATH, x, y) < FOREST_PATH.hw + m;
    const forest = scatterFlora(this, this.world, this.rng, WW, WH, forestBlocked, {
      trees: 110, bushes: 10, berries: 2, rocks: 10, mushrooms: 10, flowers: 4, tufts: 90,
      keepOut: [{ x: G.x, y: G.baseY + 14, rx: 34, ry: 18 }],
    });
    this.swayers = [...forest.swayers];
    // Wall of trees flanking the gate so it is the only way through.
    for (let x = 0; x <= WW; x += 11) {
      if (Math.abs(x - G.x) < 52) continue;
      const y = G.baseY + 4 + (x % 3) * 3;
      const t = this.add.image(x, y, 'bigTrees', x % 2 ? 'pine' : 'green5').setOrigin(0.5, 1).setDepth(SORT + y);
      this.world.add(t);
    }
    const ruins = [
      ['ruin-pillar', 72, 960], ['ruin-block', 118, 905], ['ruin-pillar-low', 66, 870], ['ruin-pillar', 112, 820],
      ['ruin-block', 70, 790], ['ruin-pillar', 60, 745], ['ruin-pillar-low', 120, 752], ['ruin-block', 128, 718],
    ];
    ruins.forEach(([k, x, y]) => this.world.add(this.add.image(x, y, k).setOrigin(0.5, 1).setDepth(SORT + y)));
    [['stele', 56, 712], ['carved-block', 124, 734]].forEach(([k, x, y]) => {
      // Kenney Tiny Dungeon pieces, warmed to match the mossy stone.
      this.world.add(this.add.image(x, y, k).setOrigin(0.5, 1).setDepth(SORT + y).setTint(0xc9c0b0));
    });

    // ---- The gate.
    const top = GATE_TOP;
    this.gateLight = this.add.image(G.x, top + GATE.door.y, 'gate-light').setOrigin(0.5, 0)
      .setDepth(SORT + G.baseY - 0.3).setAlpha(0);
    const dl = GATE.door;
    this.doorL = this.add.image(G.x - GATE.W / 2 + dl.x, top + dl.y, 'gate-door-l').setOrigin(0, 0).setDepth(SORT + G.baseY - 0.2);
    this.doorR = this.add.image(G.x + GATE.W / 2 - dl.x, top + dl.y, 'gate-door-r').setOrigin(1, 0).setDepth(SORT + G.baseY - 0.2);
    this.doorHome = { l: this.doorL.x, r: this.doorR.x };
    this.gate = this.add.image(G.x, G.baseY, 'gate-frame').setOrigin(0.5, 1).setDepth(SORT + G.baseY);
    this.runes = this.add.image(G.x, G.baseY, 'gate-runes').setOrigin(0.5, 1).setDepth(SORT + G.baseY + 0.1)
      .setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.keyhole = this.add.image(LOCK.x, LOCK.y + 2, 'gate-keyhole').setDepth(SORT + G.baseY - 0.1);
    this.world.add([this.gateLight, this.doorL, this.doorR, this.gate, this.runes, this.keyhole]);

    // ---- Garden (north).
    const gardenBlocked = (x, y, m) => y > VEIL_BOTTOM - 10 || distToPath(GARDEN_PATH, x, y) < GARDEN_PATH.hw + m
      || inClearing(PLAZA_CLEARING, x, y, m + 6);
    const grng = mulberry32(7);
    const placed = [];
    const free = (x, y, d) => placed.every((p) => Math.hypot(p.x - x, (p.y - y) * 1.3) > d);
    // Blossom trees around the edges.
    for (let i = 0, tries = 0; i < 40 && tries < 900; tries++) {
      const x = grng() * WW;
      const y = 20 + grng() * (VEIL_BOTTOM - 40);
      if (gardenBlocked(x, y, 14) || !free(x, y, 19) || Math.abs(x - 90) < 40) continue;
      placed.push({ x, y });
      i++;
      this.world.add(this.add.image(Math.round(x), Math.round(y), `blossom-tree-${i % 3}`).setOrigin(0.5, 1)
        .setDepth(SORT + y).setFlipX(grng() < 0.5));
    }
    // Flower beds along the path and around the plaza.
    const flowers = ['bloom', 'bloom-cream', 'orange-blossom', 'bloom-cream', 'bloom'];
    for (let i = 0; i < 360; i++) {
      const x = grng() * WW;
      const y = 40 + grng() * (VEIL_BOTTOM - 70);
      const dPath = distToPath(GARDEN_PATH, x, y) - GARDEN_PATH.hw;
      const nearPlaza = inClearing(PLAZA_CLEARING, x, y, 14) && !inClearing(PLAZA_CLEARING, x, y, 2);
      // Beds hug the walkway and the plaza; a few wildflowers elsewhere.
      if (!((dPath > 2 && dPath < 16) || nearPlaza || grng() < 0.22) || inClearing(PLAZA_CLEARING, x, y, 2) || dPath < 2) continue;
      const f = this.add.image(Math.round(x), Math.round(y), flowers[i % flowers.length]).setOrigin(0.5, 1).setDepth(2.6);
      this.world.add(f);
      if (i % 3 === 0) this.swayers.push({ o: f, x: f.x, amp: 0.4, sp: 0.6 + grng() * 0.5, ph: grng() * 6 });
    }
    // Sage bushes.
    for (let i = 0; i < 30; i++) {
      const x = grng() * WW;
      const y = 50 + grng() * (VEIL_BOTTOM - 80);
      if (gardenBlocked(x, y, 4) || !free(x, y, 12)) continue;
      placed.push({ x, y });
      this.world.add(this.add.image(Math.round(x), Math.round(y), 'bushes', grng() < 0.5 ? 'big' : 'wide')
        .setOrigin(0.5, 1).setTint(0xdbe8cf).setDepth(SORT + y));
    }
    // Lanterns along the walkway, the arbour and the pedestal.
    this.lanterns = [];
    [[74, 520], [106, 520], [74, 430], [106, 430], [70, 360], [110, 360]].forEach(([x, y]) => {
      const l = this.add.image(x, y, 'lantern').setOrigin(0.5, 1).setDepth(SORT + y);
      this.world.add(l);
      this.lanterns.push({ x, y: y - 8 });
    });
    this.world.add(this.add.image(PLAZA.x, PLAZA.y - 24, 'arbor').setOrigin(0.5, 1).setDepth(SORT + PLAZA.y - 24));
    this.pedestal = this.add.image(PLAZA.x, PLAZA.y, 'pedestal').setOrigin(0.5, 1).setDepth(SORT + PLAZA.y);
    this.world.add(this.pedestal);

    // ---- Darkness hiding the garden until the gate opens.
    // Drawn just behind the gate and its tree wall, so they stand out against it.
    const veilDepth = SORT + G.baseY - 1;
    this.veil = this.add.rectangle(0, 0, WW, G.baseY - 30, COLORS.canopy).setOrigin(0).setDepth(veilDepth);
    this.veilFade = this.add.image(0, 0, 'fade-v').setOrigin(0).setDisplaySize(WW, 1).setVisible(false).setDepth(veilDepth);
    this.world.add([this.veil, this.veilFade]);

    // ---- Light.
    this.light = new NightLighting(this, this.world, WW, WH, { ambient: NIGHT_AMBIENT });
    this.light.day = DAY_AMBIENT;
    this.light.dayMix = 0;
    [[40, 760], [140, 900], [70, 1040]].forEach(([x, y]) => this.light.addBeam({ x, y, len: 220, w: 44, alpha: 0.24 }));
    this.gateMoon = this.light.addBeam({ x: G.x - 26, y: GATE_TOP - 40, len: 200, w: 90, angle: 10, alpha: 0.3, color: 0xc9d6ff });
    forest.mushroomLights.forEach((m) => this.light.add({ x: m.x, y: m.y, radius: 12, color: COLORS.mushroomLight, intensity: 0.5, flicker: 0.4 }));
    this.gateFlowers = (GATE.flowers || []).map(([fx, fy]) => this.light.add({
      x: G.x - GATE.W / 2 + fx, y: top + fy, radius: 7, color: 0xbff2ea, intensity: 0.55, flicker: 0.5,
    }));
    this.lockLight = this.light.add({ x: LOCK.x, y: LOCK.y, radius: 2, color: 0xffd86b, intensity: 0 });
    this.portalLight = this.light.add({ x: G.x, y: G.baseY - 30, radius: 10, color: 0xffd9a0, intensity: 0 });

    this.fireflies = new Fireflies(this, { x: 10, y: G.baseY, w: WW - 20, h: WH - G.baseY - 30 }, {
      count: 18, depth: 5150, glowScale: 0.07, coreScale: 0.5, container: this.world,
    });
    addLeaves(this, this.world, WW);
  }

  buildCast() {
    const y0 = 1168;
    const x0 = pathX(FOREST_PATH, y0);
    this.minh = new MinhCharacter(this, { x: x0 - 8, y: y0, facing: 'up', layer: this.world, depthBase: SORT });
    this.thuy = new ThuyCharacter(this, { x: x0 + 8, y: y0, facing: 'up', variant: '-bq', layer: this.world, depthBase: SORT });

    this.star = new GuidingStar(this, x0, y0 - 60, { unit: 1, depth: 5200, glowScale: 0.3, layer: this.world });
    this.star.mode = 'orb';
    this.star.setTrailRate(70);
    this.starLight = this.light.add({ x: x0, y: y0 - 60, radius: 64, color: COLORS.starLight, intensity: 0.9 });
    this.starLit = true;

    // The Promise Key floats above the couple.
    this.key = this.add.image(x0, y0 - 40, 'promise-key').setDepth(5310);
    this.keyGlow = this.add.image(x0, y0 - 40, 'glow').setDepth(5305).setScale(0.22).setTint(0xffd98a)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
    this.world.add([this.keyGlow, this.key]);
    this.keyLight = this.light.add({ x: x0, y: y0 - 40, radius: 26, color: 0xffd98a, intensity: 0.6 });
    this.keyFollows = true;
    this.starAhead = true;
  }

  // ================================================================ story
  async play() {
    const order = ['path', 'gate', 'garden', 'letter', 'reveal'];
    const from = order.indexOf(this.startAt);
    if (from > 0) this.fadeIn(800, from >= 2 ? 0xf8f1e2 : 0x060914);
    if (from <= 0) await this.scenePath();
    if (from <= 1) {
      if (from === 1) this.placeAtGate();
      await this.sceneGate();
      await this.throughTheGate();
    }
    if (from <= 2) await this.sceneGarden();
    if (from <= 3) await this.sceneLetter();
    await this.sceneReveal();
    this.showContinue();
  }

  // ---------------------------------------------------------------- scene 1
  async scenePath() {
    const s = this.script;
    this.director.lookAt(this.midX(), this.minh.y - 40);
    this.director.follow(this.couplePoint, { lerp: 0.05 });
    this.fadeIn(1100, 0x060914);
    showChapterCard(this, STRINGS.chapter2.label, STRINGS.chapter2.title);
    await s.wait(700);
    // He turns toward the path; she follows; they set off together.
    const walkTo = G.baseY + 24;
    const mWalk = this.minh.walkPath(routeUp(FOREST_PATH, this.minh.y, walkTo, -8), { speed: 26, axisBias: 1.6, faceOnArrival: 'up' });
    await s.wait(380);
    const tWalk = this.thuy.walkPath(routeUp(FOREST_PATH, this.thuy.y - 4, walkTo, 8), { speed: 26, axisBias: 1.6, faceOnArrival: 'up' });
    await s.wait(2600);
    const said = this.say(STRINGS.chapter2.path);
    await s.all(mWalk, tWalk, said);
    // Settle side by side in front of the gate.
    await s.all(
      this.minh.moveTo(G.x - 8, G.baseY + 24, { speed: 22, faceOnArrival: 'up' }),
      this.thuy.moveTo(G.x + 8, G.baseY + 24, { speed: 22, faceOnArrival: 'up' }),
    );
  }

  get couplePoint() {
    if (!this._cp) {
      const self = this;
      this._cp = {
        get x() { return self.midX(); },
        get y() { return Math.min(self.minh.y, self.thuy.y) - 46; },
      };
    }
    return this._cp;
  }

  midX() {
    return (this.minh.x + this.thuy.x) / 2;
  }

  placeAtGate() {
    this.minh.setPosition(G.x - 8, G.baseY + 24).idle('up');
    this.thuy.setPosition(G.x + 8, G.baseY + 24).idle('up');
    this.director.lookAt(G.x, G.baseY - 10);
  }

  // ---------------------------------------------------------------- scene 2
  async sceneGate() {
    const s = this.script;
    this.director.stop();
    await this.director.panTo(G.x, G.baseY - 6, 1600);
    // The star floats to the centre of the gate; the key starts to glow.
    this.starAhead = false;
    await s.tween({ targets: this.star, x: LOCK.x, y: LOCK.y - 18, duration: 1300, ease: 'Sine.easeInOut' });
    soundManager.synth('glow', { volume: 0.6 });
    this.tweens.add({ targets: this.keyGlow, scale: 0.34, alpha: 0.85, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.keyLight, radius: 40, intensity: 1, duration: 800 });

    const bubble = new PromptBubble(this, this.world, LOCK.x, GATE_TOP + 28, STRINGS.chapter2.openGate);
    this.uiTexts.push(bubble.text);
    bubble.show();
    const spot = new Hotspot(this, LOCK.x, LOCK.y, { radius: 26, layer: this.world, ringScale: 1.2 });
    await s.guard(spot.wait());
    bubble.hide();
    soundManager.sfx('select', { volume: 0.3 });

    // 1–3. The key rises from the couple, floats to the lock, and turns.
    this.keyFollows = false;
    this.tweens.killTweensOf(this.keyGlow);
    await s.tween({ targets: [this.key, this.keyGlow], y: '-=14', duration: 600, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: this.star, y: LOCK.y - 34, duration: 900, ease: 'Sine.easeInOut' });
    await s.tween({ targets: [this.key, this.keyGlow], x: LOCK.x, y: LOCK.y + 1, duration: 1300, ease: 'Sine.easeInOut' });
    soundManager.sfx('keyTurn');
    await s.tween({ targets: this.key, angle: -90, duration: 520, ease: 'Back.easeOut' });
    // 4–5. Golden light at the lock; the carvings awaken.
    this.tweens.add({ targets: this.lockLight, radius: 46, intensity: 1, duration: 900, ease: 'Sine.easeOut' });
    soundManager.synth('sparkle', { volume: 0.7 });
    await s.tween({ targets: this.runes, alpha: 1, duration: 1300, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.runes, alpha: 0.65, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: [this.key, this.keyGlow, this.keyhole], alpha: 0, duration: 500 });
    this.tweens.add({ targets: this.keyLight, intensity: 0, duration: 500 });

    // 6. The gate begins to open… and gets stuck.
    soundManager.sfx('gateOpen');
    this.tweens.add({ targets: this.gateLight, alpha: 0.35, duration: 900 });
    this.tweens.add({ targets: this.portalLight, intensity: 0.4, radius: 30, duration: 900 });
    await s.all(
      s.tween({ targets: this.doorL, x: this.doorHome.l - 4, duration: 900, ease: 'Sine.easeOut' }),
      s.tween({ targets: this.doorR, x: this.doorHome.r + 4, duration: 900, ease: 'Sine.easeOut' }),
    );
    soundManager.sfx('gateStuck');
    this.cameras.main.shake(160, 0.002);
    await s.tween({ targets: [this.doorL, this.doorR], y: '+=1', duration: 60, yoyo: true, repeat: 2 });
    await s.wait(500);
    // The couple pause and glance at each other.
    await s.all(this.minh.turnTo('right'), this.thuy.turnTo('left'));
    emote(this, this.world, this.minh, 'dots', 1000);
    emote(this, this.world, this.thuy, 'dots', 1000);
    await s.wait(1200);
    await s.all(this.minh.turnTo('up'), this.thuy.turnTo('up'));
    // The little star gives it a nudge.
    await s.tween({ targets: this.star, x: LOCK.x, y: LOCK.y - 4, duration: 700, ease: 'Sine.easeIn' });
    soundManager.sfx('nudge');
    this.star.burst(10, 0.5);
    await s.tween({ targets: this.star.core, scaleX: 1.6, scaleY: 0.6, duration: 90, yoyo: true });
    await s.tween({ targets: this.star, y: LOCK.y - 26, duration: 420, ease: 'Back.easeOut' });
    // …and it swings open.
    soundManager.sfx('gateOpen', { rate: 0.9 });
    this.tweens.add({ targets: this.gateLight, alpha: 1, duration: 1600, ease: 'Sine.easeIn' });
    this.tweens.add({ targets: this.portalLight, intensity: 1, radius: 70, duration: 1800 });
    await s.all(
      s.tween({ targets: this.doorL, x: this.doorHome.l - 30, duration: 1800, ease: 'Sine.easeInOut' }),
      s.tween({ targets: this.doorR, x: this.doorHome.r + 30, duration: 1800, ease: 'Sine.easeInOut' }),
    );
    // Warm motes drift out of the doorway.
    this.motes = this.add.particles(G.x, G.baseY - 30, 'gold-mote', {
      x: { min: -24, max: 24 }, y: { min: -28, max: 26 }, lifespan: 2400, speedY: { min: 4, max: 14 },
      speedX: { min: -6, max: 6 }, alpha: { start: 0.9, end: 0 }, scale: { start: 1, end: 1 }, frequency: 90,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(5250);
    this.world.add(this.motes);
  }

  // ---------------------------------------------------------------- transition
  async throughTheGate() {
    const canSkip = storyState.seen('gateTransition');
    const branch = this.script.branch();
    let skipBtn = null;
    const skipped = new Promise((resolve) => {
      if (!canSkip) return;
      const L = this.L;
      skipBtn = new SmallButton(this, L.safe.left + 58, L.safe.top + 34, 96, 46, `${STRINGS.chapter2.skip} ›`, () => {
        skipBtn.disableInteractive();
        resolve('skip');
      });
      this.ui.add(skipBtn);
      this.uiTexts.push(skipBtn.label);
    });
    const result = await this.script.guard(Promise.race([this.runTransition(branch).then(() => 'done'), skipped]));
    if (result === 'skip') {
      branch.cancel();
      if (this.glowCover) {
        this.tweens.killTweensOf(this.glowCover);
        this.glowCover.setAlpha(0);
      }
      this.applyGardenState('entrance');
      soundManager.playMusic(AUDIO_KEYS.music.warm.key, { volume: 0.5, fadeIn: 800 });
    }
    skipBtn?.destroy();
    storyState.markSeen('gateTransition');
  }

  async runTransition(s) {
    // The star floats through first; they follow it into the light.
    s.tween({ targets: this.star, y: GATE_TOP + 10, duration: 1600, ease: 'Sine.easeIn' })
      .then(() => this.tweens.add({ targets: [this.star.core, this.star.glow, this.star.halo], alpha: 0, duration: 500 }));
    await s.wait(500);
    this.director.follow(this.couplePoint, { lerp: 0.04 });
    s.all(
      this.minh.walkPath([{ x: G.x - 7, y: G.baseY - 26 }], { speed: 20 }),
      s.wait(250).then(() => this.thuy.walkPath([{ x: G.x + 7, y: G.baseY - 26 }], { speed: 20 })),
    );
    await s.wait(1700);

    // Soft golden light fills everything; night turns to morning beneath it.
    const L = this.L;
    this.glowCover = this.add.rectangle(0, 0, L.width, L.height + 2, 0xffe9c8).setOrigin(0).setAlpha(0).setDepth(80);
    this.ui.add(this.glowCover);
    soundManager.playMusic(AUDIO_KEYS.music.warm.key, { volume: 0.5, fadeIn: 4500 });
    soundManager.stopAmbience();
    soundManager.synth('glow', { volume: 0.8 });
    this.tweens.add({ targets: this.light, dayMix: 1, duration: 3200, ease: 'Sine.easeInOut' });
    await s.tween({ targets: this.glowCover, alpha: 0.9, duration: 1500, ease: 'Sine.easeIn' });

    // Beneath the light: the far side of the gate.
    this.applyGardenState('entrance', { keepCover: true });
    await s.wait(300);
    s.tween({ targets: this.glowCover, alpha: 0, duration: 2600, ease: 'Sine.easeOut' });
    await s.wait(900);
  }

  /** Final state after the gate: morning light, garden revealed, couple inside. */
  applyGardenState(where = 'entrance', { keepCover = false } = {}) {
    this.tweens.killTweensOf(this.light);
    this.light.dayMix = 1;
    this.light.ambientBoost = 0;
    this.vignette.setAlpha(0.32);
    this.veil.setVisible(false);
    this.veilFade.setVisible(false);
    this.fireflies.setAlpha(0);
    this.gateMoon.alpha = 0;
    this.light.beams.forEach((b) => { b.alpha *= 0.4; });
    this.light.addBeam({ x: 40, y: 0, len: 420, w: 90, angle: 14, alpha: 0.22, color: 0xfff0c8 });
    this.light.addBeam({ x: 130, y: 40, len: 360, w: 70, angle: 14, alpha: 0.18, color: 0xfff0c8 });
    this.lanterns.forEach((l) => this.light.add({ x: l.x, y: l.y, radius: 16, color: 0xffd98a, intensity: 0.5, flicker: 0.3 }));
    this.doorL.x = this.doorHome.l - 30;
    this.doorR.x = this.doorHome.r + 30;
    this.gateLight.setAlpha(0.45);
    this.keyhole.setAlpha(0);
    this.key.setAlpha(0);
    this.keyGlow.setAlpha(0);
    this.keyFollows = false;
    this.runes.setAlpha(0.5);
    this.motes?.stop();
    if (!keepCover && this.glowCover) this.glowCover.setAlpha(0);
    this.startGardenLife();
    // The star waits above the walkway.
    this.tweens.killTweensOf([this.star, this.star.core, this.star.glow, this.star.halo]);
    [this.star.core, this.star.glow, this.star.halo].forEach((o) => o.setAlpha(1));
    this.star.core.setScale(1);
    this.starAhead = false;
    if (where === 'entrance') {
      this.minh.halt('up').setPosition(G.x - 7, VEIL_BOTTOM - 6);
      this.thuy.halt('up').setPosition(G.x + 7, VEIL_BOTTOM - 4);
      this.star.setPosition(G.x, VEIL_BOTTOM - 70);
      this.director.lookAt(G.x, VEIL_BOTTOM - 60);
    } else {
      this.minh.halt('up').setPosition(PLAZA.x - 8, COUPLE_Y);
      this.thuy.halt('up').setPosition(PLAZA.x + 8, COUPLE_Y);
      this.star.setPosition(PLAZA.x, LETTER.y - 26);
      this.director.anchorY = 0.62;
      this.director.lookAt(PLAZA.x, COUPLE_Y - 40);
    }
  }

  /** Petals, butterflies and golden motes for the morning garden. */
  startGardenLife() {
    if (this.gardenAlive) return;
    this.gardenAlive = true;
    this.petals = this.add.particles(0, 0, 'petal', {
      x: { min: -20, max: WW }, y: { min: 0, max: VEIL_BOTTOM - 60 }, lifespan: 7000,
      speedX: { min: 6, max: 14 }, speedY: { min: 3, max: 9 }, rotate: { start: 0, end: 300 },
      alpha: { start: 0, end: 0.9, ease: 'Sine.easeOut' }, frequency: 420,
    }).setDepth(5260);
    this.goldMotes = this.add.particles(0, 0, 'gold-mote', {
      x: { min: 0, max: WW }, y: { min: 0, max: VEIL_BOTTOM }, lifespan: 4000, speedY: { min: -6, max: -2 },
      alpha: { start: 0, end: 0.8, ease: 'Sine.easeInOut' }, frequency: 260, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(5255);
    this.world.add([this.petals, this.goldMotes]);
    const rnd = mulberry32(13);
    this.butterflies = [];
    for (let i = 0; i < 6; i++) {
      const b = this.add.image(0, 0, 'butterfly-0').setDepth(5240);
      this.world.add(b);
      this.butterflies.push({
        o: b, cx: 20 + rnd() * (WW - 40), cy: 60 + rnd() * (VEIL_BOTTOM - 140), r: 10 + rnd() * 18,
        sp: 0.25 + rnd() * 0.35, ph: rnd() * 6, flap: rnd() * 6,
      });
    }
  }

  // ---------------------------------------------------------------- scene 3
  async sceneGarden() {
    const s = this.script;
    this.director.follow(this.couplePoint, { lerp: 0.03 });
    // They walk into the garden together along the stone path.
    await s.all(
      this.minh.walkPath(routeUp(GARDEN_PATH, this.minh.y, COUPLE_Y, -8), { speed: 24, axisBias: 1.6, faceOnArrival: 'up' }),
      s.wait(250).then(() => this.thuy.walkPath(routeUp(GARDEN_PATH, this.thuy.y, COUPLE_Y, 8), { speed: 24, axisBias: 1.6, faceOnArrival: 'up' })),
      s.tween({ targets: this.star, x: PLAZA.x, y: LETTER.y - 30, duration: 6000, ease: 'Sine.easeInOut' }),
    );
    await s.all(
      this.minh.moveTo(PLAZA.x - 8, COUPLE_Y, { speed: 20, faceOnArrival: 'up' }),
      this.thuy.moveTo(PLAZA.x + 8, COUPLE_Y, { speed: 20, faceOnArrival: 'up' }),
    );
    // The camera drifts up to reveal the garden, then settles on them.
    this.director.stop();
    await this.director.panTo(PLAZA.x, 170, 2600);
    await s.wait(500);
    await this.director.panTo(PLAZA.x, COUPLE_Y - 40, 2200);
    await s.all(this.minh.playAction('look'), s.wait(200).then(() => this.thuy.playAction('look')));
    // She notices something ahead; he turns to see.
    emote(this, this.world, this.thuy, 'bang', 1000);
    soundManager.sfx('pop', { volume: 0.3 });
    await this.thuy.turnTo('up');
    await s.wait(350);
    await this.minh.lookAt({ x: LETTER.x, y: LETTER.y });
    await this.minh.turnTo('up');
    // The star sinks to the pedestal… and a sealed letter appears.
    await s.tween({ targets: this.star, y: LETTER.y - 4, duration: 900, ease: 'Sine.easeInOut' });
    soundManager.synth('sparkle', { volume: 0.8 });
    this.star.burst(14, 0.6);
    this.spawnLetter();
    await s.tween({ targets: this.star, y: LETTER.y - 34, duration: 1000, ease: 'Sine.easeOut' });
    await s.wait(500);
  }

  spawnLetter() {
    if (this.envelope) return;
    this.letterGlow = this.add.image(LETTER.x, LETTER.y, 'glow').setScale(0.3).setTint(0xffe2a8)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7).setDepth(5295);
    this.envelope = this.add.image(LETTER.x, LETTER.y, 'envelope').setDepth(5300).setScale(0);
    this.world.add([this.letterGlow, this.envelope]);
    this.tweens.add({ targets: this.envelope, scale: 1, duration: 600, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [this.envelope, this.letterGlow], y: LETTER.y - 2, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---------------------------------------------------------------- scene 4
  async sceneLetter() {
    const s = this.script;
    this.spawnLetter();
    const bubble = new PromptBubble(this, this.world, LETTER.x, LETTER.y - 16, STRINGS.chapter2.openLetter);
    this.uiTexts.push(bubble.text);
    bubble.show();
    const spot = new Hotspot(this, LETTER.x, LETTER.y, { radius: 18, layer: this.world, ringScale: 0.8 });
    await s.guard(spot.wait());
    bubble.hide();

    const env = this.envelope;
    this.tweens.killTweensOf([env, this.letterGlow]);
    // 1. The envelope floats upward. 2. The seal glows.
    await s.tween({ targets: [env, this.letterGlow], y: LETTER.y - 12, duration: 900, ease: 'Sine.easeInOut' });
    const seal = this.add.image(env.x, env.y + 1, 'glow').setScale(0.04).setTint(0xff9aa6)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(5305);
    this.world.add(seal);
    soundManager.synth('glow', { volume: 0.6 });
    await s.tween({ targets: seal, alpha: 1, scale: 0.12, duration: 700, yoyo: true, hold: 200 });
    // 3. The seal breaks gently.
    soundManager.sfx('letterOpen');
    env.setTexture('envelope-broken');
    const bits = this.add.particles(env.x, env.y + 1, 'px', {
      lifespan: 600, speed: { min: 8, max: 18 }, scale: { start: 0.5, end: 0 }, tint: [0x8e2c3a, 0xc25563],
      emitting: false,
    }).setDepth(5306);
    this.world.add(bits);
    bits.explode(8);
    await s.wait(500);
    // 4. The envelope opens. 5. A folded card slides out.
    env.setTexture('envelope-open').setOrigin(0.5, 0.75);
    soundManager.sfx('unfold', { volume: 0.3 });
    this.card = this.add.image(env.x, env.y + 2, 'card-folded').setDepth(5301);
    this.world.add(this.card);
    env.setDepth(5302);
    await s.tween({ targets: this.card, y: env.y - 12, duration: 900, ease: 'Sine.easeOut' });
    this.card.setDepth(5303);
    await s.wait(300);
  }

  // ---------------------------------------------------------------- scene 5
  async sceneReveal() {
    const s = this.script;
    // Camera moves closer: frame the couple low, leave the sky for the letter.
    this.director.stop();
    this.director.anchorY = 0.84;
    await this.director.panTo(PLAZA.x, COUPLE_Y, 1400);
    const L = this.L;
    const cam = this.cameras.main;
    const coupleTop = (COUPLE_Y - 31 - cam.scrollY) * ART;
    const top = L.safe.top + 68; // clear of the music button
    const bottom = Math.max(top + 300, coupleTop - 6);
    const area = { x: 14 + L.safe.left, y: top, w: L.width - 28 - L.safe.left - L.safe.right, h: bottom - top };

    // Warm haze behind the card; the letter in the world fades away.
    this.haze = this.add.rectangle(0, 0, L.width, L.height + 2, 0xfff6e6).setOrigin(0).setAlpha(0).setDepth(50);
    this.ui.add(this.haze);
    this.tweens.add({ targets: this.haze, alpha: 0.28, duration: 900 });
    const from = this.card ? this.toScreen(this.card.x, this.card.y) : { x: L.width / 2, y: L.height * 0.4 };
    this.tweens.add({ targets: [this.card, this.envelope, this.letterGlow].filter(Boolean), alpha: 0, duration: 500 });
    this.tweens.add({ targets: this.star, y: LETTER.y - 50, duration: 1000 });

    this.invite = new InvitationCard(this, area);
    await this.invite.unfold(from.x, from.y);
    // The couple stand together, hand in hand, beneath it.
    this.minh.pose('hold', 'down');
    this.thuy.pose('hold', 'down');
    await this.invite.reveal();
    this.revealDone = true;
    storyState.set('weddingRevealed', true);
    storyState.set('chapter', Math.max(2, storyState.get('chapter') || 0));
    // Petals drift across the scene.
    this.petalsUI = this.add.particles(0, 0, 'petal', {
      x: { min: -20, max: L.width }, y: -10, lifespan: 9000, speedX: { min: 8, max: 22 }, speedY: { min: 18, max: 34 },
      rotate: { start: 0, end: 360 }, scale: { min: 2, max: 3 }, alpha: { start: 0.95, end: 0.6 }, frequency: 700,
    }).setDepth(70);
    this.ui.add(this.petalsUI);
    await s.wait(400);
  }

  showContinue() {
    const L = this.L;
    const y = L.height - Math.max(L.safe.bottom, 6) - 36;
    this.continueBtn = new PixelButton(this, L.width / 2, y, STRINGS.chapter2.continue, {
      width: 190, height: 50, onPress: () => this.endChapter(),
    });
    this.ui.add(this.continueBtn);
    this.uiTexts.push(...this.continueBtn.texts);
    this.continueBtn.setAlpha(0);
    this.tweens.add({ targets: this.continueBtn, alpha: 1, duration: 700 });
  }

  /** Safe end of Chương II until the RSVP chapter exists. */
  async endChapter() {
    if (this.ending) return;
    this.ending = true;
    soundManager.sfx('select');
    this.tweens.add({ targets: this.continueBtn, alpha: 0, duration: 300 });
    await this.fadeOut(1200, 0xf8f1e2);
    const L = this.L;
    const t = makeText(this, L.width / 2, L.height * 0.42, STRINGS.chapter2.toBeContinued, {
      fontFamily: FONT_TITLE, fontStyle: '600', fontSize: '34px', color: '#9a6a2a',
      padding: { top: 10, bottom: 4, left: 4, right: 4 },
    }).setOrigin(0.5).setAlpha(0).setDepth(110);
    const gem = this.add.image(L.width / 2, L.height * 0.42 - 50, 'star-core')
      .setScale(Math.max(2, Math.round(3 * L.zoom)) / L.zoom).setTint(0xf0c060).setAlpha(0).setDepth(110);
    const replay = new SmallButton(this, L.width / 2, L.height * 0.42 + 70, 170, 48, STRINGS.chapter2.replay, () => {
      soundManager.sfx('select');
      this.scene.restart({ start: 'path' });
    });
    replay.setAlpha(0).setDepth(110);
    this.ui.add([t, gem, replay]);
    this.uiTexts.push(t, replay.label);
    this.tweens.add({ targets: [t, gem], alpha: 1, duration: 900 });
    this.tweens.add({ targets: replay, alpha: 1, duration: 900, delay: 1400 });
  }

  // ================================================================ frame
  update(time, dt) {
    const t = time / 1000;
    const { star } = this;
    if (star) {
      if (this.starAhead && this.minh) {
        // Lead the way ~60 px ahead along the path.
        const ty = Math.min(this.minh.y, this.thuy.y) - 62;
        const tx = pathX(FOREST_PATH, ty);
        star.setPosition(Phaser.Math.Linear(star.x, tx, 0.04), Phaser.Math.Linear(star.y, ty, 0.04));
      }
      star.update(dt);
      this.starLight.x = star.core.x;
      this.starLight.y = star.core.y;
      if (this.starLit) this.starLight.intensity = 0.7 + 0.15 * star.brightness;
    }
    if (this.keyFollows && this.minh) {
      const kx = this.midX();
      const ky = Math.min(this.minh.y, this.thuy.y) - 40 + Math.sin(t * 2) * 1.5;
      this.key.setPosition(kx, ky);
      this.keyGlow.setPosition(kx, ky);
    }
    if (this.keyLight) {
      this.keyLight.x = this.key.x;
      this.keyLight.y = this.key.y;
    }
    this.fireflies?.update(dt);
    swayUpdate(this.swayers || [], t);
    (this.butterflies || []).forEach((b) => {
      const a = t * b.sp + b.ph;
      b.o.setPosition(b.cx + Math.cos(a) * b.r, b.cy + Math.sin(a * 1.3) * b.r * 0.6 + Math.sin(t * 3 + b.ph) * 1.5);
      b.o.setTexture(Math.sin(t * 14 + b.flap) > 0 ? 'butterfly-0' : 'butterfly-1');
      b.o.setFlipX(Math.cos(a) > 0);
    });
  }
}
