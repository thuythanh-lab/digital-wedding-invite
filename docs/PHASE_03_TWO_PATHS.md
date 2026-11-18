# Phase 03 — Two Paths, One Fate (Chương I · Hai lối đi)

**Status: APPROVED by the owner (18 Nov 2026).** Phase 04 may build on this chapter.

Play: http://localhost:5174 (full story) · jump in: `?scene=paths`, `?scene=tunnel`, `?scene=clearing`
Screenshots: `docs/screenshots/phase-03/` · Checkpoints: tag `phase-03-start` (before), see git log (after)

## Flow (first-time visit ≈ 60–75 s, depending on reading speed)
| # | Scene | Guest does | What happens |
|---|---|---|---|
| — | Prologue (Phase 1, unchanged until the end) | taps the star after the first line | the star drifts up the path; the forest fades into Chapter I |
| 1 | **The fork** (`TwoPathsScene`) | reads 1 line | chapter card *CHƯƠNG I · HAI LỐI ĐI*; the star arrives at a fork. Minh strolls up the left path and Thủy up the right, each pausing to look around, with a thick band of trees between them. Narration: "Có những con đường tưởng chừng chẳng giao nhau..." |
| 2 | **Follow the light** | taps the pulsing star | the star rises toward the ancient tree. The camera drifts left to Minh walking, then right to Thủy, then centres on the tree as both paths converge (≈ 10 s, gentle easing, no dialogue) |
| 3 | **The secret tree** | taps the glowing hollow ("Khám phá?") | the star slips into the hollow. The tree creaks and glows and the hollow widens; both look, step closer, "!" bubbles, a small hop. The tree pulls them in with a slide-whistle and a tumble, and an iris wipe closes on the hollow |
| — | **Tree tunnel** (`TreeTunnelScene`, ≈ 5 s) | — (or **Bỏ qua ›** on replays) | they tumble gently down a winding root tunnel lit by glowing mushrooms and veins; the star leads; the tunnel splits into two moonlit exits |
| 4 | **Two paths become one** (`ClearingScene`) | reads 1 line | they pop out of two different root hollows of a second ancient tree. Both look around, notice each other ("…"), pause, and walk to meet. They turn to face us; he reaches, she reaches, they hold hands (warm light, the music turns warmer). Narration: "...cho đến khi chúng dẫn về cùng một nơi." |
| 8 | **The Promise Key** | taps to acknowledge | the star returns brighter and the forest lights up. Two golden fragments arc toward each other and merge above the couple. Discovery screen: **ĐÃ TÌM THẤY!** · *Chìa khóa của lời hẹn ước* |
| 9 | **The hidden path** | taps **TIẾP TỤC HÀNH TRÌNH** | the tree glows, buds bloom around the clearing, the overgrowth parts and a glowing hidden path appears. The star waits at its entrance; the couple turns, hand in hand, to face it. The button leads to a safe end card: "Còn tiếp..." + **CHƠI LẠI** (replay) |

The names Minh/Thủy and all wedding details remain hidden.

## Narrative state
`src/game/systems/StoryState.js` (localStorage `csk.story.v1`, falls back to memory):
- `hasPromiseKey: true` after the discovery screen (for the gate chapter)
- `chapter: 1` when Chapter I is complete
- `seen.tunnel` enables the skip button

## Reusable systems added
| File | Purpose |
|---|---|
| `scenes/StoryScene.js` | base for story scenes: world/UI layers and cameras, dialogue, vignette, fades, iris wipe, resize handling |
| `systems/SceneScript.js` | guarded awaits (`wait`, `tween`, `all`, `tap`): nothing continues after a scene shuts down |
| `systems/Hotspot.js` | tappable story objects with pulsing rings; fires once (no double triggers) |
| `systems/CameraDirector.js` | smooth pans and follows clamped to the world |
| `systems/NightLighting.js` | reusable moonlight / star / mushroom lightmap |
| `world/ForestKit.js` | ground with any number of winding paths and clearings; flora scatter; mossy stones; leaves |
| `world/AncientTree.js` | procedural giant tree: bark trunk with roots, moss and hollows, and a dome canopy of Fantasy Lands crowns |
| `ui/StoryUI.js` | chapter card, "Khám phá?" bubble, emote bubbles, item-discovery presentation |
| `ui/SmallButton.js` | shared small pixel button (the dev tools reuse it) |

Characters: `moveTo(..., { axisBias })` for natural facing on winding paths, `walkPath` that idles only at the end, and `halt()`.

## New art & audio
- **Hand-holding frames** (`reach`, `hold`, front and back) added to `scripts/build-wedding-characters.py`. Each character's inner arm is redrawn reaching toward the other; at 16 art px apart the hands clasp. Thủy keeps the bouquet in her other hand.
- Procedural: ancient trees, tunnel walls with roots and glowing veins, hollow mouth, emote bubbles, buds and blooms.
- **Promise Key**: Kenney Tiny Town key (tile 117) recoloured to gold with a rose gem, split into two fragments.
- Music: *Spirits Forest* for exploration, crossfading to **Peaceful Village** (HydroGene, re-encoded 80 kbps, 836 KB, lazy-loaded) at the hand-holding moment.
- SFX: Kenney RPG Audio (`creak1` tree, `cloth2` tumble); Kenney Interface (`pluck_001` pop, `confirmation_002` acknowledge, `glass_003` fragments merging); synthesized slide-whistle, glow shimmer and an original discovery jingle. All respect the music toggle.

## Tested (in-app Chromium, device emulation; not a physical phone)
- Full flow at 390×844: Title → falling star → Prologue → (tap star) → fork → star tap → camera journey → tree hollow → tunnel → clearing → hand-holding → key → hidden path → chapter end. No game errors (the only console line was the browser pane's audio device).
- Each Chapter I scene at 320×568 and 430×932; live resize mid-scene; no horizontal scroll.
- Rapid repeated taps on the prologue star and the continue button trigger once.
- Taps during landing are ignored until the dialogue is ready.
- Replay (CHƠI LẠI, or restarting scenes mid-script): no errors or leftover actions.
- Skip button appears after the tunnel has been seen once and works.
- `hasPromiseKey` persisted.
- Production build: dev tools excluded; Chapter I runs with zero console messages.
- Not tested: real iOS/Android devices, and actually *hearing* the audio (the test browser has no audio output).

## Known limitations
- The art uses the pack's 2-pixel faces, so emotion is carried by poses, emotes and timing.
- There are no dedicated "surprised" or "turn" frames (a hop + "!" bubble and the directional poses are used instead).
- The hidden path leads off-screen by design (the gate is Phase 04).
- `?scene=` shortcuts also work in production builds (harmless, but could be restricted).
- Music: the HydroGene loop has a tiny gap at the loop point (MP3 encoder padding).
