import Phaser from 'phaser';
import { COLORS, DEPTH, FONT_TITLE } from '../config/theme.js';
import { STRINGS } from '../config/strings.vi.js';
import { NightSky } from '../effects/NightSky.js';
import { Fireflies } from '../effects/Fireflies.js';
import { PixelButton } from '../ui/PixelButton.js';
import { soundManager } from '../audio/SoundManager.js';
import { AUDIO_KEYS } from '../audio/audioKeys.js';
import { viewport, fitCamera, WORLD_W } from '../utils/viewport.js';
import { makeText } from '../utils/text.js';

/**
 * SCENE 1 — Title.
 * A living night forest. Pressing BẮT ĐẦU plays the first beats of the
 * falling-star cinematic here (button fades, stars shimmer, one star swells),
 * then hands the exact frame to FallingStarScene.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const L = viewport.layout;
    this.L = L;
    this.state = 'idle';
    fitCamera(this.cameras.main, L);
    this.cameras.main.setBackgroundColor('#04071a');

    const H = L.height;
    this.sky = new NightSky(this, H);

    this.fireflies = new Fireflies(this, { x: 16, y: H * 0.56, w: WORLD_W - 32, h: H * 0.36 }, {
      count: 12, depth: DEPTH.fireflies, glowScale: 0.12,
    });

    this.buildTitle(H);
    this.buildButton(H);

    // Fade in from the night.
    this.cameras.main.fadeIn(1200, 4, 7, 26);

    // Stream the music while the guest reads the title.
    soundManager.preloadMusic(this, AUDIO_KEYS.music.forest);

    // Any first touch unlocks audio (iOS requires a gesture).
    this.input.once('pointerdown', () => soundManager.unlock());

    this.onLayout = (l) => this.handleLayout(l);
    viewport.on('change', this.onLayout);
    this.events.once('shutdown', () => viewport.off('change', this.onLayout));
  }

  buildTitle(H) {
    const cx = WORLD_W / 2;
    const titleY = H * 0.3;
    this.titleGroup = this.add.container(0, 0).setDepth(DEPTH.ui);

    // Soft halo behind the title.
    const halo = this.add.image(cx, titleY, 'glow').setDisplaySize(340, 150)
      .setTint(0x6a76c9).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);

    const titleStyle = {
      fontFamily: FONT_TITLE,
      fontSize: '58px',
      fontStyle: '600',
      color: '#f6dea0',
      align: 'center',
      padding: { top: 14, bottom: 6, left: 8, right: 8 },
    };
    const glow = makeText(this, cx, titleY, STRINGS.title, titleStyle).setOrigin(0.5);
    glow.setShadow(0, 0, '#f5cf73', 14, false, true).setAlpha(0.55).setColor('#f5cf73');
    const title = makeText(this, cx, titleY, STRINGS.title, titleStyle).setOrigin(0.5);
    title.setShadow(0, 3, '#0b0f2a', 0, false, true);
    // Vertical gold gradient on the letters.
    const ctx = title.context;
    const grad = ctx.createLinearGradient(0, 0, 0, title.height);
    grad.addColorStop(0.2, '#fff1c8');
    grad.addColorStop(0.65, '#f2cd78');
    grad.addColorStop(1, '#c7953f');
    title.setFill(grad);

    // Fit the title to the width on very narrow screens.
    const maxW = WORLD_W - 40;
    if (title.width > maxW) {
      const s = maxW / title.width;
      title.setScale(s);
      glow.setScale(s);
    }

    // Ornament: thin gold rule with a diamond.
    const orn = this.add.graphics();
    const oy = titleY + 40;
    orn.fillStyle(COLORS.gold, 0.85);
    orn.fillRect(cx - 70, oy, 56, 2);
    orn.fillRect(cx + 14, oy, 56, 2);
    orn.fillStyle(COLORS.gold, 0.45);
    orn.fillRect(cx - 92, oy, 18, 2);
    orn.fillRect(cx + 74, oy, 18, 2);
    const diamond = this.add.image(cx, oy + 1, 'star-core').setScale(1).setTint(0xffe7b0);

    const subtitle = makeText(this, cx, oy + 38, STRINGS.subtitleLines, {
      fontSize: '22px',
      lineSpacing: 2,
      color: '#cfd3ee',
      align: 'center',
      wordWrap: { width: WORLD_W - 48, useAdvancedWrap: true },
    }).setOrigin(0.5, 0.5);
    subtitle.setShadow(0, 2, '#04071a', 0, false, true);

    this.titleGroup.add([halo, glow, title, orn, diamond, subtitle]);
    this.titleTexts = [glow, title, subtitle];

    // Entrance: rise and fade, staggered.
    [halo, glow, title].forEach((o) => {
      const a = o.alpha;
      o.setAlpha(0);
      o.y += 10;
      this.tweens.add({ targets: o, alpha: a, y: o.y - 10, duration: 1800, delay: 500, ease: 'Sine.easeOut' });
    });
    [orn, diamond].forEach((o) => {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 1200, delay: 1300 });
    });
    subtitle.setAlpha(0);
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 1400, delay: 1700 });

    // A slow breathing glow keeps the title alive.
    this.tweens.add({
      targets: glow, alpha: { from: 0.4, to: 0.6 }, duration: 2600, delay: 2400,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: diamond, angle: 90, duration: 6000, repeat: -1, ease: 'Linear',
    });
  }

  buildButton(H) {
    const safeBottom = this.L.safe.bottom;
    // Bottom band: centred in the dark forest floor, above the home indicator.
    const y = Math.min(H * 0.885, H - safeBottom - 52);
    this.button = new PixelButton(this, WORLD_W / 2, y, STRINGS.startButton, {
      onPress: () => this.begin(),
    });
    this.button.setDepth(DEPTH.ui).setAlpha(0);
    this.button.enabled = false;
    this.tweens.add({
      targets: this.button, alpha: 1, duration: 1200, delay: 2600,
      onComplete: () => { this.button.enabled = true; },
    });
    // Allow early taps to still work once visible.
    this.time.delayedCall(2700, () => { this.button.enabled = true; });
  }

  /** Beats 1–4 of the transition; the fall itself continues in FallingStarScene. */
  begin() {
    if (this.state !== 'idle') return;
    this.state = 'starting';
    soundManager.unlock();
    soundManager.sfx('select');
    soundManager.playMusic(AUDIO_KEYS.music.forest.key, { volume: 0.5, fadeIn: 5000 });

    // 1. The button and title fade away.
    this.tweens.add({ targets: this.button, alpha: 0, y: this.button.y + 6, duration: 600, ease: 'Sine.easeIn' });
    this.tweens.add({ targets: this.titleGroup, alpha: 0, duration: 1100, delay: 200, ease: 'Sine.easeInOut' });
    this.fireflies.fadeOut(1200);

    // 2. The stars shimmer.
    this.time.delayedCall(700, () => this.sky.shimmer(1000));

    // 3. One star begins glowing brighter.
    const d = this.sky.destiny;
    d.locked = true;
    this.time.delayedCall(1500, () => {
      soundManager.sfx('chime');
      this.tweens.add({ targets: d.glow, scale: 0.55, alpha: 0.95, duration: 1300, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: d.img, scale: 3, duration: 1300, ease: 'Sine.easeInOut' });
      this.tweens.add({
        targets: d.img, angle: 45, duration: 650, yoyo: true, ease: 'Sine.easeInOut',
      });
    });

    // 4. …and falls. Hand over the exact frame.
    this.time.delayedCall(3000, () => {
      this.scene.start('FallingStar', { starX: d.x, starY: d.y, glowScale: d.glow.scale });
    });
  }

  handleLayout(l) {
    // Rebuild cleanly when idle (deterministic seed → identical look).
    if (this.state === 'idle') {
      this.scene.restart();
    } else {
      fitCamera(this.cameras.main, l);
    }
  }

  update(time, dt) {
    this.sky.update(dt);
    this.fireflies.update(dt);
  }
}
