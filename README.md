# Minh & Thủy — Wedding Adventure

A mobile-first, platform-game-style wedding invitation (Minh & Thủy,
24.12.2026). Phaser 3 + Vite, plain JavaScript.

**Status:** Mario-inspired redesign (scroll-to-play level). The previous
story version (*Chuyện Chưa Kể*) is preserved at git tag `pre-mario-redesign`;
its scene files are still in `src/game/scenes/` but no longer loaded.

## How the invitation works

A brief loading bar (pastel sky, only while assets load) → the **title world**
(`src/game/mario/TitleIntro.js`): pastel sky, drifting clouds, mountains,
hills, Minh on a little platform on the left (checks his watch, fixes his
jacket, glances at Thủy), Thủy on the right with her bouquet (fixes it, looks
at Minh, twirls), a turtle strolling on the lower ledge; *MINH & THỦY ·
24.12.2026 · [TÊN KHÁCH], SẴN SÀNG CHƯA?* (name exactly as in the link,
upper-cased; just *SẴN SÀNG CHƯA?* without one) with **▶ BẮT ĐẦU** and the
secondary *XEM THÔNG TIN THIỆP* → **break the START button** (≈3.3 s,
*BỎ QUA* skips): it shakes, both jump on, it turns to bricks, cracks, breaks,
they fall and the camera follows them onto the first platform → the guest
**scrolls**, and Minh & Thủy run through
one vertical level: title → date board (Minh checks the calendar ✓) → map &
pipe → underground → venue garden (Thủy straightens a flower on the arch) →
RSVP platform → finish flag.

- **Scroll to play** (`src/game/mario/ScrollDriver.js`): a transparent native
  scroll layer sits over the canvas. Its `scrollTop` is the only input; the
  scene evaluates the whole level as a pure function of that progress
  (`src/game/mario/LevelPath.js`), so scrolling back reverses everything and
  fast scrolling can never lose the characters.
- **Guest name**: `?khach=Tên%20Khách` (also `?guest=`, `?to=`, `?name=`;
  optional `?id=` is sent with the RSVP). Without a name the dialog asks for one.
- **RSVP** (`src/game/mario/rsvp.js`): POSTs JSON (as `text/plain`, so Google
  Apps Script works without CORS pre-flight) to `VITE_RSVP_ENDPOINT`. Success
  is shown only when the endpoint replies 2xx with `{ "ok": true }`. Locally
  (`vite` / `vite preview` on localhost) it uses `/api/rsvp`, which appends to
  `rsvp-data/rsvps.json` (git-ignored). `?rsvpTest=fail` simulates a server
  error. **A production endpoint has not been set up yet.**
- **Map button** (📍 XEM ĐƯỜNG ĐI): a real link (new tab, so the game keeps its
  place) inside the info cards, shown only when `mapUrl` is set in
  `src/game/config/event.vi.js`. It currently points to
  `https://maps.app.goo.gl/rNnmcg2bZFmnGfDZ6`, which resolves to the
  “VCCI Tower” place on Google Maps (9 Đào Duy Anh — the Seasons building).
- **Readable information**: the essentials (names · TIỆC CƯỚI · 11:00 · THỨ NĂM ·
  24.12.2026 · SEASONS · address · map) are real HTML text in
  *Be Vietnam Pro* (self-hosted, `@fontsource/be-vietnam-pro`), never below
  16 CSS px, on the venue card (`#venue-card`, built by
  `src/game/mario/InfoCard.js` from the config). Pixel fonts (Handjet, VT323)
  stay for headings and game dialogue.
- **Quick view** (*XEM THÔNG TIN THIỆP* on the start screen, and the **THIỆP**
  button in the game's top bar): the same essentials plus floor, the map link,
  the same RSVP, the saved answer (with *ĐỔI CÂU TRẢ LỜI*), and a way back to
  the game. Closing it never changes the game's scroll position.
- **HUD**: one small pill (♥ hearts · photo coins found); tapping it opens the
  photo gallery.

### Invitation links (admin) and RSVP (status)

**Admin page (local only):** run `bun run dev`, open
<http://localhost:5174/admin/>. Enter the real website address once
(`ĐƯỜNG DẪN WEBSITE THIỆP CƯỚI`, https only, GitHub Pages sub-paths OK), then a
guest name → **TẠO LINK** → **SAO CHÉP LINK**. The page is *not* in the
production build (`dist/` never contains it). Its guest list lives only in that
browser's localStorage — use **XUẤT CSV** (UTF-8, opens in Excel) to back it up.

- Personal link: `<site>?khach=<name>&id=<guest id>` → *“ANH TUẤN, SẴN SÀNG CHƯA?”*.
  Guest ids: 10 random characters from the Web Crypto API, created once per
  record (identical names get different ids); they identify an answer, they do
  not stop a link being forwarded.
- Generic link: `<site>` → *“BẠN SẴN SÀNG CHƯA?”*; the RSVP asks *TÊN CỦA BẠN*
  and each browser gets its own submission id (`web-…`).
- Each invitation remembers only its own answer in the browser (`mt.rsvp.v2`).

| | Where it posts | Status |
|---|---|---|
| On this computer (`localhost`, dev or preview) | `/api/rsvp` → `rsvp-data/rsvps.json` (one row per guest id) | ✅ tested |
| Published site | `VITE_RSVP_ENDPOINT` in `.env` (the Google Apps Script) | ⚠ configured, **not verified**: the deployed script has no `doGet`, and its `doPost` contract is unknown. Success is shown only for a JSON reply with `"ok": true`. See `docs/apps-script/` for the matching script and a one-row live test (`?rsvpLive=1`). |

### Navigation: four screens (one swipe = one screen)

The level is still one deterministic timeline; navigation is now discrete
(`src/game/mario/ScreenNav.js` + `LevelScene` "screens"): swipe up / wheel /
↓ / ▼ plays the next screen's entrance animation on a clock at its natural
speed, then the scene settles; swipe down / ↑ / ▲ jumps back to the previous
screen's settled state (short fade). A second swipe during a transition skips
to its end. Screens: 1 Welcome (after BẮT ĐẦU) → 2 Wedding date (≈1.8 s) →
3 Seasons (Gentle Glide + Secret Pipe, ≈3.4 s) → 4 RSVP (≈1.2 s); after a
confirmed answer the ending plays on screen 4 (≈3 s). Hearts: 3 + 6 during the
first two transitions (×99 before the RSVP). Coins: welcome (bush), date
(behind the calendar), Seasons (earth wall by the pipe).

### Music licence ⚠ (check before publishing)

The background music is **"Littleroot Town x Pallet Town"**
(`public/assets/audio/music/main-theme-littleroot-x-pallet.mp3`, an unchanged
copy of `assets-source/AudioTranscriberAI_Littleroot Town x Pallet Town #.mp3`).
It is an arrangement of two themes from the Pokémon games, whose music is
owned by Nintendo / Creatures / GAME FREAK. **No licence or permission was
found** for this file (its only tag is the ffmpeg encoder name; no readme
beside it). Playing it on a public website may need permission from the
rights holders. Until that is confirmed, publish with the licensed fallback:
set `MAIN_MUSIC = 'warm'` in `src/game/audio/audioKeys.js` (HydroGene
"Peaceful Village", credit not required).

Mix: music 30 % (`theme.volume`), effects unchanged (`soundManager.sfxVolume`
= 1); silence at the start/end of the track is trimmed at load for a gap-free
loop.

### Hearts and length (current)

**Nine big hearts, 11 points each** (♥ ×00 → ×11 → … → ×99), all on the
natural route and all collected before the RSVP: 2 on the opening platform,
2 under the calendar, 1 mid-glide, 2 at Seasons, 2 on the walk to the RSVP
spot. A heart is collected once (high-water mark on path distance), scrolling
back never re-awards it, a fast scroll collects everything it passed, replay
resets to ×00. Each pick-up: sound, "+11", a few pixel bits. Scroll: ≈ 670 CSS
px to the RSVP, ≈ 920 in total (was 1,127 / 1,447); START intro ≈ 2.1 s.

### Current journey (compact, with the Secret Pipe)

Opening (Late Groom, turtle) → **the Gentle Glide** (no steps or walls: Thủy
hops off the ledge and floats down through the open sky right of the calendar,
veil streaming; Minh hesitates, follows with arms out past a little cloud,
wobbles on landing and straightens his jacket; segment type `glide` in
`LevelPath.js`, fully scroll-driven) → date platform under the calendar (Minh
checks it) → **Secret Pipe** right after the calendar: a quick
descent past clouds, treetops, roots and warm light → side exit straight into
the venue (sign: SEASONS · TIỆC CƯỚI · 9 Đào Duy Anh · 11:00 · 24.12.2026, with
the 📍 XEM ĐƯỜNG ĐI Google Maps button; Thủy fixes a flower, Minh his suit) →
the RSVP and finish on the **same floor** (no extra step or platform): Minh
& Thủy stop and face the guest, the RSVP box opens by itself (*“[Tên], bạn sẽ
đến chung vui chứ?”* — ▶ CÓ, MÌNH SẼ ĐẾN! / TIẾC QUÁ, MÌNH KHÔNG ĐẾN ĐƯỢC);
after the backend confirms, Minh dashes to the flag, Thủy straightens it, they
celebrate, the venue sign gives way to the “see you” banner and the turtle
finally waddles out of the pipe over the finish line. Only a thin slab of
floor and a shallow strip of earth remain under them. Scroll ≈ 1,124 CSS px
to the RSVP, ≈ 1,444 in total. Photo coins: behind the opening bush, behind
the flowers at the garden tree's foot, in the earth wall by the pipe exit.
The pre-change ending is at git tag `pre-final-scene`; the version before the
UX & readability pass is at `pre-ux-refinement`; the brick-staircase opening
is at `pre-gentle-glide`; the version before the title world is at
`pre-title-world`. The five-layer Great Drop is preserved at git tag
`with-great-drop` (`src/game/mario/GreatDrop.js` is kept but not loaded).

### Previous journey (shortened, with the Great Drop — superseded)

One short level, five sections: opening (Late Groom) → date platform under
the calendar → **The Great Drop** (sky · canopy · roots · cave exit · garden,
`src/game/mario/GreatDrop.js`) → garden venue (sign + arch, Flower
Inspection) → RSVP platform with the finish flag (Finish Line). Total scroll
≈ 2,500 CSS px (was ≈ 6,050). Hearts: 90 before the RSVP, the last 9 right
before the flag. Photo coins: behind the opening bush, behind the flowers in
the venue arch, on the brick step by the RSVP sign. The older interactions
(gap jump, secret pipe, turtle hop, wrong direction, coin surprise) are no
longer triggered; they can be recovered from git tag `pre-shorten`.

### Gameplay v2 (hearts, photo coins, eight interactions — superseded)

- **Timeline** (`src/game/mario/Timeline.js`): Minh and Thủy each have their own
  track of keys `{ b, d, state }` built in `LevelScene.buildTimeline()`. The
  eight interactions — late groom, unexpected jump, flower inspection, secret
  pipe, turtle encounter, wrong direction, coin surprise, finish line — are
  sections of those tracks plus props driven from the same progress value.
- **♥ ×99** *(superseded — now 9 hearts × 11 points, see below)*: 11 groups × 9 hearts along the path. A heart is collected when
  the leading character's path distance passes it, using a high-water mark,
  so scrolling back never re-awards hearts; *CHƠI LẠI* resets it, a page
  refresh starts fresh. 90 are collected before the RSVP, the last 9 on the
  way to the finish line.
- **Secret photo coins** (tap/click): behind the flower patch, behind the
  turtle's bush, on the high brick block near the floating coin. Found coins are
  remembered in `localStorage['mt.photos.v1']` (never sent anywhere). The
  gallery at the end (*XEM KHOẢNH KHẮC*) lets anyone unlock all three.
- **Wedding photos**: add them as
  `public/assets/photos/wedding-photo-01.jpg`, `-02.jpg`, `-03.jpg`
  (≈1200 px long side, ~80 % JPEG). They are only downloaded when opened.
  Until then the viewer says *“Ảnh sẽ được cập nhật sớm!”* — no stand-in photo.

## Run

Node is not installed on this machine; [Bun](https://bun.sh) runs Vite fine.

```bash
bun install
bun run dev        # http://localhost:5174 (also on your LAN via --host)
bun run build      # → dist/ (static files, deploy anywhere)
bun run preview    # serve dist/ on :4173
```

To test on a real phone, run `bun run dev` and open the printed *Network* URL on
the phone (same Wi-Fi).

Debug URL flags:
- `?timer` drives the game loop with `setTimeout`, for background tabs.
- `?rsvpTest=fail` (localhost only) makes the local RSVP endpoint fail.

Development previews (dev server only — removed from production builds):
- http://localhost:5174/?preview=characters — the groom & bride together
  (pixel-perfect enlargement), all four directions at once (`4 hướng`), real
  in-game scale, touch buttons for every animation, bouquet on/off, day/night,
  stroll. Optional keys: arrows/WASD walk, Space idle, L look, N nod,
  E gesture, Q special, B bouquet, G grid.
- http://localhost:5174/?preview=forest — both in the real forest (lighting,
  depth sorting). Tap the ground to walk the selected character.

Rebuild the wedding character atlases (needs `assets-extracted/`):

```bash
python -E -P scripts/build-wedding-characters.py
```

## Structure

```
src/
  main.js                     boot: fonts → viewport → Phaser
  styles.css                  full-screen stage, desktop frame, music button
  game/
    config/   gameConfig.js theme.js event.vi.js (wedding facts) mario.vi.js (UI text)
    scenes/   LevelScene (the invitation) — older story scenes kept for reference
    mario/    LevelArt (procedural pixel art) LevelPath (deterministic path)
              ScrollDriver RsvpDialog rsvp (client + guest name)
    effects/  NightSky Fireflies GuidingStar ForestGround ProceduralTextures
    characters/ Character (shared logic) MinhCharacter ThuyCharacter
              characterAnimations characterConfig
    dev/      CharacterPreviewScene ForestCharacterDemoScene (dev server only)
    audio/    SoundManager (music, sfx + synth fallback, ambience) audioKeys
    ui/       DialogueBox PixelButton PixelFrame MusicToggle
    utils/    viewport (responsive camera) text rng
public/assets/                only the files the game uses (see ASSET_MANIFEST.md)
scripts/encode-mp3.mjs        WAV → small MP3 (dev tool)
scripts/build-wedding-characters.py  paint groom/bride atlases over the pack's anatomy
```

Guest-facing text lives in `src/game/config/mario.vi.js` and `event.vi.js`
(the RSVP dialog's static labels are also in `index.html`).

## Responsive scaling (how it works)

- **Logical world width = 360 units, always.** The visible height follows the
  screen: about 640 on a 9:16 phone, about 780 on a 19.5:9 iPhone. Scenes place
  important content in a central band and extend sky/forest vertically, so nothing
  is cropped or stretched.
- **Phaser `Scale.NONE` + manual sizing.** The canvas backing store is
  `CSS size × devicePixelRatio` (capped at 3) and shown at `zoom = 1/dpr`. Each
  scene camera zooms by `pixelWidth / 360`. Pixel art stays sharp, and text is
  rasterised at device resolution (`Text.setResolution`), so Vietnamese
  diacritics stay crisp.
- **Phones** (aspect ≤ 0.7) fill the whole screen, using `viewport-fit=cover`
  and `100dvh`. Safe-area insets are read from CSS `env()` and converted to
  logical units for the dialogue box, the start button and the music toggle.
- **Desktop and tablets** show a centred phone-shaped column, at most 440 CSS px
  wide, on a dark night backdrop. Landscape phones get the same column plus a
  gentle "rotate" hint; landscape is never forced.
- On resize or rotation, `viewport.js` emits `change`. Idle scenes rebuild
  (deterministic seeds keep them identical); active ones re-fit their cameras
  and UI.

## Phase 1 test results (in-app Chromium, device emulation)

| Viewport | Title | Fall | Forest + dialogue | Notes |
|---|---|---|---|---|
| 320 × 568 | ✓ | — | ✓ | title scales to fit |
| 360 × 640 | ✓ | — | ✓ | |
| 360 × 800 | ✓ | — | ✓ | live resize mid-scene ✓ |
| 390 × 844 | ✓ | ✓ | ✓ | full flow, taps, music toggle ✓ |
| 430 × 932 | ✓ | — | ✓ | |
| 1440 × 900 | ✓ | — | ✓ | centred 440 × 852 column |

No horizontal scroll at any size. The production build logs no console messages.
Screenshots are in `docs/screenshots/`. **Not yet tested on physical iOS or
Android devices.**
