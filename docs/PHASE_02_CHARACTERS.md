# Phase 02 — Minh & Thủy in their wedding outfits

**Status: APPROVED by the owner (18 Nov 2026).** Phase 03 may build on these designs.

Art direction (revised 18 Nov 2026): the couple wear their wedding outfits for
the **whole story**. The planned outfit transformation is removed. Names and
wedding details stay hidden from guests until the reveal chapter.

Preview: http://localhost:5174/?preview=characters  ·  In the forest: http://localhost:5174/?preview=forest
Screenshots: `docs/screenshots/phase-02/`

## Can the Tiny Pixel Fantasy generator do this?
No. It has tunics, dresses with aprons, coats, cloaks, hoods, crowns and armour,
but no suit, shirt-and-tie, strapless gown, veil or bouquet. Recolouring would
still read as fantasy clothing.

**Solution:** `scripts/build-wedding-characters.py` keeps only the pack's
anatomy (bodies, faces, hair and the real walk/pose frames, so proportions match
what you approved) and **paints new clothing on every frame**:
- The pack's clothing layers are used only as invisible masks to find the torso,
  sleeves and legs in each pose.
- Everything visible on the clothes is new pixel work, generated from the
  frame's anatomy.

| Minh — groom | Thủy — bride |
|---|---|
| charcoal three-piece suit with subtle pinstripes (every 3rd column, visible when enlarged) | ivory strapless gown, sweetheart neckline |
| white shirt collar, silver tie, dark vest with button, light lapel edges | champagne sash with a blush flower; bow at the back |
| ivory-and-blush boutonnière on his left lapel | A-line skirt shaped per frame: widens to the hem, short train in side view |
| tailored jacket ending at the hip, back vent | scattered blush flowers with a few sage leaves |
| polished black shoes, neat dark side-parted hair | dark high-bun updo, ivory flower comb, tulle veil (narrow at the shoulders in front, a tapering fall at back and side) |
| | optional bouquet (white and blush roses) held in her front hand |

The outline stays the dark plum used before, so both sit with the Fantasy Lands forest.

## Size
- Frame 48 × 48. Body ≈ 14 × 29 art px; Thủy's gown is up to ≈ 19 px at the hem.
  The anchor is between the feet (y = 42). Trees stay at 1× (decision of 18 Nov).
- In game: 1 art px = 2 logical units, so on a 390 px-wide phone each character
  is ≈ 63 CSS px tall.
- Atlases: `minh-groom` (40 frames, 8 KB), `thuy-bride` (96 frames incl. bouquet set, 17 KB).

## Animations (all directions unless noted)
| Animation | How | Notes |
|---|---|---|
| Idle | Minh: stand → breathe (upper body sinks 1 px). Thủy: stand → skirt sways right → breathe → sways left | plus random blinks (real closed-eyes frame) |
| Walk ↓ ↑ ← → | 4 frames @ 8 fps: step · pass · step · pass | real leg frames; **the gown is redrawn every frame**: the hem swings opposite each step and lifts on the stepping side; the side view kicks forward and trails behind. Same skirt geometry every time, so it never pops |
| Turn | reversing direction passes through a side/front pose (90 ms) | the pack has no dedicated turn frames |
| Look around | glance left, back, glance right, back | uses real directional poses |
| Nod (Gật đầu) | head dips 1 px twice | subtle expression |
| Expressive (Cử chỉ) | Minh: small wave · Thủy: twirl (gown flares through all four sides) | |
| Special (Đặc biệt) | Minh: offers his hand · Thủy: raises the bouquet beside her head | held poses, ready for story beats |
| Bouquet on/off | Thủy `setBouquet(true/false)` | every frame exists with and without it |

Code: `src/game/characters/` — the shared `Character` holds all logic;
`MinhCharacter`/`ThuyCharacter` only add their recipe. Scripting is
promise-based (`moveTo`, `walkPath`, `lookAt`, `playAction`, `special`).

## Assessment
- **Recognisable on a phone:** yes. At game scale the white shirt and tie vs the
  ivory gown, veil and bouquet read instantly as a groom and a bride.
- **With the forest:** same pixel density, outline colour and lightmap lighting.
  At night the gown glows softly in the star light. Minh is darker but outlined
  and lit, so he stays readable.
- **Limits:**
  - Pinstripes are only visible when enlarged.
  - The faces are the pack's simple 2-pixel eyes.
  - Minh's hands use the pack's darker skin shading, so they look slightly brown.
  - There's no dedicated turn animation.
  - The gown hides the legs, so walking reads through the skirt sway, the head
    bob and the hem steps.
- Tested in emulated 320×568, 360×640, 390×844 and 430×932 portrait views: no
  overflow, no console errors. Not tested on a physical phone yet.

## Not done (by design)
Meeting scene, key, tunnel, reveal, RSVP: Phase 03 and later.
