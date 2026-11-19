import Phaser from 'phaser';
import { viewport, fitCamera, WORLD_W, editingText } from '../utils/viewport.js';
import { makeText, refreshTextResolution } from '../utils/text.js';
import { FONT_TITLE, FONT_BODY } from '../config/theme.js';
import { MinhCharacter } from '../characters/MinhCharacter.js';
import { ThuyCharacter } from '../characters/ThuyCharacter.js';
import { loadCharacterSheets } from '../characters/characterAnimations.js';
import { soundManager } from '../audio/SoundManager.js';
import { AUDIO_KEYS, MAIN_MUSIC } from '../audio/audioKeys.js';
import { WEDDING } from '../config/event.vi.js';
import { MARIO_TEXT as T } from '../config/mario.vi.js';
import { createLevelArt, PAL } from '../mario/LevelArt.js';
import { LevelPath, ramp, smooth } from '../mario/LevelPath.js';
import { Track, Beat } from '../mario/Timeline.js';
import { ScrollDriver } from '../mario/ScrollDriver.js';
import { RsvpDialog } from '../mario/RsvpDialog.js';
import { PhotoBook } from '../mario/Photos.js';
import { fillInfoCard, QuickView } from '../mario/InfoCard.js';
import { TitleIntro } from '../mario/TitleIntro.js';
import { ScreenNav } from '../mario/ScreenNav.js';
import { readGuest, savedRsvp } from '../mario/rsvp.js';
import { showMusicToggle } from '../ui/MusicToggle.js';

/*
 * ONE COMPACT LEVEL (five sections):
 *   1 Opening platform (Late Groom, turtle) → two brick steps →
 *   2 Date platform under the calendar (Minh checks it) → the secret pipe right after it →
 *   3 SECRET PIPE: a quick descent past clouds, treetops, roots and warm light →
 *   4 Side exit straight into the venue (sign + 📍 map button; flower + suit) →
 *   5 RSVP + finish on the same floor (flag at the right end, late turtle from the pipe).
 * The full Great Drop lives on in git (tag `with-great-drop`, src/game/mario/GreatDrop.js).
 *
 * Ground rule: every walkable surface is the TOP edge of a grass strip at y = Y*,
 * and a character's (x, y) is the point between its feet (sprite origin 42.5/48).
 */

// ------------------------------------------------------------------ layout (world units; 1 art px = 2 units)
const ART = 2;
// FOUR SCREENS (one swipe = one screen). The level is still one deterministic
// timeline of progress b; each screen is a stable stop on it and a swipe plays
// the stretch to the next stop on a clock, at the animation's own speed:
//   0 WELCOME (after BẮT ĐẦU)  →  1 WEDDING DATE  →  2 SEASONS  →  3 RSVP & ENDING
const SCREEN_LABELS = ['Màn 1: Chào mừng', 'Màn 2: Ngày cưới', 'Màn 3: Tiệc cưới tại Seasons', 'Màn 4: Trả lời thiệp'];
const Y0 = 500; // opening
const Y1 = 860; // date platform (pipe entrance)
const YV = Y1 + 560; // venue floor (pipe exit) — also the RSVP + finish floor
const DIRT_H = 26; // shallow strip of earth under the venue slab (no deep underground)
const WORLD_BOTTOM = YV + 300;
const PIPE_X = 60;
const PIPE_TOP = Y1 - 44; // rim on the date platform
const CLIFF_X = 104; // right face of the earth column the pipe runs down
const MOUTH_X = 114; // side-facing pipe mouth on the venue floor
const WARM_Y = Y1 + 330; // sky gives way to the warm garden light
const FINISH_X = 216; // little checkered finish line on the venue floor
const TURTLE_FROM = 96; // the late turtle comes out of the pipe mouth…
const TURTLE_STOP = 226; // …and stops just over the line, clear of Thủy (x 266)
const POLE_X = 306;
const CAL = { x: 46, y: 606, w: 194, h: 164 }; // the wall calendar (a mystery block until Thủy bumps it)
const CAL_DATES = ['22.12.2026', '23.12.2026']; // pages it flips through before the wedding date
const BOX_X = 184; // the Surprise Box floats over the venue floor…
const BOX_Y = YV - 90; // …just above Thủy's head (she can bump it from below)
const HUD_H = 30; // compact HUD pill (logical units)
const G = 34; // Thủy usually walks this far ahead of Minh
const LAND_X = 262; // Gentle Glide touchdown on the date platform, just right of the calendar
const HEART_COUNT = 9; // nine big hearts along the route…
const HEART_VALUE = 11; // …worth 11 each: 9 × 11 = 99

const DEPTH = {
  sky: -100, farHills: -95, clouds: -90, birds: -80, hills: -60, deco: -20, board: 10, props: 20,
  ground: 100, earth: 90, coins: 120, chars: 300, prop: 305, fx: 350, pipe: 400, front: 450, hud: 1000,
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
// The approved sheets have no jump frame; these existing poses read as "airborne".
const JUMP_POSE = { minh: 'offer', thuy: 'flare' };
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function buildPath() {
  return new LevelPath([
    { id: 'p0', type: 'run', x0: 150, y0: Y0, x1: 282, y1: Y0, len: 132 },
    // THE GENTLE GLIDE: off the ledge, out over the open sky right of the calendar,
    // and softly down onto the date platform (no steps, no walls)
    { id: 'gd', type: 'glide', x0: 282, y0: Y0, x1: LAND_X, y1: Y1, h: 16, out: 50, sway: 6, len: 90 },
    { id: 'p1', type: 'run', x0: LAND_X, y0: Y1, x1: 112, y1: Y1, len: LAND_X - 112 },
    { id: 'j2', type: 'jump', x0: 112, y0: Y1, x1: PIPE_X, y1: PIPE_TOP, h: 56, len: 40, camFrom: Y1, camTo: Y1 },
    { id: 'pipe', type: 'pipe', x0: PIPE_X, y0: PIPE_TOP, x1: PIPE_X, y1: YV, len: 110, camFrom: Y1, camTo: YV, camHold: 18 },
    { id: 'tube', type: 'run', x0: PIPE_X, y0: YV, x1: 130, y1: YV, len: 70, hideBefore: CLIFF_X + 6, anchorFrom: 0.66, anchorTo: 0.8 },
    // one main floor: venue, RSVP and finish line. At the venue the floor sits low on
    // screen (info card above, no empty band below); render() then eases into the
    // final composition that leaves room for the RSVP box.
    { id: 'gl', type: 'run', x0: 130, y0: YV, x1: 340, y1: YV, len: 210, anchor: 0.8 },
  ]);
}

// ------------------------------------------------------------------ DOM loader
const loaderUI = {
  el: () => document.getElementById('boot-loader'),
  progress(p) {
    const fill = document.getElementById('ld-fill');
    if (fill) fill.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
    document.querySelector('.ld-bar')?.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  },
  /** Assets are ready: fade the loader out (no extra screen, no artificial delay). */
  ready(onReady) {
    const el = this.el();
    this.progress(1);
    onReady();
    if (!el) return;
    el.classList.add('is-done');
    setTimeout(() => el.remove(), 500);
  },
};

export class LevelScene extends Phaser.Scene {
  constructor() {
    super('Level');
  }

  // ================================================================ preload (only what the journey uses)
  preload() {
    this.load.on('progress', (p) => loaderUI.progress(p));
    this.load.on('loaderror', (file) => console.warn('[level] could not load', file.key));
    loadCharacterSheets(this);
    ['select', 'dialog', 'confirm', 'photoCoin', 'mapOpen', 'mapClose', 'flowerFix', 'land', 'unfold'].forEach((k) => {
      const s = AUDIO_KEYS.sfx[k];
      this.load.audio(s.key, [s.url]);
    });
  }

  // ================================================================ create
  create() {
    this.layout = viewport.layout;
    this.reducedMotion = reduceMotion();
    this.guest = readGuest();
    this.answer = savedRsvp(this.guest); // this invitation's own answer, only after the backend confirmed
    this.path = buildPath();
    this.texts = [];
    this.introDone = false;
    this.b = 0;
    this.lastSfx = {};
    this.prevB = 0;

    createLevelArt(this);
    this.cameras.main.setBackgroundColor(PAL.sky);
    fitCamera(this.cameras.main, this.layout);

    this.buildTimeline();
    this.buildWorld();
    this.buildHearts();
    this.buildCharacters();
    this.glideFx = this.add.graphics().setDepth(DEPTH.chars - 1);
    this.buildHud();

    // the transparent layer above the canvas: taps (coins, HUD) and swipes; it no longer scrolls
    this.scroller = new ScrollDriver();
    this.scroller.el.scrollTop = 0;
    this.scroller.enable(false);
    this.screen = 0;
    this.play = null;

    this.dialog = new RsvpDialog({
      root: document.getElementById('rsvp'),
      guest: this.guest,
      reducedMotion: this.reducedMotion,
      onConfirmed: (rec) => this.onRsvpConfirmed(rec),
    });
    this.layoutFinal();
    this.photos = new PhotoBook({ scroller: this.scroller, onChange: (n) => this.setPhotoHud(n) });
    this.buildPhotoCoins();
    this.setPhotoHud(this.photos.count);
    this.setupEndActions();
    this.setupTaps();
    this.quick = new QuickView({
      guest: this.guest,
      reducedMotion: this.reducedMotion,
      getAnswer: () => this.answer,
      onConfirmed: (rec) => this.onRsvpConfirmed(rec, { quiet: true }),
      onPlay: () => { if (!this.introDone) document.getElementById('start-btn')?.click(); else this.scroller.el.focus({ preventScroll: true }); },
      onPhotos: () => this.photos.openGallery(false),
      isStarted: () => this.introDone,
      photoCount: () => this.photos.count,
    });
    this.nav = new ScreenNav({
      el: this.scroller.el,
      count: SCREEN_LABELS.length,
      labels: SCREEN_LABELS,
      onNext: () => this.goNext(),
      onPrev: () => this.goPrev(),
      onGo: (i) => this.goTo(i),
    });
    this.infoBtn = document.getElementById('info-btn');
    this.infoBtn?.addEventListener('click', () => { soundManager.sfx('select'); this.quick.open(this.infoBtn); });

    soundManager.preloadMusic(this, AUDIO_KEYS.music[MAIN_MUSIC]);

    this._onViewport = (l) => this.onResize(l);
    viewport.on('change', this._onViewport);
    this.events.once('shutdown', () => viewport.off('change', this._onViewport));

    this.render(0, 16, true);
    // personalised title world + "break the START button" intro
    this.intro = new TitleIntro(this, {
      guestName: this.guest.name,
      landM: 150, landT: 184, groundY: Y0,
      reducedMotion: this.reducedMotion,
      depth: DEPTH,
      onPress: () => this.start(),
      onDone: () => this.beginPlay(),
    });
    document.getElementById('quick-btn')?.addEventListener('click', (e) => this.quick.open(e.currentTarget));
    loaderUI.ready(() => this.intro.show());
  }

  // ================================================================ timeline
  buildTimeline() {
    const P = this.path;
    const D = (id, x) => P.dAtX(id, x);
    const S = (id) => P.startOf(id);
    const E = (id) => P.endOf(id);
    const M = new Track(0); // Minh, starts at x 150 with his notebook out
    const H = new Track(G); // Thủy, starts at x 184
    const beats = [];
    const cues = []; // [b, sfx]

    // ---- 1 THE LATE GROOM — Thủy sets off, Minh is still reading his notebook.
    // (screen 2) Thủy runs ahead; Minh stops to check his calendar — ✓ — and catches up
    M.hold(14, { pose: ['stand', 'down'], prop: 'notebook' });
    M.hold(7, { pose: ['stand', 'right'], emote: 'emoteExcl' }); // looks up... she has gone!
    M.key(68, D('p0', 244)); // hurries after her
    beats.push(new Beat('lateGroom', 0, 68));

    // ---- THE GENTLE GLIDE (scroll-driven: every pose below is a pure function of b)
    // A: Thủy reaches the ledge, looks down… and hops off; her veil catches the breeze.
    H.walkTo(D('p0', 238), null, 2.2); // sets off briskly while he is still reading
    this.bLedgeT = H.walkTo(S('gd'), null, 1.0); // …then strolls to the edge as he catches up
    H.hold(5, { pose: ['nod', 'down'] }); // looks down
    const bGlideT = H.last.b;
    cues.push([bGlideT + 1, 'jump']);
    H.move(46, E('gd'), { pose: ['flare', 'down'], glide: 'thuy' });
    const bLandT = H.last.b;
    // C: soft landing — knees bend (squash), dress settles, then a step aside
    H.hold(4, { pose: ['stand', 'down'] });
    H.move(8, D('p1', LAND_X - 30));
    // B: Minh waits beside her (x 244) until she has jumped, steps up to the
    // ledge, looks down, hesitates… and follows.
    M.holdUntil(bGlideT + 2, { pose: ['stand', 'right'] }); // waits at x 244
    M.walkTo(S('gd') - 4, null, 1.6);
    M.hold(4, { pose: ['nod', 'down'] }); // looks down
    M.hold(6, { pose: ['stand', 'down'], emote: 'emoteSweat' }); // …hesitates
    M.move(3, S('gd'));
    const bGlideM = M.last.b;
    cues.push([bGlideM + 1, 'jump']);
    const midM = S('gd') + 0.45 * (E('gd') - S('gd'));
    M.move(16, midM, { pose: ['offer', 'down'], glide: 'minh' }); // arms out for balance
    M.move(18, E('gd'), { pose: ['offer', 'down'], glide: 'minh', emote: 'emoteExcl' }); // a cloud!
    const bLandM = M.last.b;
    M.hold(6, { pose: ['stand', 'down'], wobble: true }); // loses his balance for a moment
    M.hold(8, { adjust: true }); // straightens his jacket
    H.holdUntil(bLandM + 4, { pose: ['stand', 'right'] }); // Thủy turns toward him… and walks on
    beats.push(new Beat('gentleGlide', bGlideT - 10, M.last.b));
    Object.assign(this, { bGlideT, bLandT, bGlideM, bLandM });

    // ---- 2 THE MYSTERY CALENDAR — the wall calendar is a big "?" block. Thủy
    // bumps it from below: it bounces, its pages flip 22 → 23 → 24.12.2026 and
    // the header shows THỨ NĂM. Minh, ever thorough, audits it in his notebook.
    // A: discovery
    H.walkTo(D('p1', 150), null, 1.4); // right under the calendar
    M.walkTo(D('p1', 196), null, 1.4); // Minh beside her
    H.holdUntil(Math.max(H.last.b, M.last.b - 4), { face: 'down' });
    H.hold(7, { pose: ['stand', 'up'], emote: 'emoteQ' }); // looks up at the "?"
    const bCalSeen = H.last.b;
    M.holdUntil(bCalSeen - 4, { pose: ['stand', 'left'] });
    M.holdUntil(bCalSeen, { pose: ['stand', 'up'] }); // glances up at it too
    // B: jump and hit — head meets the calendar's underside at the top of the arc
    H.hold(3, { pose: ['nod', 'down'] }); // crouch
    const bCalJump0 = H.last.b;
    H.hold(10, { hop: 34, pose: ['jump', 'down'] }); // veil and dress flare
    const bCalHit = bCalJump0 + 5;
    H.hold(3, { pose: ['stand', 'down'] }); // lands back on the platform
    cues.push([bCalJump0, 'jump'], [bCalHit, 'bump'], [bCalJump0 + 10, 'land']);
    // C: the reveal — three page flips, slowing on the last; THỨ NĂM; sparkle
    const bFlip0 = bCalHit + 1;
    const bCalDone = bFlip0 + 16;
    cues.push([bFlip0, 'unfold'], [bFlip0 + 4, 'blip'], [bFlip0 + 9, 'blip'], [bCalDone, 'chime']);
    // D: the auditor — notebook out, check, pause, look again, nod, ✓, notebook away
    M.holdUntil(bCalDone, { pose: ['stand', 'up'] });
    M.hold(4, { pose: ['stand', 'down'], prop: 'notebook' });
    M.hold(5, { pose: ['nod', 'down'], prop: 'notebook' }); // checks the date…
    M.hold(3, { pose: ['stand', 'down'], prop: 'notebook' }); // …pause
    M.hold(4, { pose: ['stand', 'up'], prop: 'notebook' }); // looks at the calendar again
    M.hold(3, { pose: ['nod', 'down'], prop: 'notebook' }); // nods
    M.hold(6, { pose: ['stand', 'down'], prop: 'notebook', emote: 'emoteCheck' }); // ✓
    const bCalCheck = M.last.b - 6;
    M.hold(3, { pose: ['stand', 'down'] }); // notebook closed
    cues.push([bCalCheck, 'check']);
    H.holdUntil(bCalDone + 6, { face: 'down' });
    H.hold(9, { pose: ['stand', 'right'], emote: 'emoteDots' }); // waits for him… "…"
    // screen 2 stop: both idle under the revealed calendar
    this.bDate = Math.max(H.last.b, M.last.b) + 2;
    H.holdUntil(this.bDate, { face: 'down' });
    M.holdUntil(this.bDate, { face: 'down' });
    beats.push(new Beat('mysteryCalendar', bCalSeen - 8, this.bDate));
    Object.assign(this, { bCalSeen, bCalJump0, bCalHit, bFlip0, bCalDone, bCalCheck });

    // ---- 3 THE PIPE INSPECTION — Thủy hops straight in; Minh inspects it first…
    // A: arrival — she spots the pipe, pauses, hops in and vanishes
    const bSpot0 = H.walkTo(D('p1', 138), null, 1.8);
    H.hold(6, { pose: ['stand', 'left'], emote: 'emoteExcl' }); // a pipe!
    const bSpot1 = H.last.b;
    H.move(8, S('j2')); // runs to it
    const bRun1 = H.last.b;
    H.hold(3, { pose: ['nod', 'down'] }); // gets ready…
    const bTJump0 = H.last.b;
    cues.push([bTJump0, 'jump']);
    H.move(16, E('j2')); // …a clear jump arc onto the pipe's rim
    const bTRim = H.last.b;
    cues.push([bTRim, 'land']);
    H.hold(4, { pose: ['stand', 'down'] }); // steadies herself on the rim
    const bThuyIn = H.last.b;
    cues.push([bThuyIn, 'pipe']);
    // ~5.5 px of drop per path unit: +13 takes her head just below the rim, so
    // dress, then veil slip down behind it (the rim and pipe draw over her)
    H.move(13, S('pipe') + 13);
    const bThuySunk = H.last.b;
    H.move(12, S('tube')); // (out of sight) down the pipe…
    H.move(8, D('tube', 96)); // …and waits, hidden, in the side tube
    // B: inspection — Minh climbs onto the rim, taps it twice, listens, looks in
    M.walkTo(D('p1', 140), null, 1.5);
    M.move(10, D('p1', 122)); // cautious
    M.holdUntil(Math.max(M.last.b + 1, bThuySunk + 1), { pose: ['stand', 'left'] }); // watches her vanish
    M.hold(5, { pose: ['stand', 'left'], emote: 'emoteQ' }); // …hmm
    const bMLook = M.last.b;
    cues.push([bMLook, 'jump']);
    M.move(15, E('j2')); // hops up onto the rim
    const bInsp0 = M.last.b;
    M.hold(3, { pose: ['nod', 'down'] }); // looks down
    M.hold(3, { pose: ['reach', 'down'] }); // tap…
    const bTap1 = M.last.b - 2;
    M.hold(2, { pose: ['nod', 'down'] });
    M.hold(3, { pose: ['reach', 'down'] }); // …tap
    const bTap2 = M.last.b - 2;
    M.hold(6, { pose: ['stand', 'down'] }); // a pause… nothing happens
    const bPause1 = M.last.b;
    M.hold(8, { pose: ['nod', 'down'], emote: 'emoteQ' }); // leans in to inspect the opening
    const bRumble = M.last.b;
    cues.push([bTap1, 'tap'], [bTap1, 'fx:tap'], [bTap2, 'tap'], [bTap2, 'fx:tap'], [bRumble, 'rumble']);
    // C: the unexpected pull — rumble, "!", arms fly up, legs kick… gone
    M.hold(5, { pose: ['stand', 'down'], emote: 'emoteExcl' });
    const bPull = M.last.b;
    this.bPull = bPull;
    M.hold(2, { pose: ['offer', 'down'] }); // arms up!
    cues.push([bPull + 1, 'slide']);
    cues.push([bPull + 3, 'whoosh']);
    // ~5 units of drop per path unit: +8 ≈ 40 deep, so his legs still stick out.
    M.move(8, S('pipe') + 8, { dive: true });
    M.move(6, S('pipe') + 18, { dive: true });
    const bGone = M.last.b;
    M.move(24, S('tube')); // the camera rides down with him
    M.move(6, D('tube', 92)); // into the side tube (hidden)
    const bDown = M.last.b;
    // D: exit — Thủy pops out first and lands; Minh follows, far too high
    H.holdUntil(bDown + 1);
    H.move(4, D('tube', 112)); // slides out of the mouth…
    cues.push([H.last.b, 'jump']);
    H.move(9, D('gl', 172), { hop: 14, pose: ['jump', 'right'] }); // …hops clear and lands
    const bThuyOut = H.last.b;
    cues.push([bThuyOut, 'land'], [bThuyOut, 'fx:dustThuy']);
    H.hold(3, { pose: ['stand', 'right'] });
    M.holdUntil(bThuyOut + 3);
    M.move(4, E('tube'));
    cues.push([M.last.b, 'jump']);
    M.hold(10, { hop: 34, pose: ['jump', 'right'] }); // pops out much higher than expected…
    const bMinhOut = M.last.b; // …and lands with a puff of dust
    cues.push([bMinhOut, 'land'], [bMinhOut, 'fx:dustMinh']);
    H.holdUntil(bMinhOut, { pose: ['stand', 'left'] }); // she turns to look at him
    M.hold(5, { pose: ['stand', 'down'], wobble: true, emote: 'emoteSweat' }); // a bit dishevelled
    M.hold(11, { adjust: true }); // straightens his jacket
    const bSuit1 = M.last.b;
    beats.push(new Beat('secretPipe', bThuyIn - 50, bMinhOut));
    Object.assign(this, { bThuyIn, bThuySunk, bMinhOut, bTap1, bTap2, bGone, bRumble });

    // ---- 4 THE SURPRISE BOX — Thủy bumps a mystery block: out pops the invitation (11:00)
    // A: discovery (overlaps Minh's jacket fix)
    M.walkTo(D('gl', 148), null, 1.6); // Minh steps up beside her
    const bMinhThere = M.last.b;
    H.hold(4, { pose: ['stand', 'left'] });
    H.walkTo(D('gl', BOX_X), null, 1.2); // walks on… right under the block
    H.holdUntil(bMinhThere - 4, { face: 'right' });
    H.hold(7, { pose: ['stand', 'up'], emote: 'emoteQ' }); // looks up: ?
    const bBoxSeen = H.last.b;
    M.holdUntil(bBoxSeen - 3, { pose: ['stand', 'right'] });
    M.holdUntil(bBoxSeen, { pose: ['stand', 'up'] }); // Minh turns toward the block too
    // B: the jump — a little crouch, then up she goes and bumps it from below
    H.hold(3, { pose: ['nod', 'down'] }); // crouch
    const bJump0 = H.last.b;
    H.hold(10, { hop: 22, pose: ['jump', 'down'] }); // veil and dress flare
    const bHit = bJump0 + 5; // the top of the arc
    H.hold(3, { pose: ['stand', 'down'] }); // lands back on the floor
    cues.push([bJump0, 'jump'], [bHit, 'bump'], [bHit + 0.5, 'pop'], [bHit + 7, 'chime'], [bJump0 + 10, 'land']);
    // C: the surprise — a little card pops out, spins, sparkles, opens up: 11:00 · TIỆC CƯỚI
    const bSign = bHit + 13; // fully open and readable from here
    // D: Minh's reaction — out comes the notebook: he double-checks what she just found
    M.holdUntil(bHit + 9, { pose: ['stand', 'up'] });
    M.hold(4, { pose: ['stand', 'down'], prop: 'notebook' }); // notebook out
    M.hold(6, { pose: ['nod', 'down'], prop: 'notebook' }); // checks it…
    M.hold(5, { pose: ['stand', 'up'], prop: 'notebook' }); // …looks at the card
    M.hold(4, { pose: ['nod', 'down'], prop: 'notebook' }); // approving nod
    M.hold(7, { pose: ['stand', 'down'], prop: 'notebook', emote: 'emoteCheck' }); // ✓
    const bChecked = M.last.b - 6;
    cues.push([bChecked, 'check']);
    H.holdUntil(bChecked, { face: 'down' });
    H.hold(6, { pose: ['stand', 'left'] }); // she glances at him…
    const bSign1 = Math.max(H.last.b, M.last.b); // the card hands over to the info card
    const bF1 = bSign1 + 6; // …and both are back to idle
    H.holdUntil(bF1, { face: 'down' });
    M.holdUntil(bF1, { face: 'down' });
    beats.push(new Beat('surpriseBox', bSuit1 - 8, bF1));
    Object.assign(this, { bBoxSeen, bJump0, bHit, bSign, bSign1, bF1 });

    // ---- 5 FLOWER — on the way to the RSVP spot Thủy fixes a crooked flower
    H.walkTo(D('gl', 188), null, 1.0);
    H.hold(6, { pose: ['stand', 'right'], emote: 'emoteExcl' }); // notices the crooked flower
    const bFix0 = H.last.b;
    H.hold(14, { pose: ['reach', 'down'] }); // straightens it
    const bFix1 = H.last.b;
    H.move(5, D('gl', 180), { pose: ['stand', 'right'] }); // steps back…
    H.hold(8, { pose: ['stand', 'right'], emote: 'emoteHeart' }); // …inspects it: perfect
    const bFlowerDone = H.last.b;
    M.holdUntil(bFix0, { face: 'down' });
    M.holdUntil(bFlowerDone, { pose: ['stand', 'right'] }); // watches her
    cues.push([bFix0 + 2, 'flowerFix']);
    beats.push(new Beat('venue', bF1, bFlowerDone));
    Object.assign(this, { bFix0, bFix1, bFlowerDone });

    // ---- 5 RSVP gate on the same floor (Minh x 200, Thủy x 236, both facing the guest)
    const bGate = Math.max(H.walkTo(D('gl', 236), null, 1.6), M.walkTo(D('gl', 200), null, 1.4));
    const bR = bGate + 8;
    M.holdUntil(bR, { face: 'down' });
    H.holdUntil(bR, { face: 'down' });
    this.bR = bR;

    // ---- THE FINISH LINE (same screen): Minh dashes past her to the flag…
    M.key(bR + 30, D('gl', 296));
    M.hold(14, { hop: 22, pose: ['wave', 'down'], celebrate: true }); // victory jump at the pole
    M.hold(6, { pose: ['stand', 'left'] });
    // …Thủy notices the flag is crooked and straightens it
    H.holdUntil(bR + 44, { face: 'down' });
    H.hold(10, { pose: ['stand', 'right'], emote: 'emoteExcl' });
    H.move(14, D('gl', 266));
    const bFlag0 = H.last.b;
    H.hold(18, { pose: ['reach', 'up'] });
    const bFlag1 = H.last.b;
    H.hold(8, { pose: ['stand', 'right'] });
    const bTogether = H.last.b;
    M.holdUntil(bTogether, { pose: ['stand', 'left'] });
    H.hold(18, { hop: 16, pose: ['flare', 'down'], celebrate: true });
    M.hold(18, { hop: 16, pose: ['wave', 'down'], celebrate: true });
    H.hold(14, { pose: ['raise', 'down'] }); // both wave to the guest
    M.hold(14, { pose: ['wave', 'down'] });
    // …a short pause, then — finally — the turtle pokes out of the pipe and crosses the line.
    const bTurtle0 = bTogether + 18 + 10;
    const bTurtle1 = bTurtle0 + 44;
    const bCross = bTurtle0 + 44 * ((FINISH_X - TURTLE_FROM) / (TURTLE_STOP - TURTLE_FROM));
    const bEnd = bTurtle1 + 4;
    H.holdUntil(bEnd + 40, { face: 'down' });
    M.holdUntil(bEnd + 40, { face: 'down' });
    cues.push([bFlag0 + 2, 'flowerFix']);
    cues.push([bTogether + 2, 'victory']);
    cues.push([bTurtle0 + 4, 'turtle']);
    cues.push([bCross, 'check']); // the turtle's tiny victory
    beats.push(new Beat('finishLine', bR + 30, bEnd));
    Object.assign(this, { bFlag0, bFlag1, bTogether, bEnd, bTurtle0, bTurtle1 });

    // ---- PLAYBACK TIMING: real milliseconds per stretch of the timeline, set
    // beat by beat (ENTER -> PERFORM -> SETTLE) instead of one speed for all:
    // walks keep a natural pace, reactions and pauses get time to read.
    const T = []; let tb = 0;
    const seg = (b1, ms) => { if (b1 > tb + 1e-6) { T.push([tb, b1, ms]); tb = b1; } };
    const pace = (b1, msPerB) => seg(b1, (b1 - tb) * msPerB);
    // page 1 -> 2: opening → Gentle Glide → Mystery Calendar
    seg(14, 800); // Thủy sets off; Minh reads his notebook
    seg(21, 750); // looks up: she has gone!
    seg(bGlideT - 1, 1250); // runs after her; Thủy reaches the ledge and looks down
    seg(bLandT, 1800); // Thủy hops off and floats down; Minh hesitates at the edge
    seg(bLandM, 1250); // Minh follows, arms out
    seg(bLandM + 4, 300); // lands, wobbles…
    seg(bLandM + 14, 450); // …straightens his jacket while Thủy walks on
    seg(this.bCalSeen - 7, 550); // both step under the calendar
    seg(this.bCalSeen, 700); // she looks up at the "?" — Minh glances up too
    seg(this.bCalJump0, 250); // crouch
    seg(this.bCalHit, 300); // jump… bump!
    seg(this.bFlip0, 120); // the calendar bounces
    seg(this.bFlip0 + 4, 330); // flip → 22.12
    seg(this.bFlip0 + 9, 430); // flip → 23.12
    seg(this.bCalDone, 750); // slow last flip → 24.12.2026 · THỨ NĂM · sparkle
    seg(this.bCalDone + 9, 450); // Minh: notebook out, checks…
    seg(this.bCalDone + 16, 380); // …pause, looks at the calendar again
    seg(this.bCalCheck + 6, 550); // nods ✓ (Thủy: "…")
    seg(this.bDate, 250); // notebook away; both idle
    // page 2 -> 3: Pipe Inspection → Surprise Box (one flowing scene)
    pace(bSpot0, 13); // …while Thủy already walks on
    seg(bSpot1, 300); // a pipe!
    seg(bRun1, 230); // runs to it
    seg(bTJump0, 180); // gets ready
    seg(bTRim, 550); // a clear jump arc onto the rim
    seg(bThuyIn, 180); // steadies on the rim
    seg(bThuySunk, 800); // sinks in gradually — dress, then veil, below the rim
    seg(bMLook, 320); // Minh, beside the pipe: "hmm?"
    seg(bInsp0, 350); // hops onto the rim
    seg(bInsp0 + 3, 200); // looks down
    seg(bTap1 + 2, 200); // tap
    seg(bTap2 - 1 + 0.001, 140);
    seg(bTap2 + 2, 200); // tap
    seg(bPause1, 420); // a pause… nothing happens
    seg(bRumble, 480); // leans in to inspect the opening
    seg(bPull, 300); // rumble — "!"
    seg(bPull + 2, 120); // arms fly up
    seg(bPull + 10, 260); // dragged in, legs kicking
    seg(bGone, 180); // gone
    seg(bDown, 540); // rides down the pipe (camera follows)
    seg(bThuyOut, 360); // Thủy pops out first and lands
    seg(bMinhOut, 480); // Minh pops out far too high… lands
    seg(bMinhOut + 5, 300); // dishevelled wobble
    seg(this.bBoxSeen - 7, 550); // jacket fix · she walks under the block
    seg(this.bBoxSeen, 550); // she looks up: ?
    seg(this.bJump0, 250); // crouch
    seg(this.bHit, 300); // jumps… bump!
    seg(this.bHit + 5, 450); // lands · a card pops out
    seg(this.bSign, 800); // spins, sparkles, opens up: 11:00 · TIỆC CƯỚI
    seg(this.bSign1, 1350); // Minh double-checks it in his notebook ✓, she glances at him
    seg(this.bF1, 400); // the card settles into the info card; idle
    // page 3 -> 4: the flower, then the RSVP spot
    seg(this.bFix0, 900); // walks on, notices the crooked flower
    seg(this.bFix1, 850); // straightens it
    seg(this.bFix1 + 5, 350); // steps back
    seg(this.bFlowerDone, 700); // inspects it: perfect
    pace(bR, 24); // both walk to their RSVP spots
    // after the RSVP: finish line and the late turtle
    seg(bR + 30, 600); // Minh dashes to the flag
    seg(bR + 44, 650); // victory jump
    seg(bR + 54, 550); // Thủy notices the flag is crooked
    seg(bFlag0, 400); // walks over
    seg(bFlag1, 750); // straightens it
    seg(bTogether, 400); // pause
    seg(bTogether + 18, 550); // they celebrate together
    seg(bTurtle0, 450); // wave to the guest… and wait
    seg(bTurtle1, 1500); // the turtle finally waddles across the line
    seg(bEnd, 150);
    this.timing = T;

    this.M = M;
    this.H = H;
    this.beats = beats;
    this.cues = cues.sort((a, b) => a[0] - b[0]);
  }

  // ================================================================ world
  addText(x, y, str, style, depth = DEPTH.board + 2) {
    const t = makeText(this, x, y, str, style).setOrigin(0.5, 0.5).setDepth(depth);
    this.texts.push(t);
    return t;
  }

  /** Brick slab whose grass top edge (the walking surface) is exactly at y. */
  platform(x0, x1, y, rows = 1, depth = DEPTH.ground) {
    const w = (x1 - x0) / ART;
    this.add.tileSprite(x0, y + 6, w, rows * 16, 'brick').setOrigin(0, 0).setScale(ART).setDepth(depth);
    this.add.tileSprite(x0, y, w, 6, 'grassTop').setOrigin(0, 0).setScale(ART).setDepth(depth + 1);
  }

  img(x, y, key, depth, originY = 1) {
    return this.add.image(x, y, key).setOrigin(0.5, originY).setScale(ART).setDepth(depth);
  }

  vines(xs, y, rng) {
    const g = this.add.graphics().setDepth(DEPTH.ground - 3);
    xs.forEach((x) => {
      const len = rng.between(14, 34);
      g.fillStyle(0x5d7f55).fillRect(x, y, 2, len);
      for (let k = 6; k < len; k += 8) g.fillStyle(0x8fb07e).fillRect(x + (k % 16 ? 2 : -3), y + k, 3, 2);
    });
  }

  buildWorld() {
    const W = WORLD_W;
    const hex = (s) => Phaser.Display.Color.HexStringToColor(s).color;
    const rng = new Phaser.Math.RandomDataGenerator(['minh-thuy']);

    // --- sky above, warm garden light below, joined by a stepped (dithered) band
    this.add.rectangle(0, -1500, W, WARM_Y + 1500, hex(PAL.sky)).setOrigin(0, 0).setDepth(DEPTH.sky);
    this.add.rectangle(0, WARM_Y + 24, W, WORLD_BOTTOM - WARM_Y + 400, hex(PAL.peachSky)).setOrigin(0, 0).setDepth(DEPTH.sky);
    const band = this.add.graphics().setDepth(DEPTH.sky);
    const sky = Phaser.Display.Color.HexStringToColor(PAL.sky);
    const peach = Phaser.Display.Color.HexStringToColor(PAL.peachSky);
    for (let k = 0; k < 6; k++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(sky, peach, 6, k + 1);
      band.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(0, WARM_Y + k * 4, W, 4);
    }
    [[Y0, 0xc9e6f0, 60], [Y1, 0xc9e6f0, 260]].forEach(([y, tint, x]) => {
      this.add.image(x, y + 2, 'hill').setOrigin(0.5, 1).setScale(ART * 2.6, ART * 2.2).setTint(tint).setDepth(DEPTH.farHills);
    });

    // --- parallax clouds + birds (sky part only)
    this.clouds = [];
    for (let i = 0; i < 12; i++) {
      const c = this.add.image(rng.between(-20, W + 20), -160 + i * 90 + rng.between(-20, 20), i % 3 === 2 ? 'cloudSmall' : 'cloud')
        .setScale(ART).setScrollFactor(1, 0.5).setDepth(DEPTH.clouds);
      c.baseX = c.x;
      c.speed = rng.realInRange(2, 5) * (i % 2 ? 1 : -1);
      this.clouds.push(c);
    }
    this.birds = [0, 1].map((i) => this.add.image(-30, 200 + i * 28, 'bird0').setScale(ART)
      .setScrollFactor(1, 0.8).setDepth(DEPTH.birds));
    this.img(80, Y0, 'hill', DEPTH.hills);
    // far hills sink a little as the camera passes (they stay tucked behind the platforms)
    this.farHills = this.children.list.filter((o) => o.texture?.key === 'hill' && o.depth === DEPTH.farHills);
    this.farHills.forEach((h) => { h.baseY = h.y; });
    // a few leaves drifting down by the opening tree and the garden trees
    this.leaves = [[44, Y0 - 80, 80], [60, Y0 - 70, 80], [176, Y1 + 300, YV - Y1 - 300], [278, Y1 + 262, YV - Y1 - 262], [300, Y1 + 280, YV - Y1 - 280]]
      .map(([x, y, range], i) => Object.assign(this.add.image(x, y, i % 2 ? 'leafRose' : 'leaf').setScale(ART).setDepth(DEPTH.deco + 2), { x0: x, y0: y, range, ph: i * 1.9 }));
    // drifting clouds in the open sky the couple glides through (slight parallax)
    this.glideClouds = [[300, Y0 + 120, 0.85, 'cloudSmall'], [338, Y0 + 250, 0.9, 'cloud']].map(([x, y, f, k]) =>
      this.add.image(x, y, k).setScale(ART).setScrollFactor(1, f).setAlpha(0.95).setDepth(DEPTH.clouds + 3));
    this.glideClouds.forEach((c) => { c.baseX = c.x; });
    // the little cloud Minh drifts past (position is a pure function of progress)
    this.minhCloud = this.add.image(380, Y0 + 205, 'cloudSmall').setScale(ART).setDepth(DEPTH.chars - 2).setVisible(false);

    // ===================== 1 OPENING
    this.platform(0, 290, Y0, 2);
    this.img(44, Y0, 'tree', DEPTH.deco);
    this.img(24, Y0 + 1, 'bush', DEPTH.front); // photo coin 1 hides behind this bush
    this.swayers = [this.img(240, Y0 + 1, 'flowers', DEPTH.front)];
    this.turtleOpen = this.add.image(96, Y0 + 1, 'turtle0').setOrigin(0.5, 1).setScale(ART).setDepth(DEPTH.chars - 1);
    this.titleGroup = [];
    const title = this.addText(W / 2, 196, WEDDING.couple, {
      fontFamily: FONT_TITLE, fontSize: '62px', color: '#fff7e6', stroke: '#8c4430', strokeThickness: 10,
      shadow: { offsetX: 0, offsetY: 5, color: '#5e2419', blur: 0, fill: true, stroke: true },
    });
    const date = this.addText(W / 2, 252, WEDDING.date, {
      fontFamily: FONT_TITLE, fontSize: '36px', color: '#ecc96a', stroke: '#5e2419', strokeThickness: 6,
    });
    this.titleGroup.push(title, date);
    const cg = this.add.graphics().setDepth(DEPTH.board);
    this.greetGroup = [cg];
    cg.fillStyle(0xd8ecf3).fillRoundedRect(38, 296, 284, 72, 22);
    cg.fillStyle(0xfffaf0).fillRoundedRect(36, 290, 284, 72, 22);
    cg.fillStyle(0xfffaf0).fillCircle(96, 292, 22).fillCircle(150, 284, 26).fillCircle(240, 288, 22);
    this.greetGroup.push(this.addText(W / 2 - 2, 312, T.greeting(this.guest.name), { fontFamily: FONT_BODY, fontSize: '24px', color: '#8c4430' })
      .setWordWrapWidth(270));
    this.greetGroup.push(this.addText(W / 2 - 2, 340, T.inviteLine, { fontFamily: FONT_BODY, fontSize: '24px', color: '#3b2620' }));

    // ===================== 2 DATE — wall calendar hanging under the opening platform:
    // a mystery block ("?") until Thủy bumps it; see buildCalendar / drawCalendar
    this.buildCalendar();
    // the date platform: the secret pipe stands at its left end, right after the calendar
    this.platform(0, W, Y1);
    this.swayers.push(this.img(196, Y1 + 1, 'flowers', DEPTH.front));
    this.vines([140, 200], Y1 + 38, rng);
    this.vines([120, 180, 250], Y0 + 70, rng);

    // ===================== 3 SECRET PIPE — earth column with the pipe in cross-section,
    // and the "descent" scenery beside it: clouds → treetops → warm light → garden
    this.add.tileSprite(0, Y1 + 38, CLIFF_X / ART, (YV - Y1 - 38) / ART, 'dirt').setOrigin(0, 0).setScale(ART).setDepth(DEPTH.earth);
    this.buildEarthColumn(rng);
    this.buildPipe();
    this.buildDescentScenery(rng);

    // ===================== 4 VENUE (pipe exit) — flowers; the essential information
    // (names, time, date, Seasons, address, 📍 map) is a readable DOM card, see placeVenueCard()
    // ONE main floor for the venue, the RSVP and the finish: a single brick course
    // over a shallow, ragged strip of earth — no deep underground below it.
    this.platform(0, W, YV);
    const dirt = this.add.graphics().setDepth(DEPTH.ground - 1);
    dirt.fillStyle(0x6e3c29).fillRect(0, YV + 38, W, DIRT_H);
    for (let x = 0; x < W; x += 8) {
      const h = 4 + ((x * 7) % 5) * 2; // stepped, ragged underside
      dirt.fillStyle(0x6e3c29).fillRect(x, YV + 38 + DIRT_H, 8, h);
      dirt.fillStyle(0x8a5236).fillRect(x + 2, YV + 42 + ((x * 3) % 4) * 4, 4, 2);
    }
    this.vines([150, 230, 318], YV + 38 + DIRT_H + 4, rng);
    this.tallFlower = this.add.image(204, YV, 'tallFlower').setOrigin(0.5, 1).setScale(ART).setDepth(DEPTH.props + 1);
    this.flowerSparkle = this.add.image(204, YV - 34, 'sparkle').setScale(ART).setDepth(DEPTH.fx).setVisible(false);
    this.swayers.push(this.img(176, YV + 1, 'flowers', DEPTH.front)); // photo coin 2 peeks out behind these, at the tree's foot
    this.butterfly = this.add.image(240, YV - 70, 'fly0').setScale(ART).setDepth(DEPTH.fx);
    this.venueCard = fillInfoCard(document.getElementById('venue-card'));
    // the Surprise Box (an original mystery block, not any game's artwork)
    this.box = this.add.image(BOX_X, BOX_Y, 'mysteryBlock').setScale(ART).setDepth(DEPTH.props + 2);
    this.boxCard = this.add.image(BOX_X, BOX_Y - 12, 'inviteCard').setScale(ART).setDepth(DEPTH.props + 1).setVisible(false);
    this.boxSparks = [[-30, -8], [28, -16], [-18, -34], [22, 4]].map(([dx, dy]) =>
      this.add.image(BOX_X + dx, BOX_Y - 40 + dy, 'sparkle').setScale(ART).setDepth(DEPTH.fx).setVisible(false));
    const sg = this.add.graphics();
    sg.fillStyle(0x3b2620).fillRect(-50, -32, 100, 64);
    sg.fillStyle(0xf8f0dd).fillRect(-48, -30, 96, 60);
    sg.fillStyle(0xc8704e).fillRect(-48, -30, 96, 14);
    sg.fillStyle(0xe6d7b8).fillRect(-48, 26, 96, 4);
    const sTag = makeText(this, 0, -23, WEDDING.eventName, { fontFamily: FONT_BODY, fontSize: '15px', color: '#fff7e6' }).setOrigin(0.5, 0.5);
    const sTime = makeText(this, 0, 7, WEDDING.time, { fontFamily: FONT_TITLE, fontSize: '34px', color: '#3b2620' }).setOrigin(0.5, 0.5);
    this.texts.push(sTag, sTime);
    this.boxSign = this.add.container(BOX_X, BOX_Y - 66, [sg, sTag, sTime]).setDepth(DEPTH.fx + 1).setVisible(false);
    this.cardTag = this.venueCard.querySelector('.ic-tag');

    // ===================== 5 RSVP + FINISH — same floor, right-hand end
    const pole = this.add.graphics().setDepth(DEPTH.props);
    pole.fillStyle(0x8f6a25).fillRect(POLE_X - 2, YV - 82, 4, 82);
    pole.fillStyle(0xecc96a).fillRect(POLE_X - 2, YV - 82, 2, 82);
    pole.fillStyle(0x3b2620).fillRect(POLE_X - 10, YV - 6, 20, 6);
    this.add.image(POLE_X, YV - 82, 'poleCap').setOrigin(0.5, 1).setScale(ART).setDepth(DEPTH.props + 1);
    // the flag flies to the left of the pole (towards the couple)
    this.flag = this.add.image(POLE_X - 2, YV - 78, 'flag').setOrigin(1, 0).setFlipX(true).setScale(ART).setDepth(DEPTH.props);
    const fin = this.add.graphics().setDepth(DEPTH.ground + 2); // checkered finish line
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 2; xx++) {
      fin.fillStyle((xx + yy) % 2 ? 0x3b2620 : 0xfffaf0).fillRect(FINISH_X - 6 + xx * 6, YV + yy * 3, 6, 3);
    }
    // the late turtle waits inside the pipe (hidden behind its mouth) until the very end
    this.turtle = this.add.image(TURTLE_FROM, YV + 1, 'turtle0').setOrigin(0.5, 1).setScale(ART).setDepth(DEPTH.pipe - 1);
  }

  /** Earth column the pipe runs down: roots near the top, rocks and gems deeper. */
  buildEarthColumn(rng) {
    const g = this.add.graphics().setDepth(DEPTH.earth + 1);
    for (let i = 0; i < 9; i++) { // roots hanging from the platform above
      const x = [8, 22, 92, 98][i % 4] + rng.between(-2, 2);
      const len = rng.between(20, 60);
      for (let k = 0; k < len; k += 2) g.fillStyle(0x5a4030).fillRect(x + Math.round(Math.sin(k * 0.3) * 2), Y1 + 40 + k, 2, 2);
    }
    for (let i = 0; i < 16; i++) { // underground rocks and a few gems
      const x = rng.between(1, 48) * 2; const y = rng.between((Y1 + 120) / 2, (YV - 20) / 2) * 2;
      if (Math.abs(x - PIPE_X) < 32) continue;
      if (i % 5 === 0) {
        g.fillStyle(0xecc96a).fillRect(x, y, 4, 4);
        g.fillStyle(0xffffff).fillRect(x, y, 2, 2);
      } else {
        g.fillStyle(0xb39a86).fillRect(x, y, 8 + (i % 3) * 2, 6);
        g.fillStyle(0xd2bfae).fillRect(x, y, 4, 2);
      }
    }
    for (let y = Y1 + 40; y < YV - 4; y += 8) { // rough right face of the column, mossy at the top
      const w = rng.between(2, 5) * 2;
      g.fillStyle(y < Y1 + 120 ? 0x5d7f55 : 0x6e3c29).fillRect(CLIFF_X, y, w, 8);
    }
  }

  buildPipe() {
    const bodyTop = PIPE_TOP + 20;
    const elbowY = YV - 60;
    this.add.tileSprite(PIPE_X, bodyTop, 24, (elbowY - bodyTop) / ART, 'pipeBody').setOrigin(0.5, 0).setScale(ART).setDepth(DEPTH.pipe);
    this.pipeRimTop = this.add.image(PIPE_X, PIPE_TOP, 'pipeRim').setOrigin(0.5, 0).setScale(ART).setDepth(DEPTH.pipe + 1);
    const g = this.add.graphics().setDepth(DEPTH.pipe);
    const x0 = PIPE_X - 24; const len = CLIFF_X - x0;
    g.fillStyle(0x3b2620).fillRect(x0 - 2, elbowY - 2, len + 2, 62);
    g.fillStyle(0xc8704e).fillRect(x0, elbowY, len, 58);
    g.fillStyle(0xe0936c).fillRect(x0, elbowY + 6, len, 6);
    g.fillStyle(0x8c4430).fillRect(x0, elbowY + 50, len, 8);
    g.fillStyle(0xe0936c).fillRect(PIPE_X - 16, elbowY, 6, 58);
    this.add.image(MOUTH_X, YV - 30, 'pipeRim').setScale(ART).setRotation(Math.PI / 2).setDepth(DEPTH.pipe + 1);
  }

  /** What you glimpse while the camera rides down beside the pipe. */
  buildDescentScenery(rng) {
    // clouds drifting past at the top of the descent
    [[170, Y1 + 90], [300, Y1 + 150], [230, Y1 + 230]].forEach(([x, y], i) => {
      this.add.image(x, y, i === 1 ? 'cloudSmall' : 'cloud').setScale(ART).setDepth(DEPTH.clouds + 2);
    });
    // treetops of two tall garden trees (their trunks stand on the venue floor)
    const g = this.add.graphics().setDepth(DEPTH.deco);
    const crown = (cx, cy, r) => {
      g.fillStyle(0x3f5d3f).fillCircle(cx - r * 0.5, cy + 4, r * 0.66).fillCircle(cx + r * 0.5, cy + 4, r * 0.66).fillCircle(cx, cy - r * 0.2, r * 0.7);
      g.fillStyle(0x8fb07e).fillCircle(cx - r * 0.5, cy + 2, r * 0.6).fillCircle(cx + r * 0.5, cy + 2, r * 0.6).fillCircle(cx, cy - r * 0.22, r * 0.64);
      g.fillStyle(0xb9d3a4).fillCircle(cx - r * 0.3, cy - r * 0.35, r * 0.26);
      for (let k = 0; k < 5; k++) g.fillStyle(k % 2 ? 0xe7a29a : 0xf8f0dd).fillRect(Math.round(cx + rng.between(-r, r) * 0.7), Math.round(cy + rng.between(-r, r) * 0.35), 4, 4);
    };
    [[176, Y1 + 300, 14], [278, Y1 + 260, 16]].forEach(([x, top, w]) => {
      g.fillStyle(0x6b4529).fillRect(x - w / 2, top, w, YV - top + 4);
      g.fillStyle(0x9a6a43).fillRect(x - w / 2, top, 4, YV - top + 4);
    });
    crown(176, Y1 + 300, 44);
    crown(278, Y1 + 262, 50);
    // soft, warm light slanting into the garden (no flash, just translucent rays)
    const rays = this.add.graphics().setDepth(DEPTH.deco + 1);
    [[330, 0.12], [262, 0.09]].forEach(([x, a]) => rays.fillStyle(0xffdc8a, a).fillTriangle(x, WARM_Y, x + 36, WARM_Y, x - 90, YV));
    const sun = this.add.graphics().setDepth(DEPTH.farHills);
    sun.fillStyle(0xfff1c4).fillCircle(318, WARM_Y + 70, 24);
    sun.fillStyle(0xffe08a).fillCircle(318, WARM_Y + 70, 18);
    [[180, 1.6], [330, 1.2]].forEach(([x, sc]) => {
      this.add.image(x, YV + 4, 'hillWarm').setOrigin(0.5, 1).setScale(ART * sc, ART * sc * 0.9).setTint(0xf3d3ad).setDepth(DEPTH.farHills + 1);
    });
    void rng;
  }

  // ================================================================ mystery calendar
  /**
   * The wall calendar (same size, colours, straps and border as before). Its
   * body is a container so the whole calendar can bounce; its pages are
   * separate sheets hinged at the top of the body so they can flip up:
   *   sheet 0 = big "?", sheets 1-2 = 22.12 / 23.12, sheet 3 = 24.12.2026.
   */
  buildCalendar() {
    const c = CAL;
    const g = this.add.graphics().setDepth(DEPTH.board);
    g.fillStyle(0x6b4529).fillRect(c.x + 28, Y0 + 70, 2, c.y - Y0 - 70).fillRect(c.x + c.w - 30, Y0 + 70, 2, c.y - Y0 - 70);
    g.fillStyle(0x000000, 0.18).fillRect(c.x + 5, c.y + 5, c.w, c.h);
    const body = this.add.graphics();
    body.fillStyle(0x3b2620).fillRect(0, 0, c.w, c.h);
    body.fillStyle(0xb4523a).fillRect(3, 3, c.w - 6, 40);
    body.fillStyle(0xd27756).fillRect(3, 3, c.w - 6, 3);
    body.fillStyle(0xe6d7b8).fillRect(3, 46, c.w - 6, c.h - 49); // under the sheets
    const rings = this.add.graphics();
    [28, c.w - 30].forEach((rx) => {
      rings.fillStyle(0xecc96a).fillRect(rx - 3, -8, 8, 16);
      rings.fillStyle(0x8f6a25).fillRect(rx - 3, 4, 8, 3);
    });
    const sw = c.w - 6; const sh = c.h - 49;
    const sheet = (i) => {
      const gg = this.add.graphics();
      gg.fillStyle(0xf8f0dd).fillRect(0, 0, sw, sh);
      gg.fillStyle(0xe6d7b8);
      for (let k = 1; k < 7; k++) gg.fillRect(k * 27, 0, 1, sh);
      for (let j = 1; j < 4; j++) gg.fillRect(0, j * 30, sw, 1);
      gg.fillStyle(0xd8c6a2).fillRect(0, sh - 2, sw, 2); // paper edge
      const parts = [gg];
      if (i === 0) {
        // one big pixel-art question mark (original glyph), with a soft shadow
        const rows = [' 111 ', '11 11', '   11', '  11 ', '  11 ', '     ', '  11 '];
        const q = this.add.graphics(); const cell = 9; const ox = sw / 2 - 2.5 * cell; const oy = sh / 2 - 3.5 * cell;
        [[3, 0x8c4430], [0, 0xb4523a]].forEach(([off, col]) => {
          q.fillStyle(col);
          rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '1') q.fillRect(ox + x * cell + off, oy + y * cell + off, cell, cell); }));
        });
        parts.push(q);
      } else {
        const big = i === 3;
        const t = makeText(this, sw / 2, sh / 2 + 2, big ? WEDDING.date : CAL_DATES[i - 1], {
          fontFamily: FONT_TITLE, fontSize: big ? '38px' : '34px', color: big ? '#3b2620' : '#8c6a55',
        }).setOrigin(0.5, 0.5);
        this.texts.push(t);
        parts.push(t);
      }
      const shade = this.add.graphics().fillStyle(0x3b2620, 1).fillRect(0, 0, sw, sh);
      shade.setAlpha(0);
      parts.push(shade);
      const ct = this.add.container(3, 46, parts);
      ct.shade = shade;
      return ct;
    };
    this.calSheets = [0, 1, 2, 3].map(sheet);
    // the shadow a lifting page casts on the sheet underneath
    this.calCast = this.add.graphics().fillStyle(0x3b2620, 1).fillRect(0, 0, sw, 10);
    this.calCast.setPosition(3, 46).setAlpha(0);
    this.calGlow = this.add.graphics().fillStyle(0xffffff, 1).fillRect(3, 46, sw, sh);
    this.calGlow.setAlpha(0);
    this.calDay = makeText(this, c.w / 2, 24, WEDDING.weekday, { fontFamily: FONT_BODY, fontSize: '26px', color: '#fff7e6' }).setOrigin(0.5, 0.5);
    this.texts.push(this.calDay);
    this.calBody = this.add.container(c.x, c.y, [body, ...this.calSheets.slice().reverse(), this.calCast, this.calGlow, rings, this.calDay])
      .setDepth(DEPTH.board);
    this.calSparks = [[-12, 18], [c.w + 10, 30], [c.w + 4, c.h - 20], [-8, c.h - 34]].map(([dx, dy]) =>
      this.add.image(c.x + dx, c.y + dy, 'sparkle').setScale(ART).setDepth(DEPTH.fx).setVisible(false));
    this.calReplay = null;
    // initial (mystery) state, also on the title screen before anything is drawn
    this.calSheets.forEach((sh, i) => sh.setVisible(i === 0));
    this.calDay.setAlpha(0);
  }

  /**
   * The calendar as a pure function of progress (skipping or going back always
   * shows the right state; once past the reveal the date simply stays up).
   * A tap on the revealed calendar replays just its bounce + flips.
   */
  drawCalendar(b) {
    let fb = b;
    const R = this.calReplay;
    if (R) {
      const k = (this.time.now - R.t0) / 1900;
      if (k >= 1 || this.play) this.calReplay = null;
      else fb = this.bCalHit + k * (this.bCalDone - this.bCalHit);
    }
    const hit = this.bCalHit; const f0 = this.bFlip0;
    this.calBody.y = CAL.y - Math.round(Math.sin(Math.PI * ramp(fb, hit, hit + 3)) * 5);
    // which page is lifting, and how far (0..1)
    const flips = [[f0, f0 + 4], [f0 + 4, f0 + 9], [f0 + 9, this.bCalDone]];
    let top = 0; let lift = 0;
    flips.forEach(([a, z], i) => { if (fb >= z) top = i + 1; else if (fb > a && top === i) lift = ramp(fb, a, z); });
    if (fb >= this.bCalDone) { top = 3; lift = 0; }
    this.calSheets.forEach((sh, i) => {
      const show = i === top || (lift > 0 && i === top + 1);
      sh.setVisible(show);
      if (!show) return;
      if (i === top && lift > 0) {
        const e = lift * lift * (3 - 2 * lift); // eased fold
        sh.setScale(1, Math.max(0.001, 1 - e)); // folds up over the top binding…
        sh.shade.setAlpha(0.35 * e); // …and darkens as it turns away
      } else { sh.setScale(1, 1); sh.shade.setAlpha(0); }
    });
    this.calCast.setAlpha(lift > 0 ? 0.28 * (1 - lift) : 0);
    this.calCast.setScale(1, 1 + 3 * (1 - lift));
    // the header shows THỨ NĂM as the last page settles
    this.calDay.setAlpha(ramp(fb, f0 + 12, this.bCalDone));
    // before activation: a very gentle pulse says "something is in here"
    const idle = fb < hit && !this.reducedMotion;
    this.calGlow.setAlpha(idle ? 0.05 + 0.05 * Math.sin(this.time.now / 420) : 0);
    const spark = fb >= this.bCalDone - 1 && fb < this.bCalDone + 7;
    this.calSparks.forEach((sp, i) => sp.setVisible(spark && Math.floor(this.time.now / 140 + i) % 2 === 0));
  }

  /** Tap on the revealed calendar (page 2, at rest): replay its reveal, quietly. */
  replayCalendar() {
    if (this.calReplay || this.navState() !== 'idle' || this.b < this.bCalDone) return false;
    this.calReplay = { t0: this.time.now };
    this.sfx('bump');
    this.time.delayedCall(80, () => this.sfx('unfold'));
    this.time.delayedCall(1800, () => this.sfx('chime'));
    return true;
  }

  // ================================================================ hearts (11 groups × 9 = 99)
  buildHearts() {
    const P = this.path;
    const at = (id, x, lift = 40) => ({ d: P.dAtX(id, x), lift }); // chest height: touched, never over a face
    const gd = P.segments.find((g) => g.id === 'gd');
    // nine hearts on the natural route, all collected before the RSVP;
    // never over the calendar date, the info card or the characters' faces
    const spots = [
      at('p0', 214), at('p0', 238), at('p0', 262), // screen 1 → 2: the opening run
      at('p1', 228), at('p1', 172), // screen 2 → 3: under the wedding calendar (below its date)
      { d: gd.start + gd.len * 0.55, lift: 30 }, // …mid-glide, in the open sky
      at('gl', 146), at('gl', 166), at('gl', 186), // …arriving at Seasons (Thủy stops at 188)
    ];
    if (spots.length !== HEART_COUNT) throw new Error(`heart layout: ${spots.length}`);
    this.hearts = spots.map(({ d, lift }) => {
      const p = P.at(d);
      const sp = this.add.image(Math.round(p.x), Math.round(p.y - lift), 'heart').setScale(ART * 1.7).setDepth(DEPTH.coins);
      return { d, s: sp, baseY: sp.y, got: false };
    });
    this.resetHearts();
  }

  resetHearts() {
    this.maxLead = -Infinity; // high-water mark: hearts never come back or count twice
    this.heartCount = 0;
    this.hearts.forEach((h) => { h.got = false; h.s.setVisible(true); });
    this.flourished = false;
    this.hud?.txt.setText('×00').setColor('#fff7e6');
  }

  // ================================================================ secret photo coins
  buildPhotoCoins() {
    const defs = [
      { id: 1, x: 20, y: Y0 - 14, depth: DEPTH.front - 1 }, // behind the bush on the opening platform
      { id: 2, x: 247, y: 646, depth: DEPTH.board - 1 }, // peeking out from behind the wedding calendar
      { id: 3, x: 22, y: YV - 84, depth: DEPTH.coins }, // a gem in the earth wall by the pipe exit
    ];
    this.photoCoins = defs.map((c) => {
      const s = this.add.image(c.x, c.y, 'photoCoin').setScale(ART).setDepth(c.depth);
      const sp = this.add.image(c.x + 10, c.y - 10, 'sparkle').setScale(ART * 0.6).setDepth(c.depth + 1);
      const found = this.photos.has(c.id);
      s.setVisible(!found);
      sp.setVisible(false);
      return { ...c, s, sp, found, busy: false };
    });
  }

  setupTaps() {
    const el = this.scroller.el;
    const toWorld = (e) => {
      const r = el.getBoundingClientRect();
      const k = this.layout.cssToLogical;
      return { x: (e.clientX - r.left) * k, y: this.cameras.main.scrollY + (e.clientY - r.top) * k };
    };
    const hit = (p) => this.photoCoins.find((c) => !c.found && !c.busy && Math.hypot(c.x - p.x, c.y - p.y) < 30);
    const onHud = (e) => {
      const r = el.getBoundingClientRect();
      const k = this.layout.cssToLogical;
      const x = (e.clientX - r.left) * k; const y = (e.clientY - r.top) * k;
      const h = this.hudBox;
      return h && x >= h.x - 4 && x <= h.x + h.w + 4 && y >= h.y - 6 && y <= h.y + h.h + 6;
    };
    el.addEventListener('click', (e) => {
      if (!this.introDone || this.photos.isOpen || this.play) return;
      if (onHud(e)) { soundManager.sfx('select'); this.photos.openGallery(false); return; }
      const w = toWorld(e);
      const c = hit(w);
      if (c) { this.collectPhotoCoin(c); return; }
      if (w.x >= CAL.x && w.x <= CAL.x + CAL.w && w.y >= CAL.y && w.y <= CAL.y + CAL.h) this.replayCalendar();
    });
    el.addEventListener('mousemove', (e) => {
      el.style.cursor = this.introDone && (hit(toWorld(e)) || onHud(e)) ? 'pointer' : '';
    });
  }

  collectPhotoCoin(c) {
    c.busy = true;
    soundManager.unlock();
    soundManager.sfx('photoCoin');
    const done = () => {
      c.found = true;
      c.busy = false;
      c.s.setVisible(false);
      c.sp.setVisible(false);
      this.burst(c.x, c.y, 'sparkle', 6);
      this.photos.discover(c.id);
    };
    if (this.reducedMotion) { done(); return; }
    c.s.setDepth(DEPTH.fx + 5);
    const tw = c.id === 2
      ? { targets: c.s, y: c.y - 26, duration: 220, yoyo: true, ease: 'Quad.easeOut' }
      : { targets: c.s, scaleX: { from: ART, to: -ART }, duration: 120, repeat: 3, yoyo: true };
    this.tweens.add({ ...tw, onComplete: done });
  }

  setPhotoHud(n) {
    if (!this.hud) return;
    this.hud.photo.setText(`${n}/3`);
    this.layoutHud();
  }

  // ================================================================ characters + HUD
  buildCharacters() {
    const opts = { scale: ART, shadow: false, sortByY: false };
    this.minh = new MinhCharacter(this, { ...opts, x: 150, y: Y0, depthBase: DEPTH.chars, facing: 'down' });
    this.thuy = new ThuyCharacter(this, { ...opts, x: 184, y: Y0, depthBase: DEPTH.chars + 1, facing: 'right' });
    this.thuy.setVariant('-bq'); // her approved bouquet frames (she fixes it on the title screen)
    [this.minh, this.thuy].forEach((c) => {
      c.st = { key: '', dir: 'right', d: 0, still: 0, seg: null, emote: null };
      c.emote = this.add.image(0, 0, 'emoteDots').setOrigin(0.5, 1).setScale(ART).setDepth(DEPTH.fx + 2).setVisible(false);
      c.prop = this.add.image(0, 0, 'notebook').setScale(ART).setDepth(DEPTH.prop).setVisible(false);
    });
  }

  buildHud() {
    const fix = (o) => o.setScrollFactor(0).setDepth(DEPTH.hud);
    const bg = fix(this.add.graphics());
    const heart = fix(this.add.image(0, 0, 'heart').setOrigin(0, 0.5).setScale(ART * 1.1));
    const style = { fontFamily: FONT_BODY, fontSize: '23px', color: '#fff7e6' };
    const txt = fix(makeText(this, 0, 0, '×00', style).setOrigin(0, 0.5));
    const coin = fix(this.add.image(0, 0, 'photoCoin').setOrigin(0, 0.5).setScale(ART * 0.95));
    const photo = fix(makeText(this, 0, 0, '0/3', style).setOrigin(0, 0.5));
    this.texts.push(txt, photo);
    this.hud = { bg, heart, txt, coin, photo };
    this.setHudVisible(false); // shown once the game starts
    // scroll hint: in the open sky between the first platform and the calendar,
    // so it never covers the date
    this.hint = makeText(this, WORLD_W / 2, Y0 + 72, T.scrollHint, {
      fontFamily: FONT_BODY, fontSize: '22px', color: '#fff7e6', backgroundColor: '#3b2620d9',
      padding: { left: 10, right: 10, top: 4, bottom: 2 },
    }).setOrigin(0.5, 0.5).setDepth(DEPTH.hud - 1).setVisible(false);
    this.texts.push(this.hint);
    this.layoutHud();
  }

  layoutHud() {
    const l = this.layout;
    const y = l.safe.top + 10 + HUD_H / 2;
    const h = this.hud;
    let x = 18;
    h.heart.setPosition(x, y); x += 22;
    h.txt.setPosition(x, y + 1); x += h.txt.width + 10;
    h.coin.setPosition(x, y); x += 26;
    h.photo.setPosition(x, y + 1); x += h.photo.width + 10;
    h.bg.clear();
    h.bg.fillStyle(0x2b1d1a, 0.62).fillRoundedRect(8, y - HUD_H / 2, x - 8, HUD_H, 8);
    this.hudBox = { x: 8, y: y - HUD_H / 2, w: x - 8, h: HUD_H }; // also a tap target → photo gallery
  }

  // ================================================================ start (scroll right away)
  /** BẮT ĐẦU pressed (a user gesture, so sound may start now). */
  start() {
    soundManager.unlock();
    soundManager.sfx('start');
    const music = AUDIO_KEYS.music[MAIN_MUSIC];
    soundManager.playMusic(music.key, { volume: music.volume ?? 0.4, fadeIn: 1200 });
    showMusicToggle();
  }

  /** The intro has landed them on the first platform: the scroll-driven game takes over. */
  beginPlay() {
    if (this.infoBtn) this.infoBtn.hidden = false;
    this.setHudVisible(true);
    this.b = 0;
    this.prevB = 0;
    this.screen = 0;
    this.play = null;
    this.introDone = true;
    this.nav.enable(true);
    this.render(0, 16, false);
    this.syncNav();
    this.scroller.el.focus({ preventScroll: true });
  }

  /** Camera top the game uses at progress 0 (where the intro must end). */
  cameraTopAt0() {
    const cam = this.cameras.main;
    const keep = cam.scrollY;
    this.render(0, 16, true);
    const v = cam.scrollY;
    cam.scrollY = keep;
    return v;
  }

  setHudVisible(on) {
    if (!this.hud) return;
    ['bg', 'heart', 'txt', 'coin', 'photo'].forEach((k) => this.hud[k].setVisible(on));
  }

  // ================================================================ screens (one swipe = one screen)
  /** Stable progress value of each screen (where its entrance animation ends). */
  stopB(i) {
    return [0, this.bDate, this.bF1, this.answer ? this.bEnd : this.bR][i];
  }

  /**
   * Start a transition from b `from` to `to`, played at the beat-by-beat
   * timing set in buildTimeline (this.timing). Its length is the sum of the
   * stretches it covers, so each animation keeps its own rhythm.
   */
  startPlay(from, to, screen) {
    if (to <= from) { this.settleAt(to); return; }
    const bs = [from]; const ts = [0];
    for (const [b0, b1, ms] of this.timing) {
      if (b1 <= from || b0 >= to) continue;
      const lo = Math.max(b0, from); const hi = Math.min(b1, to);
      bs.push(hi); ts.push(ts[ts.length - 1] + ms * ((hi - lo) / (b1 - b0)));
    }
    if (bs[bs.length - 1] < to) { bs.push(to); ts.push(ts[ts.length - 1] + (to - bs[bs.length - 2]) * 20); }
    const total = ts[ts.length - 1];
    const ms = this.reducedMotion ? Math.min(total, 350) : total;
    this.play = { from, to, ms, t0: this.time.now, bs, ts, total, screen, k: 0 };
    this.buildCamPath();
    this.syncNav();
  }

  /** b for elapsed fraction k of the current transition (linear inside each stretch). */
  playB(k) {
    const { bs, ts, total } = this.play;
    const t = Math.max(0, Math.min(1, k)) * total;
    let i = 1;
    while (i < ts.length - 1 && ts[i] < t) i++;
    const f = (t - ts[i - 1]) / ((ts[i] - ts[i - 1]) || 1);
    return bs[i - 1] + (bs[i] - bs[i - 1]) * Math.min(1, f);
  }

  /**
   * The camera path of the running transition, worked out once up front so it
   * glides in ONE direction: the follow-camera alone (two characters, one of
   * them in the pipe) hesitates and snaps back and forth. Envelope from both
   * ends (monotone, stays close to the raw path) + a moving average (keeps it
   * monotone, rounds off starts and stops; the end points stay exact).
   */
  buildCamPath() {
    const p = this.play;
    if (!p) return;
    const N = Math.max(8, Math.round(p.ms / 16));
    const raw = [];
    for (let i = 0; i <= N; i++) raw.push(this.cameraTop(this.playB(i / N)));
    const dir = Math.sign(raw[N] - raw[0]) || 1;
    const lim = (v) => (dir > 0 ? Math.min(Math.max(v, raw[0]), raw[N]) : Math.max(Math.min(v, raw[0]), raw[N]));
    const fwd = []; const bwd = [];
    for (let i = 0; i <= N; i++) fwd[i] = lim(i ? (dir > 0 ? Math.max(fwd[i - 1], raw[i]) : Math.min(fwd[i - 1], raw[i])) : raw[0]);
    for (let i = N; i >= 0; i--) bwd[i] = lim(i < N ? (dir > 0 ? Math.min(bwd[i + 1], raw[i]) : Math.max(bwd[i + 1], raw[i])) : raw[N]);
    const mono = fwd.map((v, i) => (v + bwd[i]) / 2);
    // Moving average that looks back ~250 ms but only ~50 ms ahead: the camera
    // eases after the action instead of anticipating it (it stays on the pipe's
    // rim until Minh has fully disappeared, then follows him down).
    const R = Math.max(1, Math.round(250 / 16));
    const lead = 3;
    const cam = mono.map((_, i) => {
      const rb = Math.min(R, i); const rf = Math.min(lead, i, N - i);
      let sum = 0;
      for (let j = i - rb; j <= i + rf; j++) sum += mono[j];
      return sum / (rb + rf + 1);
    });
    // the lag leaves the last samples short of the end: ease the remainder in
    // over the final ~250 ms (still one-way, ends exactly on the page's framing)
    const miss = mono[N] - cam[N];
    for (let i = Math.max(0, N - R); i <= N; i++) {
      const u = R ? (i - (N - R)) / R : 1;
      cam[i] += miss * u * u * (3 - 2 * u);
    }
    p.cam = cam;
  }

  /** Camera top of the running transition at its current fraction. */
  playCam() {
    const { cam, k } = this.play;
    const x = k * (cam.length - 1); const i = Math.min(cam.length - 2, Math.floor(x));
    return cam[i] + (cam[i + 1] - cam[i]) * (x - i);
  }

  /** Jump straight to a progress value (skip / back): no sound burst. */
  settleAt(b) {
    this.play = null;
    this.quietJump = true;
    this.b = b;
    this.render(b, 16, false);
    this.quietJump = false;
    this.prevB = b;
    this.syncNav();
  }

  /**
   * THE navigation state — single source of truth for every input (swipe,
   * wheel, keys, dots, ▲/▼):
   *   'intro'          title screen / START animation: no page navigation
   *   'keyboard-open'  a text field has focus (RSVP name): nothing moves
   *   'modal-open'     photo viewer / gallery / quick info view is open
   *   'transitioning'  a page animation is running (a 2nd swipe skips to its end)
   *   'idle'           resting on one of the four screens
   */
  navState() {
    if (!this.introDone) return 'intro';
    if (editingText()) return 'keyboard-open';
    if (this.photos.isOpen || this.quick?.isOpen) return 'modal-open';
    return this.play || this.fading ? 'transitioning' : 'idle';
  }

  /** Inputs act only when idle, or to skip a running animation (never during a fade: no queue). */
  canNavigate() {
    const st = this.navState();
    return st === 'idle' || (st === 'transitioning' && !this.fading);
  }

  goNext() {
    if (!this.canNavigate()) return;
    if (this.play) { // a second swipe skips to the end of THIS page…
      this.settleAt(this.play.to);
      this.skipGuard = this.time.now + 500; // …and the rest of that flurry is ignored
      return;
    }
    if (this.time.now < (this.skipGuard || 0)) return;
    if (this.screen >= 3) return;
    this.screen += 1;
    soundManager.unlock();
    this.startPlay(this.b, this.stopB(this.screen), this.screen);
  }

  goPrev() {
    if (!this.canNavigate()) return;
    if (this.play) { // swiping back mid-transition returns to the screen we came from
      const back = Math.max(0, this.play.screen - 1);
      this.screen = back;
      this.settleAt(this.stopB(back));
      return;
    }
    if (this.screen <= 0) return;
    this.screen -= 1;
    this.fadeJump(this.stopB(this.screen));
  }

  /** Dots: back = instant; forward = the usual animated step(s), or instant if several. */
  goTo(i) {
    if (!this.canNavigate() || i === this.screen) return;
    if (i === this.screen + 1 && !this.play) { this.goNext(); return; }
    this.screen = i;
    this.fadeJump(this.stopB(i));
  }

  /** Backward / multi-step moves: a quick fade instead of rewinding animations. */
  fadeJump(b) {
    const cam = this.cameras.main;
    if (this.reducedMotion) { this.settleAt(b); return; }
    // one calm ~500 ms page change (fade out, swap, fade in): nothing slides or bounces
    this.fading = true;
    this.syncNav();
    cam.fadeOut(220, 255, 250, 240);
    cam.once('camerafadeoutcomplete', () => {
      this.settleAt(b);
      cam.fadeIn(280, 255, 250, 240);
      cam.once('camerafadeincomplete', () => { this.fading = false; this.syncNav(); });
    });
  }

  syncNav() {
    // under the RSVP box / end buttons (screen 4) the corner belongs to them
    const show = this.introDone && this.screen < 3;
    this.nav.setState(this.screen, { show, busy: !!this.play || !!this.fading });
  }

  /** Called only after the backend confirmed. From the quick view (quiet) the game keeps its place. */
  onRsvpConfirmed(record, { quiet = false } = {}) {
    this.answer = record;
    soundManager.sfx('confirm');
    if (quiet || !this.introDone || this.screen !== 3) return;
    // stay on screen 4 and play the ending (celebration, flag, wave, turtle)
    this.time.delayedCall(350, () => { if (!this.play) this.startPlay(this.b, this.bEnd, 3); });
  }

  setupEndActions() {
    this.endActions = document.getElementById('end-actions');
    this.endMsg = this.endActions.querySelector('.end-msg');
    document.getElementById('btn-review')?.addEventListener('click', () => {
      soundManager.sfx('select');
      this.screen = 0;
      this.fadeJump(0); // back to the first screen; swipe again to re-read
    });
    document.getElementById('btn-replay')?.addEventListener('click', () => {
      soundManager.sfx('select');
      this.resetHearts();
      this.screen = 0;
      this.settleAt(0);
    });
    document.getElementById('btn-gallery')?.addEventListener('click', () => {
      soundManager.sfx('select');
      this.photos.openGallery(true);
    });
    document.getElementById('btn-change')?.addEventListener('click', () => {
      soundManager.sfx('select');
      this.answer = null;
      this.screen = 3;
      this.settleAt(this.bR);
    });
  }

  /**
   * Final-screen composition, worked out per screen size (in CSS px):
   *   compact HUD on top · the readable info card in the upper band · couple, flag
   *   and turtle on the floor in the centre · RSVP box / end buttons in the lower
   *   band, never over the couple · only a thin slab of floor under them.
   */
  layoutFinal() {
    const l = this.layout;
    const k = l.cssToLogical;
    const dlg = this.dialog.measure();
    const card = this.measureCard();
    // top bar: the HUD pill (canvas) and the THIỆP / music buttons (DOM, 10 + 44 px)
    const hudBottom = Math.max((l.safe.top + 10 + HUD_H) / k, l.safeCss.top + 54);
    const charH = 100 / k;
    const floor = Math.min(0.72 * l.cssH, l.cssH - l.safeCss.bottom - dlg - 18);
    const slack = Math.max(0, floor - charH - hudBottom - card - 20);
    const cardTop = hudBottom + 14 + slack * 0.35; // 14: room for the card's tag under the top bar
    this.finalTop = YV - floor * k;
    this.cardWorldY = this.finalTop + cardTop * k;
    this.cardH = card;
  }

  measureCard() {
    const el = this.venueCard;
    const was = el.hidden;
    el.hidden = false;
    el.style.visibility = 'hidden';
    const h = el.offsetHeight || 220;
    el.style.visibility = '';
    el.hidden = was;
    return h;
  }

  /** The info card rides with the world (so it scrolls naturally into view at the venue). */
  placeVenueCard(b) {
    const el = this.venueCard;
    const k = this.layout.cssToLogical;
    const yCss = (this.cardWorldY - this.cameras.main.scrollY) / k;
    const fade = ramp(b, this.bSign1, this.bF1); // the box's little card becomes the info card
    const show = fade > 0 && yCss > -this.cardH && yCss < this.layout.cssH;
    if (el.hidden === show) el.hidden = !show;
    if (!show) { this._cardShown = false; return; }
    // the time line glows once when the card first appears out of the box
    if (!this._cardShown && fade < 1 && !this.quietJump) {
      const t = el.querySelector('.ic-time');
      t?.classList.remove('is-fresh'); void t?.offsetWidth; t?.classList.add('is-fresh');
    }
    this._cardShown = true;
    el.style.opacity = String(fade);
    el.style.transform = `translate(-50%, ${Math.round(yCss)}px)`;
    // after a confirmed RSVP the tag on the card carries the answer
    const tag = WEDDING.eventName;
    if (this.cardTag.textContent !== tag) {
      this.cardTag.textContent = tag;
      this.cardTag.classList.toggle('is-answer', !!this.answer);
    }
  }

  // ================================================================ per frame
  onResize(l) {
    this.layout = l;
    fitCamera(this.cameras.main, l);
    refreshTextResolution(this.texts);
    this.layoutHud();
    // address bar / toolbar only changed the height: every page stays framed
    // exactly where it is (no camera jump); real size changes re-compose
    if (!l.heightOnly) this.layoutFinal();
    if (this.play) this.buildCamPath();
    if (this.intro?.state === 'title') { this.intro.layout(); this.cameras.main.scrollY = this.intro.cam; }
  }

  update(time, delta) {
    if (this.introDone) {
      if (this.play) {
        const k = Math.min(1, (time - this.play.t0) / this.play.ms);
        this.play.k = k;
        this.b = this.playB(k);
        if (k >= 1) { this.b = this.play.to; this.play = null; this.syncNav(); }
      }
      // between transitions b stays put: the scene settles, only idle loops move
      this.render(this.b, delta, false);
    } else this.intro?.update(time);
    this.ambient(time);
  }

  /** Follow-camera at progress b: frame both; when far apart (one in the pipe) follow the one behind. */
  cameraTop(b) {
    const P = this.path;
    const dM = Math.max(0, this.M.eval(b).d);
    const dT = this.H.eval(b).d;
    const fT = P.focus(dT); const fM = P.focus(dM);
    const V = this.layout.height;
    let rear = dM <= dT ? fM : fT;
    let w = ramp(Math.abs(fT.y - fM.y), 0.3 * V, 0.55 * V);
    // someone already out of sight inside the pipe doesn't pull the camera:
    // it stays on the one still outside (Minh inspecting the rim, Thủy at the exit)
    const hidden = (d) => { const q = P.at(d); return (q.type === 'pipe' && d - q.seg.start > 12) || (q.seg.hideBefore != null && q.x < q.seg.hideBefore); };
    const hT = hidden(dT); const hM = hidden(dM);
    if (hT !== hM) { rear = hT ? fM : fT; w = 1; }
    const fy = Phaser.Math.Linear((fT.y + fM.y) / 2, rear.y, w);
    const fa = Phaser.Math.Linear((fT.anchor + fM.anchor) / 2, rear.anchor, w);
    let top = fy - fa * V;
    // Gentle Glide: frame both characters (and the calendar between them) while
    // they float down; eased in and out so the camera simply drifts downward.
    const wG = smooth(ramp(b, this.bGlideT - 18, this.bGlideT + 2)) * (1 - smooth(ramp(b, this.bLandM + 8, this.bLandM + 34)));
    if (wG > 0) {
      const pT = P.at(dT); const pM = P.at(dM);
      const hi = Math.min(pT.y, pM.y) - 110; const lo = Math.max(pT.y, pM.y) + 40;
      top = Phaser.Math.Linear(top, (hi + lo) / 2 - V / 2, wG);
    }
    // final screen: ease into the composition worked out in layoutFinal()
    const wF = smooth(ramp(b, this.bF1, this.bR - 4));
    if (wF > 0) top = Phaser.Math.Linear(top, this.finalTop, wF);
    return Math.max(-600, Math.min(WORLD_BOTTOM - V, top));
  }

  render(b, delta, initial) {
    const eM = this.M.eval(b);
    const eT = this.H.eval(b);
    const dM = Math.max(0, eM.d);
    const dT = eT.d;
    // camera: during a page transition it rides the precomputed one-way path
    const top = !initial && this.play?.cam ? this.playCam() : this.cameraTop(b);
    const z = this.cameras.main.zoom;
    this.cameras.main.scrollY = Math.round(top * z) / z;
    if (initial) { this.minh.st.d = dM; this.thuy.st.d = dT; return; }

    const forward = b > this.prevB + 0.001;
    const gate = !this.answer && b > this.bR - 2;
    this.driveChar(this.minh, dM, eM, delta, gate);
    this.driveChar(this.thuy, dT, eT, delta, gate);

    // ---------------- environment linked to progress
    this.drawSurpriseBox(b);
    this.drawCalendar(b);
    const rumble = !this.reducedMotion && b > this.bRumble && b < this.bPull + 2;
    this.pipeRimTop.x = PIPE_X + (rumble ? Math.round(Math.sin(this.time.now / 28)) : 0);
    const fr = ramp(b, this.bFix0 + 2, this.bFix1 - 2);
    this.tallFlower.setRotation((1 - fr) * 0.5);
    this.flowerSparkle.setVisible(b > this.bFix1 && b < this.bFlowerDone + 4 && Math.floor(this.time.now / 160) % 2 === 0);
    const fl = ramp(b, this.bFlag0 + 2, this.bFlag1 - 2);
    this.flag.setRotation((1 - fl) * -0.45); // droops until Thủy straightens it
    // finish turtle: waddles out of the pipe mouth after everyone has celebrated
    const tb = ramp(b, this.bTurtle0, this.bTurtle1);
    this.turtle.x = Phaser.Math.Linear(TURTLE_FROM, TURTLE_STOP, tb);
    this.turtle.setVisible(tb > 0);
    if (tb > 0 && tb < 1) this.turtle.setTexture(Math.floor(b / 5) % 2 ? 'turtle1' : 'turtle0');
    // opening turtle: plods along behind the couple at its own pace
    const to = ramp(b, 0, 260);
    this.turtleOpen.x = Phaser.Math.Linear(96, 168, to);
    if (to > 0 && to < 1) this.turtleOpen.setTexture(Math.floor(b / 7) % 2 ? 'turtle1' : 'turtle0');
    const endFor = this.answer ? (this.answer.attending === false ? 'no' : 'yes') : '';
    if (this._endFor !== endFor) {
      this._endFor = endFor;
      this.endMsg.hidden = !endFor;
      const [l1, l2] = endFor === 'no' ? [T.doneNoTitle, T.doneNoLine] : [T.doneYesTitle, T.doneYesLine(WEDDING.time, WEDDING.date)];
      this.endMsg.replaceChildren(Object.assign(document.createElement('strong'), { textContent: l1 }), document.createElement('br'), l2);
    }

    this.collectHearts(Math.max(dT, dM), forward);
    this.drawGlideFx(b, eT, eM);
    this.fadeTitle();

    if (forward && !this.quietJump) {
      this.cues.forEach(([cb, name]) => {
        if (this.prevB < cb && b >= cb) {
          if (name.startsWith('fx:')) this.fxCue(name.slice(3));
          else if (name === 'victory' && this.answer?.attending === false) this.sfx('gentle');
          else this.sfx(name);
        }
      });
    }
    this.prevB = b;

    if (b >= this.bR - 6 && !this.answer) this.dialog.show();
    else if (b < this.bR - 30 || this.answer) this.dialog.hide();
    this.endActions.hidden = !(this.answer && b > this.bEnd - 20);
    this.hint.setVisible(this.introDone && this.screen === 0 && !this.play && b < 1 && (this.reducedMotion || (this.time.now % 1600) < 1100));
    this.placeVenueCard(b);
  }

  /**
   * High-water mark on the leading character's path distance: a heart is
   * collected once, scrolling back never re-awards it, a fast scroll collects
   * everything it passed. Each heart is worth 11 (max 99).
   */
  collectHearts(lead, forward) {
    if (lead <= this.maxLead) return;
    this.maxLead = lead;
    const fresh = this.hearts.filter((h) => !h.got && h.d <= lead);
    if (!fresh.length) return;
    fresh.forEach((h) => {
      h.got = true;
      h.s.setVisible(false);
      this.burst(h.s.x, h.s.y, 'heartBit', 4);
      this.plusEleven(h.s.x, h.s.y - 10);
    });
    this.heartCount = Math.min(99, this.hearts.filter((h) => h.got).length * HEART_VALUE);
    if (forward && !this.quietJump) this.sfx('heart');
    this.hud.txt.setText(`×${String(this.heartCount).padStart(2, '0')}`);
    this.layoutHud();
    if (!this.reducedMotion) {
      this.tweens.killTweensOf(this.hud.txt);
      this.hud.txt.setScale(1.25);
      this.tweens.add({ targets: this.hud.txt, scale: 1, duration: 200, ease: 'Back.easeOut' });
    }
    if (this.heartCount === 99 && !this.flourished) {
      this.flourished = true;
      soundManager.sfx('flourish');
      this.hud.txt.setColor('#ecc96a');
      this.burst(40, this.hud.txt.y, 'sparkle', 6, true);
      if (!this.reducedMotion) {
        this.tweens.add({ targets: [this.hud.heart], scale: ART * 1.6, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
      }
    } else if (this.heartCount < 99) this.hud.txt.setColor('#fff7e6');
  }

  /**
   * Gentle Glide details: Thủy's veil streams upward in the breeze, Minh's jacket
   * tails flutter, a small cloud drifts under Minh. Drawn from the same progress
   * value (plus a soft breeze in time), so stopping mid-air keeps a valid pose.
   */
  drawGlideFx(b, eT, eM) {
    const g = this.glideFx;
    g.clear();
    const t = this.reducedMotion ? 0 : this.time.now / 1000;
    if (eT.st?.glide && this.thuy.st.seg?.type === 'glide') {
      const { x, y } = this.thuy;
      for (let i = 0; i < 6; i++) {
        const k = i / 5;
        const wx = x - 3 - 7 * k + Math.sin(t * 6 + i * 0.9) * (1 + 3 * k);
        const wy = y - 80 - i * 6;
        g.fillStyle(0xdfe7ee, 0.9 - 0.1 * i).fillRect(Math.round(wx) - 1, Math.round(wy), 9 - i, 6);
        g.fillStyle(0xffffff, 0.9 - 0.1 * i).fillRect(Math.round(wx), Math.round(wy), 7 - i, 5);
      }
    }
    if (eM.st?.glide && this.minh.st.seg?.type === 'glide') {
      const { x, y } = this.minh;
      [-1, 1].forEach((sx) => {
        for (let i = 0; i < 3; i++) {
          const fy = y - 34 - i * 3 - Math.abs(Math.sin(t * 9 + i + sx)) * 3;
          g.fillStyle(0x24232f).fillRect(Math.round(x + sx * (12 + i * 2)) - 1, Math.round(fy), 3, 4);
        }
      });
    }
    // the small cloud Minh drifts past (right → left, underneath him)
    const mc = ramp(b, this.bGlideM + 6, this.bLandM - 2);
    this.minhCloud.setVisible(mc > 0 && mc < 1);
    if (mc > 0 && mc < 1) {
      this.minhCloud.x = Phaser.Math.Linear(372, 254, mc);
      this.minhCloud.setAlpha(Math.min(1, 6 * mc, 6 * (1 - mc)));
    }
    // the sky clouds drift slowly with progress (pure function of b)
    this.glideClouds.forEach((c, i) => { c.x = c.baseX - ((b * (0.12 + 0.05 * i)) % 140); });
  }

  /** The big title and greeting fade before they could slide under the HUD. */
  fadeTitle() {
    const cam = this.cameras.main.scrollY;
    const hudBottom = this.layout.safe.top + 10 + HUD_H + 6;
    const a = (top) => Phaser.Math.Clamp((top - cam - hudBottom) / 36, 0, 1);
    const tA = a(196 - 40);
    this.titleGroup.forEach((o) => o.setAlpha(tA));
    const gA = a(284 - 6);
    this.greetGroup.forEach((o) => o.setAlpha(gA));
  }

  plusEleven(x, y) {
    const t = makeText(this, x, y, `+${HEART_VALUE}`, {
      fontFamily: FONT_BODY, fontSize: '22px', color: '#fff7e6', stroke: '#8c4430', strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(DEPTH.fx + 3);
    if (this.reducedMotion) { this.time.delayedCall(450, () => t.destroy()); return; }
    this.tweens.add({ targets: t, y: y - 22, alpha: { from: 1, to: 0 }, duration: 450, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  /** Squash right before takeoff / right after landing (pure function of d). */
  squash(p, d) {
    if (p.type !== 'run') return 0;
    const segs = this.path.segments;
    const i = segs.indexOf(p.seg);
    const prev = segs[i - 1]; const next = segs[i + 1];
    if (prev && prev.type === 'glide' && d - p.seg.start < 7) return 1 - (d - p.seg.start) / 7; // knees bend
    if (prev && prev.type === 'jump' && d - p.seg.start < 5) return 1 - (d - p.seg.start) / 5;
    if (next && next.type === 'jump' && p.seg.end - d < 4) return 0.7 * (1 - (p.seg.end - d) / 4);
    return 0;
  }

  driveChar(c, d, e, delta, gate) {
    const st = c.st;
    const s = e.st || {};
    const p = this.path.at(d);
    const moved = d - st.d;
    st.d = d;
    // a declining guest gets a warm goodbye, not a victory celebration
    const calm = s.celebrate && this.answer?.attending === false;
    const hopY = s.hop && !calm ? 4 * s.hop * e.t * (1 - e.t) : 0;
    c.setPosition(Math.round(p.x * 2) / 2, Math.round((p.y - hopY) * 2) / 2);
    const moving = Math.abs(moved) > 0.02;
    if (moving) st.still = 0; else st.still += delta;

    // inside the side tube (before the mouth) the character is hidden in the pipe
    const hidden = p.seg.hideBefore != null && p.x < p.seg.hideBefore;
    c.sprite.setVisible(!hidden);

    if (st.seg && st.seg !== p.seg && moved > 0 && (st.seg.type === 'jump' || st.seg.type === 'glide') && p.type === 'run') {
      this.sfx('land');
      if (st.seg.type === 'glide') this.burst(c.x, c.y - 2, 'dust', 5); // tiny puff of dust
    }
    if (st.seg && st.seg !== p.seg && moved > 0 && p.type === 'jump') this.sfx('jump');
    st.seg = p.seg;

    // diving head-first into the pipe: the flipped sprite's anchor sits at the head
    c.sprite.setFlipY(!!s.dive);
    // gentle sway while gliding; a brief wobble after Minh's landing
    let rot = 0;
    if (s.glide && p.type === 'glide') rot = 0.06 * Math.sin(p.t * Math.PI * 4) * Math.sin(p.t * Math.PI);
    else if (s.wobble) rot = 0.16 * Math.sin(e.t * Math.PI * 3) * (1 - e.t);
    c.sprite.setRotation(this.reducedMotion ? 0 : rot);

    let mode; let dir; let pose = null;
    if (s.dive) { mode = 'pose'; pose = 'stand'; dir = 'down'; }
    else if (s.adjust) { mode = 'pose'; pose = ['nod', 'breath', 'stand', 'nod', 'breath', 'stand'][Math.floor(e.t * 6) % 6]; dir = 'down'; }
    else if (calm) { mode = 'pose'; pose = 'stand'; dir = 'down'; }
    else if (s.pose) { mode = 'pose'; [pose, dir] = s.pose; }
    else if (gate) { mode = 'idle'; dir = 'down'; }
    else if (p.type === 'pipe') { mode = 'pose'; pose = 'stand'; dir = 'down'; }
    else if (p.airborne) {
      dir = p.dir || st.dir;
      if (moved < -0.02) dir = OPPOSITE[dir] || dir;
      mode = 'pose'; pose = 'jump';
    } else if (moving) {
      dir = p.dir || st.dir;
      if (moved < 0) dir = OPPOSITE[dir] || dir;
      mode = 'walk';
    } else if (s.face || st.still > 110) { mode = 'idle'; dir = s.face || st.dir; }
    else { mode = st.key.split(':')[0] || 'idle'; dir = st.dir; }
    if (pose === 'jump') pose = JUMP_POSE[c.id];
    if (dir === 'left' || dir === 'right') st.dir = dir;

    const key = `${mode}:${dir}:${pose}`;
    if (key !== st.key) {
      st.key = key;
      if (mode === 'walk') c.walkInPlace(dir, 1.6);
      else if (mode === 'pose') c.pose(pose, dir);
      else c.idle(dir);
    }
    if (mode === 'walk') {
      const v = (Math.abs(moved) / Math.max(1, delta)) * 1000;
      c.sprite.anims.timeScale = Math.max(0.8, Math.min(3, v / 55));
    }

    const q = s.dive ? 0 : this.squash(p, d);
    c.sprite.setScale(ART * (1 + 0.08 * q), ART * (1 - 0.12 * q));

    if (s.prop && !hidden) {
      const facing = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
      c.prop.setTexture(s.prop).setVisible(true).setPosition(c.x + facing * 9, c.y - 30);
    } else c.prop.setVisible(false);

    const em = hidden ? null : s.emote || null;
    if (em !== st.emote) {
      st.emote = em;
      if (em) { c.emote.setTexture(em); this.popIn(c.emote); }
    }
    c.emote.setVisible(!!em).setPosition(c.x, c.y - 62);
  }

  popIn(img) {
    if (this.reducedMotion) return;
    img.setScale(ART * 0.4);
    this.tweens.add({ targets: img, scale: ART, duration: 180, ease: 'Back.easeOut' });
  }

  /**
   * The Surprise Box as a pure function of progress: bump → card pops out,
   * spins and sparkles → opens into a readable sign (11:00 · TIỆC CƯỚI) →
   * hands over to the venue info card. The block stays "used" afterwards.
   */
  drawSurpriseBox(b) {
    const h = this.bHit;
    const bump = ramp(b, h, h + 3);
    this.box.y = BOX_Y - Math.round(Math.sin(Math.PI * bump) * 5);
    const used = b >= h;
    if (this._boxUsed !== used) { this._boxUsed = used; this.box.setTexture(used ? 'mysteryUsed' : 'mysteryBlock'); }
    const rise = smooth(ramp(b, h + 0.5, h + 6));
    const open = smooth(ramp(b, h + 8, this.bSign));
    const out = ramp(b, this.bSign1, this.bF1);
    const card = this.boxCard;
    card.setVisible(rise > 0 && open < 1);
    if (card.visible) {
      card.y = BOX_Y - 12 - rise * 40;
      card.setRotation((this.reducedMotion ? 0 : Math.sin(rise * Math.PI * 2) * 0.35) * (1 - open));
      card.setAlpha(1 - open);
    }
    const spark = b > h + 5 && b < this.bSign + 2;
    this.boxSparks.forEach((sp, i) => sp.setVisible(spark && Math.floor(this.time.now / 140 + i) % 2 === 0));
    const sign = this.boxSign;
    sign.setVisible(open > 0 && out < 1);
    if (sign.visible) {
      sign.setScale(0.25 + 0.75 * open);
      sign.setAlpha(Math.min(1, open * 1.6) * (1 - out));
    }
  }

  /** One-shot visual cues on the timeline (played forward only, never when skipping). */
  fxCue(name) {
    if (name === 'dustMinh') this.burst(this.minh.x, this.minh.y - 2, 'dust', 6);
    if (name === 'dustThuy') this.burst(this.thuy.x, this.thuy.y - 2, 'dust', 4);
    if (name === 'tap') this.burst(PIPE_X + 16, PIPE_TOP + 4, 'sparkle', 3); // knock, knock
  }

  burst(x, y, key, n, hud = false) {
    if (this.reducedMotion) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      const s = this.add.image(x, y, key).setScale(ART).setDepth(hud ? DEPTH.hud + 1 : DEPTH.fx + 1);
      if (hud) s.setScrollFactor(0);
      this.tweens.add({
        targets: s, x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 10 - 8, alpha: 0, duration: 340, ease: 'Quad.easeOut',
        onComplete: () => s.destroy(),
      });
    }
  }

  sfx(name) {
    const now = this.time.now;
    if (!this.introDone || this.quietJump) return;
    const gap = name === 'heart' ? 60 : 150;
    if (now - (this.lastSfx[name] || 0) < gap) return;
    this.lastSfx[name] = now;
    soundManager.sfx(name);
  }

  ambient(time) {
    const t = time / 1000;
    this.photoCoins?.forEach((c, i) => {
      if (!c.s.visible || c.busy) return;
      if (!this.reducedMotion) c.s.scaleX = ART * Math.max(0.25, Math.abs(Math.cos(t * 1.6 + i)));
      c.sp.setVisible(((t + i * 0.5) % 1.8) < 0.25);
    });
    if (this.reducedMotion) return;
    this.titleGroup.forEach((o, i) => { o.y = (i ? 252 : 196) + Math.round(Math.sin(t * 1.6 + i * 0.6) * 3); });
    this.clouds.forEach((c) => {
      const x = c.baseX + c.speed * t;
      c.x = ((x + 60) % (WORLD_W + 120) + (WORLD_W + 120)) % (WORLD_W + 120) - 60;
    });
    // birds now and then cross the upper sky (just under the HUD), wherever the guest is
    const cy = this.cameras.main.scrollY;
    this.birds.forEach((bd, i) => {
      const period = 18 + i * 4;
      const k = ((t + i * 6) % period) / (period * 0.45); // flying for ~45 % of the time
      bd.setVisible(this.introDone && k < 1);
      bd.x = -30 + Math.min(1, k) * (WORLD_W + 60);
      bd.y = 0.8 * cy + this.layout.safe.top + 64 + i * 18 + Math.sin(t * 2 + i) * 4;
      bd.setTexture(Math.floor(t * 4 + i) % 2 ? 'bird1' : 'bird0');
    });
    // flowers sway; leaves drift down; far hills sink slowly (parallax)
    this.swayers.forEach((f, i) => f.setRotation(Math.sin(t * 1.7 + i * 1.3) * 0.07));
    this.leaves.forEach((lf) => {
      const k = ((t * 0.05 + lf.ph / 10) % 1);
      lf.y = lf.y0 + k * lf.range;
      lf.x = lf.x0 + Math.sin(t * 1.3 + lf.ph) * 12;
      lf.setRotation(Math.sin(t * 2 + lf.ph) * 0.6);
      lf.setAlpha(Math.min(1, 5 * k, 5 * (1 - k)));
    });
    const V = this.layout.height;
    this.farHills.forEach((h) => { h.y = h.baseY + Phaser.Math.Clamp((cy - (h.baseY - 0.62 * V)) * 0.12, 0, 24); });
    this.glideClouds?.forEach((c, i) => { c.x += Math.sin(t * 0.3 + i) * 0.02; });
    this.butterfly.x = 240 + Math.sin(t * 0.7) * 30;
    this.butterfly.y = YV - 80 + Math.sin(t * 1.9) * 8;
    this.butterfly.setTexture(Math.floor(t * 6) % 2 ? 'fly1' : 'fly0');
    const cam = this.cameras.main;
    this.hearts?.forEach((h, i) => {
      if (h.got || h.baseY < cam.scrollY - 40 || h.baseY > cam.scrollY + this.layout.height + 40) return;
      h.s.y = h.baseY + Math.round(Math.sin(t * 3 + i * 0.7) * 1.5);
    });
  }
}
