import Phaser from 'phaser';
import { IMAGES, FRAMES } from '../config/assets.js';
import { AUDIO_KEYS } from '../audio/audioKeys.js';
import { createProceduralTextures } from '../effects/ProceduralTextures.js';
import { showMusicToggle } from '../ui/MusicToggle.js';
import { createStoryTextures } from '../effects/StoryTextures.js';
import { createGateArt } from '../effects/GateArt.js';
import { storyState } from '../systems/StoryState.js';

/**
 * Loads the small shared sprites and sound effects up front. Music and
 * character atlases stream in later, when a scene needs them.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    Object.entries(IMAGES).forEach(([key, url]) => this.load.image(key, url));
    Object.values(AUDIO_KEYS.sfx).forEach(({ key, url }) => this.load.audio(key, [url]));
    this.load.image('kenneyKey', 'assets/images/kenney-key.png');
    this.load.image('stele', 'assets/images/kenney-dungeon/stele.png');
    this.load.image('carved-block', 'assets/images/kenney-dungeon/carved-block.png');
    // A missing/undecodable sfx must never block the game.
    this.load.on('loaderror', (file) => console.warn('[boot] could not load', file.key));
  }

  create() {
    // Register named frames on the sprite sheets.
    Object.entries(FRAMES).forEach(([texKey, frames]) => {
      const tex = this.textures.get(texKey);
      Object.entries(frames).forEach(([name, [x, y, w, h]]) => tex.add(name, 0, x, y, w, h));
    });
    // Crown-only frames of the big trees (used to build the ancient trees' canopies).
    const bt = this.textures.get('bigTrees');
    for (let i = 0; i < 8; i++) bt.add(`crown${i}`, 0, 3 + 32 * i, 1, 23, 21);
    createProceduralTextures(this);
    createStoryTextures(this);
    createGateArt(this);

    const loader = document.getElementById('boot-loader');
    loader?.classList.add('is-done');
    setTimeout(() => loader?.remove(), 900);
    showMusicToggle();

    // Shortcuts (only scenes registered in this build can be reached):
    //   ?scene=fall | forest | paths | tunnel | clearing | gate      jump into the story
    //   ?preview=characters | forest | gate[&from=path|gate|garden|letter|reveal]
    //                                                               dev server only
    const params = new URLSearchParams(window.location.search);
    const jump = {
      fall: 'FallingStar', forest: 'Forest', paths: 'TwoPaths', tunnel: 'TreeTunnel', clearing: 'Clearing',
      gate: 'ForgottenGate',
    }[params.get('scene')];
    let data;
    let preview = null;
    if (import.meta.env.DEV) {
      preview = { characters: 'CharacterPreview', forest: 'ForestCharacterDemo', gate: 'ForgottenGate' }[params.get('preview')];
      if (params.get('preview') === 'gate') {
        // Initialise the narrative state Chương II needs (the Promise Key).
        storyState.set('hasPromiseKey', true);
        data = { start: params.get('from') || 'path' };
      }
    }
    const target = [preview, jump].find((k) => k && this.scene.get(k)) || 'Title';
    this.scene.start(target, data);
  }
}
