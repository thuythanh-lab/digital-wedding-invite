import Phaser from 'phaser';

/**
 * Scaling strategy: Scale.NONE + manual sizing.
 * The canvas backing store is (CSS size × devicePixelRatio) and displayed with
 * zoom = 1/dpr, so one canvas pixel = one device pixel. Each scene camera then
 * zooms so that the logical world is 360 units wide (see utils/viewport.js).
 * This avoids FIT letterboxing, never stretches, and keeps text crisp.
 *
 * `scenes` is chosen in main.js: the platform-game invitation (LevelScene),
 * or — on the dev server with ?preview=… — the character preview tools.
 */
export function createGameConfig(layout, scenes) {
  // `?timer` drives the loop with setTimeout (testing in background tabs).
  const forceSetTimeOut = new URLSearchParams(window.location.search).has('timer');
  return {
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#a9d9ea',
    pixelArt: true,
    roundPixels: false,
    disableContextMenu: true,
    banner: false,
    fps: { target: 60, smoothStep: true, forceSetTimeOut },
    scale: {
      mode: Phaser.Scale.NONE,
      width: layout.pixelW,
      height: layout.pixelH,
      zoom: 1 / layout.dpr,
      autoRound: true,
    },
    input: { activePointers: 2 },
    audio: { disableWebAudio: false },
    render: { powerPreference: 'high-performance', batchSize: 2048 },
    scene: scenes,
  };
}
