import { Character } from './Character.js';
import { CHARACTERS } from './characterConfig.js';

/** Minh — the groom: charcoal three-piece suit. Calm and curious. */
export class MinhCharacter extends Character {
  constructor(scene, opts = {}) {
    super(scene, CHARACTERS.minh, opts);
  }
}
