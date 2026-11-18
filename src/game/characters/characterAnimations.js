import { CHARACTERS, COMMON, DIRECTIONS, ANIM, frameName } from './characterConfig.js';

/** Queue the wedding atlases on a scene loader (only what is missing). */
export function loadCharacterSheets(scene, ids = Object.keys(CHARACTERS)) {
  ids.forEach((id) => {
    const c = CHARACTERS[id];
    if (!scene.textures.exists(c.atlas)) scene.load.atlas(c.atlas, c.png, c.json);
  });
}

/** `<atlas><variant>:<action>-<dir>` */
export function animKey(def, variant, action, dir = '') {
  return `${def.atlas}${variant}:${action}${dir ? `-${dir}` : ''}`;
}

function seq(def, list, dir, variant) {
  return list.map(([pose, duration]) => ({
    key: def.atlas,
    // Entries that already contain a direction ("left-stand") are used as-is.
    frame: pose.includes('-') && DIRECTIONS.includes(pose.split('-')[0])
      ? `${pose}${variant}`
      : frameName(dir, pose, variant),
    duration,
  }));
}

/**
 * Register every animation for one character (all variants, all directions).
 * Shared by Minh and Thủy — only the recipes in characterConfig differ.
 */
export function registerCharacterAnimations(scene, def) {
  const A = scene.anims;
  const add = (key, frames, repeat = 0) => {
    if (!A.exists(key)) A.create({ key, frames, frameRate: 10, repeat });
  };
  def.variants.forEach((v) => {
    DIRECTIONS.forEach((dir) => {
      add(animKey(def, v, 'walk', dir), [0, 1, 2, 3].map((i) => ({
        key: def.atlas, frame: frameName(dir, `walk${i}`, v), duration: 1000 / ANIM.walkFrameRate,
      })), -1);
      add(animKey(def, v, 'idle', dir), seq(def, def.idle, dir, v), -1);
      add(animKey(def, v, 'look', dir), seq(def, COMMON.look[dir], dir, v));
      add(animKey(def, v, 'nod', dir), seq(def, COMMON.nod, dir, v));
      const ex = def.actions.expressive;
      if (ex && !ex.fixed) add(animKey(def, v, 'expressive', dir), seq(def, ex.frames, dir, v));
    });
    const ex = def.actions.expressive;
    if (ex && ex.fixed) add(animKey(def, v, 'expressive'), seq(def, ex.frames, 'down', v));
  });
}
