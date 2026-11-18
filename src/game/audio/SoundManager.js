import { AUDIO_KEYS } from './audioKeys.js';

const STORAGE_KEY = 'csk.muted';

function readMuted() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(v) {
  try {
    window.localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
  } catch {
    /* private mode etc. — preference just won't persist */
  }
}

/**
 * One place for all audio:
 *  - streamed music (Phaser sound, loaded lazily after the title appears)
 *  - short sound effects from the Kenney packs, with a synthesized fallback
 *    for browsers that cannot decode OGG (older iOS Safari)
 *  - a procedural night-forest ambience (wind + distant crickets) built with
 *    Web Audio, so it costs zero download bytes
 * Nothing makes a sound before the first user gesture.
 */
class SoundManager {
  constructor() {
    this.game = null;
    this.muted = readMuted();
    this.music = null;
    this.pendingMusic = null;
    // Separate mix levels (multipliers). Music sits under the effects;
    // effects keep their own per-sound levels from audioKeys.js.
    this.musicVolume = 1;
    this.sfxVolume = 1;
    this.loopRegions = {}; // key → { start, duration } without leading/trailing silence
    this.ambience = null;
    this.listeners = new Set();
    this._noiseBuffer = null;
  }

  attach(game) {
    this.game = game;
    game.sound.mute = this.muted;
    game.sound.pauseOnBlur = true;
    // Music loaded in the background may arrive after the player pressed start.
    game.cache.audio.events.on('add', (cache, key) => {
      if (this.pendingMusic && this.pendingMusic.key === key) {
        const p = this.pendingMusic;
        this.pendingMusic = null;
        this.playMusic(key, p.opts);
      }
    });
  }

  get ctx() {
    const s = this.game?.sound;
    return s && s.context ? s.context : null;
  }

  /** Destination node that respects the global mute. */
  get out() {
    const s = this.game?.sound;
    return s?.destination || this.ctx?.destination || null;
  }

  /** Call from any user gesture. Safe to call repeatedly. */
  unlock() {
    const ctx = this.ctx;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  onChange(fn) {
    this.listeners.add(fn);
    fn(this.muted);
    return () => this.listeners.delete(fn);
  }

  setMuted(m) {
    this.muted = m;
    writeMuted(m);
    if (this.game) this.game.sound.mute = m;
    this.listeners.forEach((fn) => fn(m));
  }

  toggleMute() {
    this.unlock();
    this.setMuted(!this.muted);
  }

  // ------------------------------------------------------------------ music
  /**
   * Fetch + decode a music file in the background, independent of any scene
   * (a scene's loader would be cancelled if the guest moves on quickly).
   */
  preloadMusic(scene, def) {
    this._loading = this._loading || new Set();
    if (scene.cache.audio.exists(def.key) || this._loading.has(def.key)) return;
    const ctx = this.ctx;
    if (!ctx) {
      // HTML5 Audio fallback: let Phaser's loader handle it.
      scene.load.audio(def.key, [def.url]);
      scene.load.start();
      return;
    }
    this._loading.add(def.key);
    fetch(def.url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      // Callback form of decodeAudioData for older Safari.
      .then((buf) => new Promise((res, rej) => ctx.decodeAudioData(buf, res, rej)))
      .then((audioBuffer) => {
        this.loopRegions[def.key] = SoundManager.audibleRegion(audioBuffer);
        this.game.cache.audio.add(def.key, audioBuffer);
      })
      .catch((e) => console.warn('[audio] music unavailable:', e?.message || e))
      .finally(() => this._loading.delete(def.key));
  }

  /**
   * Audible part of a decoded track (skips encoder padding / silence at the
   * start and end), so the loop has no audible gap.
   */
  static audibleRegion(buffer, threshold = 0.002) {
    const n = buffer.length;
    const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
    const loud = (i) => chans.some((d) => Math.abs(d[i]) > threshold);
    let a = 0;
    while (a < n && !loud(a)) a++;
    let b = n - 1;
    while (b > a && !loud(b)) b--;
    if (b - a < buffer.sampleRate) return null; // nothing sensible to trim
    const sr = buffer.sampleRate;
    return { start: a / sr, duration: (b + 1 - a) / sr, trimmedStart: a / sr, trimmedEnd: (n - 1 - b) / sr };
  }

  setMusicVolume(v) {
    const k = this.musicVolume ? v / this.musicVolume : 1;
    this.musicVolume = v;
    if (this.music) this.music.setVolume(this.music.volume * k);
  }

  setSfxVolume(v) { this.sfxVolume = v; }

  playMusic(key, opts = {}) {
    if (!this.game) return;
    const { fadeIn = 2500 } = opts;
    const volume = (opts.volume ?? 0.55) * this.musicVolume;
    if (this.music && this.music.key === key && this.music.isPlaying) return;

    if (!this.game.cache.audio.exists(key)) {
      this.pendingMusic = { key, opts }; // will start when the file arrives
      return;
    }
    this.unlock();
    // Crossfade from whatever is playing.
    const old = this.music;
    if (old) {
      this._fade(old, 0, Math.max(400, fadeIn * 0.8), () => old.stop());
    }
    this.music = this.game.sound.add(key, { loop: true, volume: 0 });
    const region = this.loopRegions[key];
    if (region) {
      // loop only the audible part: Phaser schedules each repeat on the audio clock
      this.music.addMarker({ name: 'loop', start: region.start, duration: region.duration, config: { loop: true, volume: 0 } });
      this.music.play('loop');
    } else this.music.play();
    this._fade(this.music, volume, fadeIn);
  }

  /** Lower or raise the current music (e.g. under a sound effect moment). */
  duckMusic(volume, ms = 600) {
    if (this.music) this._fade(this.music, volume, ms);
  }

  /**
   * Volume fades run on the game clock (not a scene's tweens) so they survive
   * scene changes and never leave a track stuck half-way.
   */
  _fade(sound, to, ms, onDone) {
    sound._fadeId = (sound._fadeId || 0) + 1;
    const id = sound._fadeId;
    const from = sound.volume;
    if (ms <= 0) {
      sound.setVolume(to);
      onDone?.();
      return;
    }
    const start = performance.now();
    const step = () => {
      if (id !== sound._fadeId || !sound.manager) return;
      const k = Math.min(1, (performance.now() - start) / ms);
      const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
      sound.setVolume(from + (to - from) * e);
      if (k < 1) setTimeout(step, 30);
      else onDone?.();
    };
    step();
  }

  // ------------------------------------------------------------------ sfx
  /** Play a sound effect by logical name (see audioKeys.js). */
  sfx(name, opts = {}) {
    if (!this.game) return;
    const def = AUDIO_KEYS.sfx[name];
    const volume = (opts.volume ?? def?.volume ?? 0.5) * this.sfxVolume;
    if (def && this.game.cache.audio.exists(def.key)) {
      this.game.sound.play(def.key, { volume, rate: opts.rate ?? 1, detune: opts.detune ?? 0 });
      return;
    }
    this.synth(def?.fallback || name, { volume });
  }

  // ------------------------------------------------------------------ synth
  _noise() {
    const ctx = this.ctx;
    if (!ctx) return null;
    if (!this._noiseBuffer) {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuffer = buf;
    }
    return this._noiseBuffer;
  }

  /** Small procedural sounds used for cinematic moments and as fallbacks. */
  synth(type, { volume = 0.4, duration } = {}) {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out || ctx.state !== 'running') return;
    const t = ctx.currentTime;

    const tone = (freq, start, dur, vol, wave = 'sine') => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = wave;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t + start);
      g.gain.linearRampToValueAtTime(vol, t + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      o.connect(g).connect(out);
      o.start(t + start);
      o.stop(t + start + dur + 0.05);
    };

    switch (type) {
      case 'blip':
        tone(880, 0, 0.05, volume * 0.25, 'square');
        break;
      case 'select':
        tone(660, 0, 0.12, volume * 0.3, 'triangle');
        tone(990, 0.06, 0.18, volume * 0.25, 'triangle');
        break;
      case 'sparkle': {
        // Pentatonic shimmer, high and soft.
        const notes = [1568, 2093, 2349, 2637, 3136];
        notes.forEach((f, i) => tone(f, i * 0.06, 0.6, volume * 0.12));
        break;
      }
      case 'chime': {
        [1318.5, 1975.5, 2637].forEach((f, i) => tone(f, i * 0.09, 1.1, volume * 0.14));
        break;
      }
      case 'whoosh': {
        const src = ctx.createBufferSource();
        src.buffer = this._noise();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 0.9;
        const g = ctx.createGain();
        const d = duration || 2.5;
        bp.frequency.setValueAtTime(250, t);
        bp.frequency.exponentialRampToValueAtTime(1600, t + d * 0.7);
        bp.frequency.exponentialRampToValueAtTime(500, t + d);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(volume * 0.35, t + d * 0.6);
        g.gain.linearRampToValueAtTime(0, t + d);
        src.connect(bp).connect(g).connect(out);
        src.start(t);
        src.stop(t + d + 0.1);
        break;
      }
      case 'land': {
        tone(523.25, 0, 1.4, volume * 0.16);
        tone(783.99, 0.05, 1.6, volume * 0.12);
        tone(1046.5, 0.12, 1.8, volume * 0.1);
        break;
      }
      case 'pop': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(380, t);
        o.frequency.exponentialRampToValueAtTime(900, t + 0.08);
        g.gain.setValueAtTime(volume * 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.2);
        break;
      }
      case 'slide': {
        // Playful "slide whistle" dip, for being pulled into the tree.
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        const d = duration || 0.9;
        o.frequency.setValueAtTime(880, t);
        o.frequency.exponentialRampToValueAtTime(1180, t + d * 0.18);
        o.frequency.exponentialRampToValueAtTime(260, t + d);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(volume * 0.16, t + 0.05);
        g.gain.linearRampToValueAtTime(0, t + d);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + d + 0.05);
        break;
      }
      case 'jingle': {
        // Original discovery motif: a rising sparkle that settles on a warm chord.
        const seq = [[784, 0], [988, 0.11], [1175, 0.22], [1568, 0.36]];
        seq.forEach(([f, s0]) => tone(f, s0, 0.5, volume * 0.13, 'triangle'));
        [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, 0.55, 1.8, volume * 0.07));
        [2093, 2637, 3136].forEach((f, i) => tone(f, 0.6 + i * 0.07, 0.7, volume * 0.05));
        break;
      }
      case 'flourish': {
        // A soft, warm arpeggio for the names (original).
        [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [987.77, 0.36], [1174.66, 0.5]]
          .forEach(([f, s0]) => tone(f, s0, 1.6, volume * 0.09));
        [261.63, 392, 523.25].forEach((f) => tone(f, 0.5, 2.6, volume * 0.06, 'triangle'));
        break;
      }
      case 'glow': {
        [659.25, 987.77, 1318.5].forEach((f, i) => tone(f, i * 0.12, 1.4, volume * 0.06));
        break;
      }
      // ---------- platform-game cues (all original, synthesized) ----------
      case 'heart':
        tone(1174.66, 0, 0.05, volume * 0.07, 'square');
        tone(1567.98, 0.04, 0.12, volume * 0.06, 'square');
        break;
      case 'turtle':
        tone(392, 0, 0.09, volume * 0.1, 'triangle');
        tone(330, 0.1, 0.12, volume * 0.1, 'triangle');
        break;
      case 'start': {
        // Bouncy "let's go!" — up a major sixth, then a little turn.
        [[523.25, 0], [659.25, 0.09], [783.99, 0.18], [880, 0.27], [783.99, 0.38], [1046.5, 0.47]]
          .forEach(([f, s0], i) => tone(f, s0, i === 5 ? 0.45 : 0.12, volume * 0.16, 'square'));
        tone(261.63, 0.47, 0.45, volume * 0.12, 'triangle');
        break;
      }
      case 'jump': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(330, t);
        o.frequency.exponentialRampToValueAtTime(760, t + 0.14);
        g.gain.setValueAtTime(volume * 0.1, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.2);
        break;
      }
      case 'coin':
        tone(1318.5, 0, 0.06, volume * 0.12, 'square');
        tone(1760, 0.055, 0.22, volume * 0.1, 'square');
        break;
      case 'pipe': {
        // Three wobbly descending steps.
        [[392, 0], [311.13, 0.1], [246.94, 0.2]].forEach(([f, s0]) => tone(f, s0, 0.1, volume * 0.14, 'square'));
        break;
      }
      case 'bump':
        tone(196, 0, 0.08, volume * 0.18, 'square');
        tone(147, 0.05, 0.1, volume * 0.14, 'square');
        break;
      case 'check':
        tone(987.77, 0, 0.08, volume * 0.12, 'square');
        tone(1318.5, 0.08, 0.18, volume * 0.12, 'square');
        break;
      case 'victory': {
        // Original little fanfare: rising arpeggio, held tonic, sparkle on top.
        const mel = [[523.25, 0, 0.1], [659.25, 0.1, 0.1], [783.99, 0.2, 0.1], [1046.5, 0.3, 0.22],
          [987.77, 0.55, 0.1], [1046.5, 0.66, 0.1], [1174.66, 0.77, 0.1], [1318.5, 0.88, 0.7]];
        mel.forEach(([f, s0, d]) => tone(f, s0, d, volume * 0.14, 'square'));
        [[261.63, 0], [329.63, 0.3], [392, 0.55], [523.25, 0.88]].forEach(([f, s0]) => tone(f, s0, 0.35, volume * 0.1, 'triangle'));
        [2093, 2637, 3136].forEach((f, i) => tone(f, 1.0 + i * 0.07, 0.5, volume * 0.04));
        break;
      }
      case 'gentle':
        [[659.25, 0], [783.99, 0.14], [1046.5, 0.28]].forEach(([f, s0]) => tone(f, s0, 0.6, volume * 0.1, 'triangle'));
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------ ambience
  /** Procedural night forest: soft wind and sparse distant crickets. */
  startAmbience(volume = 1) {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out || this.ambience) return;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 4);
    master.connect(out);

    // Wind: looping noise through a low-pass whose level breathes slowly.
    const wind = ctx.createBufferSource();
    wind.buffer = this._noise();
    wind.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain).connect(windGain.gain);
    wind.connect(lp).connect(windGain).connect(master);
    wind.start();
    lfo.start();

    // Crickets: tiny pulsed tones scheduled at random intervals.
    let timer = 0;
    const chirp = () => {
      if (!this.ambience) return;
      if (ctx.state === 'running') {
        const t = ctx.currentTime + 0.02;
        const f = 4200 + Math.random() * 600;
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (pan) pan.pan.value = Math.random() * 1.6 - 0.8;
        const pulses = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < pulses; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = f;
          const s = t + i * 0.07;
          g.gain.setValueAtTime(0, s);
          g.gain.linearRampToValueAtTime(0.012, s + 0.008);
          g.gain.linearRampToValueAtTime(0, s + 0.04);
          o.connect(g);
          if (pan) g.connect(pan); else g.connect(master);
          o.start(s);
          o.stop(s + 0.06);
        }
        if (pan) pan.connect(master);
      }
      timer = setTimeout(chirp, 1200 + Math.random() * 3200);
    };
    timer = setTimeout(chirp, 1500);

    this.ambience = {
      stop: () => {
        clearTimeout(timer);
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0, now + 1.5);
        setTimeout(() => {
          try { wind.stop(); lfo.stop(); master.disconnect(); } catch { /* already stopped */ }
        }, 1600);
        this.ambience = null;
      },
    };
  }

  stopAmbience() {
    this.ambience?.stop();
  }
}

export const soundManager = new SoundManager();
