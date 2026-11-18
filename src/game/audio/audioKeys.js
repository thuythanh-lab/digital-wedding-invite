// Audio registry. Only these files ship in the build (see ASSET_MANIFEST.md).

/**
 * Which track is the invitation's background music.
 * 'theme' = Littleroot Town x Pallet Town (permission NOT yet confirmed);
 * 'warm'  = HydroGene "Peaceful Village" (licensed: credit not required) —
 * switch back to 'warm' if permission for the theme cannot be obtained.
 */
export const MAIN_MUSIC = 'theme';

export const AUDIO_KEYS = {
  music: {
    // Mysterious forest exploration (Prologue, Chapter I paths & tunnel).
    forest: { key: 'music-spirits-forest', url: 'assets/audio/music/spirits-forest-loop.mp3' },
    // Warmer theme for the encounter and the key (Chapter I clearing).
    warm: { key: 'music-peaceful-village', url: 'assets/audio/music/peaceful-village.mp3' },
    // Main theme of the platform-game invitation: "Littleroot Town x Pallet Town"
    // (supplied by Minh & Thủy, assets-source/AudioTranscriberAI_Littleroot Town x
    // Pallet Town #.mp3, copied unchanged). Leading/trailing silence is trimmed
    // at load time for a gap-free loop (see SoundManager.preloadMusic).
    // ⚠ No licence found for this file — see README "Music licence".
    theme: { key: 'music-main-theme', url: 'assets/audio/music/main-theme-littleroot-x-pallet.mp3', volume: 0.3 },
  },
  // OGG files from Kenney. If the browser cannot play OGG, `fallback`
  // names a synthesized replacement in SoundManager.synth().
  sfx: {
    select: { key: 'sfx-ui-select', url: 'assets/audio/sfx/ui-select.ogg', volume: 0.45, fallback: 'select' },
    chime: { key: 'sfx-star-chime', url: 'assets/audio/sfx/star-chime.ogg', volume: 0.5, fallback: 'chime' },
    land: { key: 'sfx-star-land', url: 'assets/audio/sfx/star-land.ogg', volume: 0.45, fallback: 'land' },
    dialog: { key: 'sfx-dialog-open', url: 'assets/audio/sfx/dialog-open.ogg', volume: 0.3, fallback: 'select' },
    blip: { key: 'sfx-text-blip', url: 'assets/audio/sfx/text-blip.ogg', volume: 0.12, fallback: 'blip' },
    // Chapter I
    creak: { key: 'sfx-tree-creak', url: 'assets/audio/sfx/tree-creak.ogg', volume: 0.5, fallback: 'whoosh' },
    tumble: { key: 'sfx-tumble', url: 'assets/audio/sfx/tumble-cloth.ogg', volume: 0.45, fallback: 'whoosh' },
    pop: { key: 'sfx-pop', url: 'assets/audio/sfx/pop.ogg', volume: 0.5, fallback: 'pop' },
    confirm: { key: 'sfx-confirm', url: 'assets/audio/sfx/confirm.ogg', volume: 0.4, fallback: 'select' },
    merge: { key: 'sfx-fragment-merge', url: 'assets/audio/sfx/fragment-merge.ogg', volume: 0.5, fallback: 'chime' },
    // Chapter II
    gateOpen: { key: 'sfx-gate-open', url: 'assets/audio/sfx/gate-open.ogg', volume: 0.55, fallback: 'whoosh' },
    gateStuck: { key: 'sfx-gate-stuck', url: 'assets/audio/sfx/gate-stuck.ogg', volume: 0.5, fallback: 'pop' },
    keyTurn: { key: 'sfx-key-turn', url: 'assets/audio/sfx/key-turn.ogg', volume: 0.55, fallback: 'select' },
    nudge: { key: 'sfx-nudge', url: 'assets/audio/sfx/nudge.ogg', volume: 0.45, fallback: 'sparkle' },
    letterOpen: { key: 'sfx-letter-open', url: 'assets/audio/sfx/letter-open.ogg', volume: 0.5, fallback: 'select' },
    unfold: { key: 'sfx-paper-unfold', url: 'assets/audio/sfx/paper-unfold.ogg', volume: 0.45, fallback: 'whoosh' },
    // Platform-game invitation (Kenney RPG Audio, CC0)
    photoCoin: { key: 'sfx-photo-coin', url: 'assets/audio/sfx/photo-coin.ogg', volume: 0.6, fallback: 'coin' },
    mapOpen: { key: 'sfx-map-open', url: 'assets/audio/sfx/map-open.ogg', volume: 0.5, fallback: 'select' },
    mapClose: { key: 'sfx-map-close', url: 'assets/audio/sfx/map-close.ogg', volume: 0.45, fallback: 'select' },
    flowerFix: { key: 'sfx-flower-fix', url: 'assets/audio/sfx/flower-fix.ogg', volume: 0.5, fallback: 'sparkle' },
    land: { key: 'sfx-land', url: 'assets/audio/sfx/land.ogg', volume: 0.35, fallback: 'bump' },
  },
};
