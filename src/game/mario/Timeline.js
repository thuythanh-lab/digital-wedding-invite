/**
 * Scroll-driven character timeline
 * ------------------------------------------------------------------
 * Each character has its own Track: a list of keys `{ b, d, st }`.
 *   b  — progress (from the scroll position)
 *   d  — distance along the level path at that progress
 *   st — what the character does while moving INTO this key
 *        (null = automatic: walk/run/idle from the motion itself)
 * Between keys `d` is interpolated linearly, so the state for any `b` is a
 * pure function: scrolling back replays everything in reverse, fast scrolling
 * simply lands in a valid state, and nothing depends on timers.
 *
 * State fields (all optional):
 *   pose: [frame, dir]   hold a single atlas pose, e.g. ['stand', 'down']
 *   face: dir            idle facing this way
 *   prop: key            small item drawn at the hands (notebook, map)
 *   emote: key           bubble above the head
 *   hop: h               vertical arc of height h over the interval
 *   dive: true           head-first into the pipe (sprite flipped)
 */
export class Track {
  constructor(d0 = 0) {
    this.keys = [{ b: 0, d: d0, st: null }];
  }

  get last() { return this.keys[this.keys.length - 1]; }

  /** Absolute key. */
  key(b, d, st = null) {
    const L = this.last;
    if (b <= L.b) throw new Error(`Track keys must increase (b ${b} ≤ ${L.b})`);
    this.keys.push({ b, d, st });
    return this;
  }

  /** Move to distance d over db progress units. */
  move(db, d, st = null) { return this.key(this.last.b + db, d, st); }

  /** Stay in place for db progress units. */
  hold(db, st = null) { return this.key(this.last.b + db, this.last.d, st); }

  /** Walk at `speed` (path units per progress unit) for db. */
  walk(db, st = null, speed = 1) { return this.key(this.last.b + db, this.last.d + db * speed, st); }

  /** Walk at normal pace until reaching distance d; returns the b of arrival. */
  walkTo(d, st = null, speed = 1) {
    const L = this.last;
    const b = L.b + Math.max(1, (d - L.d) / speed);
    this.key(b, d, st);
    return b;
  }

  /** Walk at normal pace until progress b (no-op if already there). */
  walkUntil(b, st = null) {
    const L = this.last;
    if (b > L.b + 0.01) this.key(b, L.d + (b - L.b), st);
    return this;
  }

  /** Hold still until progress b. */
  holdUntil(b, st = null) {
    const L = this.last;
    if (b > L.b + 0.01) this.key(b, L.d, st);
    return this;
  }

  /** Distance at progress b (after the last key: keeps walking). */
  dAt(b) { return this.eval(b).d; }

  eval(b) {
    const k = this.keys;
    // at (or before) the very first key, show the state of the first interval,
    // so a track can open mid-pose (e.g. Minh already reading his notebook)
    if (b <= k[0].b) return { d: k[0].d, st: k.length > 1 && k[1].d === k[0].d ? k[1].st : null, t: 0 };
    for (let i = 1; i < k.length; i++) {
      if (b < k[i].b) {
        const t = (b - k[i - 1].b) / (k[i].b - k[i - 1].b);
        return { d: k[i - 1].d + (k[i].d - k[i - 1].d) * t, st: k[i].st, t };
      }
    }
    const L = k[k.length - 1];
    return { d: L.d + (b - L.b), st: null, t: 0 };
  }
}

/**
 * A named interaction ("beat") on the timeline: its progress window, plus an
 * optional `env(b, t)` that drives props (flowers, turtle, flag…) from b.
 */
export class Beat {
  constructor(id, b0, b1, env = null) {
    Object.assign(this, { id, b0, b1, env });
  }

  progress(b) { return Math.min(1, Math.max(0, (b - this.b0) / (this.b1 - this.b0))); }

  contains(b) { return b >= this.b0 && b <= this.b1; }
}
