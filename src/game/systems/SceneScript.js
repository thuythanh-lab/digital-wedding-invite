/**
 * Coordinates asynchronous story beats inside one scene.
 *
 *   const s = new SceneScript(this);
 *   await s.wait(600);
 *   await s.all(minh.moveTo(...), thuy.moveTo(...));
 *   await s.tween({ targets: star, y: 100, duration: 800 });
 *
 * When the scene shuts down every pending await is abandoned (the promise
 * never resolves), so characters, cameras and dialogue can never act on a
 * destroyed scene, and nothing runs twice.
 */
export class SceneScript {
  constructor(scene) {
    this.scene = scene;
    this.alive = true;
    scene.events.once('shutdown', () => { this.alive = false; });
    scene.events.once('destroy', () => { this.alive = false; });
  }

  /**
   * A cancellable sub-sequence (e.g. a skippable cinematic). After
   * `branch.cancel()` its awaits never resolve, so the abandoned sequence
   * simply stops where it was.
   */
  branch() {
    const parent = this;
    const b = new SceneScript(this.scene);
    b.cancelled = false;
    Object.defineProperty(b, 'alive', {
      get: () => parent.alive && !b.cancelled,
      set: () => {},
    });
    b.cancel = () => { b.cancelled = true; };
    return b;
  }

  /** Wrap any promise: resolves only if the scene is still running. */
  guard(promise) {
    return new Promise((resolve) => {
      Promise.resolve(promise).then((v) => {
        if (this.alive) resolve(v);
      });
    });
  }

  wait(ms) {
    return this.guard(new Promise((r) => this.scene.time.delayedCall(ms, r)));
  }

  all(...promises) {
    return this.guard(Promise.all(promises));
  }

  tween(config) {
    return this.guard(new Promise((resolve) => {
      this.scene.tweens.add({ ...config, onComplete: () => resolve() });
    }));
  }

  /** Resolve on the next tap anywhere (after an optional minimum delay). */
  tap(minDelay = 0) {
    return this.guard(new Promise((resolve) => {
      this.scene.time.delayedCall(minDelay, () => {
        this.scene.input.once('pointerdown', () => resolve());
      });
    }));
  }
}
