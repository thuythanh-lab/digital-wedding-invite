import { Character } from './Character.js';
import { CHARACTERS } from './characterConfig.js';

/** Thủy — the bride: ivory strapless gown, veil, optional bouquet. Lively. */
export class ThuyCharacter extends Character {
  constructor(scene, opts = {}) {
    super(scene, CHARACTERS.thuy, opts);
  }

  /** Hold (or put away) the wedding bouquet. */
  setBouquet(on) {
    return this.setVariant(on ? '-bq' : '');
  }

  get hasBouquet() {
    return this.variant === '-bq';
  }

  scheduleBlink(now) {
    super.scheduleBlink(now - 600); // blinks a touch more often
  }
}
