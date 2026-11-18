import { ForestScene, FOCUS, D } from '../scenes/ForestScene.js';
import { pathAt } from '../effects/ForestGround.js';
import { MinhCharacter } from '../characters/MinhCharacter.js';
import { ThuyCharacter } from '../characters/ThuyCharacter.js';
import { loadCharacterSheets } from '../characters/characterAnimations.js';
import { CHARACTERS } from '../characters/characterConfig.js';
import { COLORS } from '../config/theme.js';
import { makeText, refreshTextResolution } from '../utils/text.js';
import { DevButton } from './DevButton.js';

/**
 * DEVELOPMENT ONLY — `?preview=forest`
 * The real enchanted forest (same lighting, depth sorting, terrain) with Minh
 * and Thủy placed at gameplay scale. Tap the ground to walk the selected
 * character there. This is a visual test, not the meeting scene.
 */
export class ForestCharacterDemoScene extends ForestScene {
  constructor() {
    super('ForestCharacterDemo');
  }

  init(data) {
    super.init({ fromFall: false, ...data });
  }

  preload() {
    loadCharacterSheets(this);
  }

  create() {
    super.create();

    const below = pathAt(FOCUS.y + 70, FOCUS.y);
    this.minh = new MinhCharacter(this, {
      x: below.cx - 4, y: FOCUS.y + 70, facing: 'up', layer: this.world, depthBase: D.sorted,
    });
    // Thủy starts half-hidden behind trees on the left, to test occlusion.
    this.thuy = new ThuyCharacter(this, {
      x: 40, y: FOCUS.y + 18, facing: 'right', variant: '-bq', layer: this.world, depthBase: D.sorted,
    });
    this.selected = 'minh';

    // Short demonstration walk once the star has landed.
    this.time.delayedCall(3200, async () => {
      const a = pathAt(FOCUS.y + 40, FOCUS.y);
      this.minh.moveTo(a.cx - 6, FOCUS.y + 40, { faceOnArrival: 'up' });
      // Emerges from behind the trees onto the path edge.
      const b = pathAt(FOCUS.y + 30, FOCUS.y);
      await this.thuy.moveTo(b.cx - 22, FOCUS.y + 18);
      await this.thuy.moveTo(b.cx - 22, FOCUS.y + 32);
      await this.thuy.lookAt(this.minh);
      await this.minh.playAction('look');
      await this.thuy.playAction('nod');
    });

    // Dev overlay (UI layer).
    const L = this.L;
    const y = L.safe.top + 26;
    this.devNote = makeText(this, 10, y - 16, 'Thử nghiệm nhân vật · chạm mặt đất để di chuyển', {
      fontSize: '15px', color: COLORS.inkGold,
    }).setShadow(0, 1, '#000', 0, false, true);
    this.ui.add(this.devNote);
    this.pick = new DevButton(this, 70, y + 26, 120, 46, '', () => {
      this.selected = this.selected === 'minh' ? 'thuy' : 'minh';
      this.refreshPick();
    });
    this.ui.add(this.pick);
    this.refreshPick();
    this.uiTexts.push(this.devNote, this.pick.label);
    refreshTextResolution(this.uiTexts);

  }

  /** Taps first go to the story (dialogue / star); otherwise move a character. */
  onTap(pointer, over) {
    const dialogueWasOpen = this.dialogue.open;
    super.onTap(pointer, over);
    if (!this.ready || dialogueWasOpen || over.includes(this.starZone) || over.includes(this.pick)) return;
    const p = pointer.positionToCamera(this.cameras.main);
    const c = this[this.selected];
    // Walk in two axis-aligned legs, like a classic top-down RPG.
    c.walkPath([{ x: p.x, y: c.y }, { x: p.x, y: p.y }]);
  }

  refreshPick() {
    this.pick.setLabel(`Đang chọn: ${CHARACTERS[this.selected].displayName}`).setActive(true);
  }
}
