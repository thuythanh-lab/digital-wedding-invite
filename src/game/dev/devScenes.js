// Development-only scenes. Imported dynamically from main.js when
// import.meta.env.DEV is true, so they are excluded from production builds.
import { CharacterPreviewScene } from './CharacterPreviewScene.js';
import { ForestCharacterDemoScene } from './ForestCharacterDemoScene.js';

export const DEV_SCENES = [CharacterPreviewScene, ForestCharacterDemoScene];
