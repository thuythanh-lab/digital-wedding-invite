/**
 * Narrative state — a few flags, remembered between visits when the browser
 * allows it (localStorage can be blocked; the game still works).
 *
 *   storyState.get('hasPromiseKey')   → true once the key was found
 *   storyState.seen('tunnel')         → the tree tunnel was watched once
 */
const STORAGE_KEY = 'csk.story.v1';

const DEFAULTS = {
  hasPromiseKey: false,
  chapter: 0, // 0 = prologue, 1 = chapter I done
  seen: {},
};

class StoryState {
  constructor() {
    this.data = { ...DEFAULTS, seen: {} };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) this.data = { ...DEFAULTS, ...JSON.parse(raw) };
      this.data.seen = this.data.seen || {};
    } catch {
      /* private mode: keep in memory only */
    }
  }

  save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  seen(id) {
    return !!this.data.seen[id];
  }

  markSeen(id) {
    this.data.seen[id] = true;
    this.save();
  }
}

export const storyState = new StoryState();
