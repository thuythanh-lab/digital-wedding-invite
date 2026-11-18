"""
Wedding character generator — Minh (groom) & Thủy (bride).

The Tiny Pixel Fantasy pack has no suits or gowns, so this script keeps only
the pack's anatomy (body, head, eyes, hair and the real walk/pose frames) and
paints NEW clothing on every frame:

  Minh  charcoal three-piece suit (pinstripes, white shirt, silver tie, vest,
        lapels, boutonnière), polished black shoes
  Thủy  ivory strapless gown with sweetheart neckline, champagne sash with a
        flower, procedurally shaped A-line skirt that sways with each step,
        scattered blush flowers, a veil, optional bouquet

Per-frame anatomy comes from the pack's own clothing layers used as MASKS
(never as visible art): Top 2 = torso, Top 7 = torso+sleeves, Bottom 4 = legs.

Output (Phaser JSON-hash atlases, 48×48 frames, feet on y = 42):
  public/assets/images/characters/minh-groom.png/.json
  public/assets/images/characters/thuy-bride.png/.json

Usage:  python -E -P scripts/build-wedding-characters.py [--preview DIR]
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-extracted', 'tiny-pixel-fantasy', 'Sprite')
OUT = os.path.join(ROOT, 'public', 'assets', 'images', 'characters')
CELL = 48
DIRS = {'down': 0, 'right': 1, 'left': 2, 'up': 3}

PACK_OUTLINE = (0x19, 0x06, 0x57)
O = (42, 28, 48)  # our outline (dark plum, matches Fantasy Lands edges)


def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def load(rel):
    return np.array(Image.open(os.path.join(SRC, rel)).convert('RGBA'))


def cell(arr, r, c, flip=False):
    a = arr[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL].copy()
    return a[:, ::-1].copy() if flip else a


def recolor(a, cmap):
    out = a.copy()
    for src, dst in cmap.items():
        s = hx(src) if isinstance(src, str) else src
        m = (a[:, :, 0] == s[0]) & (a[:, :, 1] == s[1]) & (a[:, :, 2] == s[2]) & (a[:, :, 3] > 0)
        out[m, :3] = hx(dst) if isinstance(dst, str) else dst
    return out


def over(dst, src):
    m = src[:, :, 3] > 0
    dst[m] = src[m]
    return dst


def lum(px):
    return 0.3 * px[..., 0] + 0.59 * px[..., 1] + 0.11 * px[..., 2]


def shade_levels(layer):
    """Return per-pixel 0/1/2 (dark/mid/light) from a pack layer's shading, -1 = outline/empty."""
    a = layer
    lv = np.full(a.shape[:2], -1, dtype=int)
    filled = a[:, :, 3] > 0
    is_out = filled & (a[:, :, 0] == PACK_OUTLINE[0]) & (a[:, :, 1] == PACK_OUTLINE[1]) & (a[:, :, 2] == PACK_OUTLINE[2])
    inner = filled & ~is_out
    if inner.any():
        L = lum(a.astype(float))
        vals = np.unique(np.round(L[inner]))
        # rank luminance values into three bands
        lo, hi = np.percentile(vals, 34), np.percentile(vals, 67)
        lv[inner & (L <= lo)] = 0
        lv[inner & (L > lo) & (L <= hi)] = 1
        lv[inner & (L > hi)] = 2
    lv[is_out] = -2
    return lv


def mask(a):
    return a[:, :, 3] > 0


def put(img, x, y, col):
    if 0 <= x < CELL and 0 <= y < CELL:
        img[y, x, :3] = hx(col) if isinstance(col, str) else col
        img[y, x, 3] = 255


def outline_shape(img, shape, col=O):
    """Paint an outline ring on the outer border of a boolean shape."""
    h, w = shape.shape
    for y in range(h):
        for x in range(w):
            if not shape[y, x]:
                continue
            edge = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < w and 0 <= ny < h) or not shape[ny, nx]:
                    edge = True
                    break
            if edge:
                put(img, x, y, col)


# ---------------------------------------------------------------- pack layers
LAYERS = {
    'bodyM': load('Body/2.png'),
    'bodyT': load('Body/1.png'),
    'eyes': load('Eyes/4.png'),
    'torso': load('Top/2_1.png'),
    'coat': load('Top/7_1.png'),
    'legs': load('Bottom/4_1.png'),
    'shoes': load('Bottom/Shoes_Layer.png'),
    'hairM_r': load('Rear_Hair/2_5.png'),
    'hairM_f': load('Front_Hair/3_5.png'),
    'hairT_r': load('Rear_Hair/7_5.png'),
    'hairT_f': load('Front_Hair/3_5.png'),
}

GLOBAL = {PACK_OUTLINE: O, '#c2d2d9': '#4d3a3e', '#ddf6f7': '#f3eee6', '#196bbf': '#6a4532', '#ab5e20': '#6a4532'}
HAIR = {'#313441': '#221c20', '#555a6d': '#3d3236'}


class Frame:
    """All per-frame source cells + derived anatomy for one (row, col)."""

    def __init__(self, body_key, row, col, flip=False, drop_arm=None):
        g = lambda k: cell(LAYERS[k], row, col, flip)
        self.body = recolor(g(body_key), GLOBAL)
        self.eyes = recolor(g('eyes'), GLOBAL)
        self.torso = g('torso')
        self.coat = g('coat')
        self.legs = g('legs')
        self.shoes = g('shoes')
        self.g = g
        bm = mask(self.body)
        ys, xs = np.nonzero(bm)
        self.top = ys.min()
        self.bottom = ys.max()  # feet / ground line
        lm = mask(self.legs)
        self.waist = int(np.nonzero(lm)[0].min()) if lm.any() else 34
        tm = mask(self.torso)
        tys, txs = np.nonzero(tm)
        self.neck = int(tys.min()) if tm.any() else 25
        row_w = np.nonzero(tm[self.waist - 1])[0]
        if len(row_w) == 0:
            row_w = txs
        self.waist_l, self.waist_r = int(row_w.min()), int(row_w.max())
        self.cx = (self.waist_l + self.waist_r) / 2.0
        self.drop_arm = drop_arm
        if drop_arm:
            # Remove one arm (body + sleeve) so a new reaching arm can be drawn.
            m = self.arm_region(drop_arm)
            for layer in (self.body, self.coat, self.torso):
                layer[m] = 0

    def arm_region(self, side):
        m = np.zeros((CELL, CELL), dtype=bool)
        y0, y1 = self.neck + 1, self.waist + 3
        if side == 'right':
            m[y0:y1, self.waist_r + 1:] = True
        else:
            m[y0:y1, :self.waist_l] = True
        return m


# ---------------------------------------------------------------- Minh
SUIT = {0: hx('#2a2d34'), 1: hx('#3a3e47'), 2: hx('#4e535e')}
STRIPE = 11


def paint_minh(f, dirn, pose):
    img = np.zeros((CELL, CELL, 4), dtype=np.uint8)
    over(img, f.body)
    over(img, f.eyes)
    cx = int(round(f.cx))

    # Trousers (pinstriped charcoal) — legs mask, below the jacket.
    legs = f.legs
    lv = shade_levels(legs)
    for y, x in zip(*np.nonzero(mask(legs))):
        if lv[y, x] == -2:
            put(img, x, y, O)
            continue
        c = SUIT[max(0, lv[y, x] - 0)]
        c = SUIT[min(1, lv[y, x])]
        if (x - cx) % 3 == 0 and lv[y, x] >= 1:
            c = tuple(min(255, v + STRIPE) for v in c)
        put(img, x, y, c)

    # Polished black shoes.
    sl = shade_levels(f.shoes)
    for y, x in zip(*np.nonzero(mask(f.shoes))):
        if sl[y, x] == -2:
            put(img, x, y, O)
        else:
            put(img, x, y, '#4a4956' if sl[y, x] == 2 else '#1c1b21')

    # Jacket = torso + sleeves (coat mask), pinstripes on mid/light tones.
    coat = f.coat
    cl = shade_levels(coat)
    cm = mask(coat)
    for y, x in zip(*np.nonzero(cm)):
        if y > f.waist + 2:  # tailored length: just below the hip
            continue
        if cl[y, x] == -2:
            put(img, x, y, O)
            continue
        c = SUIT[cl[y, x]]
        if (x - cx) % 3 == 0 and cl[y, x] >= 1 and y > f.neck + 1:
            c = tuple(min(255, v + STRIPE) for v in c)
        put(img, x, y, c)
    # Close the jacket hem with an outline row.
    for x in range(CELL):
        if cm[min(f.waist + 2, CELL - 1), x] and mask(img)[f.waist + 3, x] and not cm[f.waist + 3, x]:
            put(img, x, f.waist + 3, O) if False else None

    ny = f.neck + 1
    W, Ws = '#f3f0ea', '#cfcac2'
    tie, tie_d = '#9aa0ab', '#6e7480'
    vest = '#1b1d22'
    if dirn == 'down' and pose not in ('offer_side',):
        # Shirt collar, tie, vest V, lapels, buttons, boutonnière.
        for x in range(cx - 1, cx + 3):
            put(img, x, ny, W)
        put(img, cx - 1, ny + 1, W)
        put(img, cx + 2, ny + 1, W)
        put(img, cx, ny + 1, tie)
        put(img, cx + 1, ny + 1, tie_d)
        for k in range(2, 6):
            put(img, cx - 1, ny + k, vest)
            put(img, cx + 2, ny + k, vest)
            put(img, cx, ny + k, tie if k < 5 else vest)
            put(img, cx + 1, ny + k, tie_d if k < 5 else vest)
        put(img, cx, ny + 5, '#8f939c')  # vest button
        # Lapel highlights
        for k in range(0, 4):
            put(img, cx - 2, ny + k, '#555a64')
            put(img, cx + 3, ny + k, '#555a64')
        # Boutonnière on his left lapel (viewer's right)
        put(img, cx + 4, ny + 1, '#f6efe0')
        put(img, cx + 4, ny + 2, '#e6c9c9')
        put(img, cx + 5, ny + 2, '#7f9a6f')
    elif dirn in ('left', 'right'):
        front = 1 if dirn == 'right' else -1
        # Shirt + tie sliver at the chest front.
        row = np.nonzero(cm[ny + 1])[0]
        if len(row):
            fx = row.max() - 1 if front > 0 else row.min() + 1
            put(img, fx, ny, W)
            put(img, fx, ny + 1, W)
            put(img, fx, ny + 2, tie)
            put(img, fx, ny + 3, tie_d)
            put(img, fx - front, ny, '#555a64')
            put(img, fx - front, ny + 1, '#555a64')
            if dirn == 'left':
                put(img, fx - front * 2, ny + 2, '#f6efe0')
    elif dirn == 'up':
        put(img, cx, ny - 0, Ws)
        put(img, cx + 1, ny - 0, Ws)
        for k in range(f.waist, f.waist + 3):  # back vent
            put(img, cx, k, '#1b1d22')

    # Hair (neat, dark) on top.
    over(img, recolor(recolor(f.g('hairM_r'), HAIR), GLOBAL))
    over(img, recolor(recolor(f.g('hairM_f'), HAIR), GLOBAL))
    return img


# ---------------------------------------------------------------- Thủy
IV = {'hi': hx('#fffbf3'), 'base': hx('#f4ecdc'), 'mid': hx('#e6dbc4'), 'sh': hx('#d3c4a7'), 'deep': hx('#bba98a')}
SASH, SASH_D = hx('#e4cfae'), hx('#c9b08a')
BLUSH, BLUSH_D, LEAF = hx('#ecb9bf'), hx('#d4919b'), hx('#8aa27c')
VEIL, VEIL_D, VEIL_E = hx('#f4f0f6'), hx('#ddd6e4'), hx('#bdb3c9')


def skirt_shape(f, dirn, sway=0.0, flare=0.0, kick=0):
    """Boolean mask + per-pixel u (−1..1 across) for the gown skirt."""
    top = f.waist
    hem = f.bottom
    H = max(1, hem - top)
    shape = np.zeros((CELL, CELL), dtype=bool)
    u = np.zeros((CELL, CELL))
    for y in range(top, hem + 1):
        t = (y - top) / H
        if dirn in ('down', 'up'):
            w0 = (f.waist_r - f.waist_l + 1) / 2.0
            w1 = 8.6 + flare
            hw = w0 + (w1 - w0) * (t ** 0.8)
            c = f.cx + sway * (t ** 2)
            left, right = c - hw, c + hw
            # hem lift on the stepping side
            if kick and y >= hem - 1:
                if kick > 0:
                    left += 1
                else:
                    right -= 1
        else:
            front = 1 if dirn == 'right' else -1
            fx = f.waist_r if front > 0 else f.waist_l
            bx = f.waist_l if front > 0 else f.waist_r
            fr = fx + front * (1.6 + flare * 0.5 + (0.8 if kick else 0)) * (t ** 1.1)
            bk = bx - front * (4.8 + flare + sway * 0.6) * (t ** 1.25)
            if y >= hem - 1:
                bk -= front * 1  # a short train
            left, right = (bk, fr) if front > 0 else (fr, bk)
            c = (left + right) / 2.0
            hw = max(1.0, (right - left) / 2.0)
        for x in range(int(math.floor(left)), int(math.ceil(right)) + 1):
            if left - 0.35 <= x <= right + 0.35 and 0 <= x < CELL:
                shape[y, x] = True
                u[y, x] = (x - c) / max(hw, 1)
    return shape, u


def paint_skirt(img, f, dirn, shape, u):
    top, hem = f.waist, f.bottom
    H = max(1, hem - top)
    for y, x in zip(*np.nonzero(shape)):
        t = (y - top) / H
        uu = u[y, x]
        if dirn == 'up':
            uu = uu  # light still from the upper left
        col = IV['base']
        if uu < -0.55:
            col = IV['hi']
        elif uu > 0.62:
            col = IV['sh']
        elif uu > 0.35:
            col = IV['mid']
        # soft folds that open toward the hem
        if t > 0.25:
            for fpos in (-0.28, 0.22):
                if abs(uu - fpos) < 0.11:
                    col = IV['mid'] if col != IV['sh'] else IV['deep']
        if y >= hem - 1:
            col = IV['mid'] if uu < 0.5 else IV['sh']
        put(img, x, y, col)
    outline_shape(img, shape)


def stamp_flowers(img, shape, u, f, dirn):
    top, hem = f.waist, f.bottom
    H = max(1, hem - top)
    pts = [(-0.55, 0.45), (0.15, 0.62), (0.6, 0.8), (-0.2, 0.86), (0.45, 0.4)]
    for pu, pv in pts:
        y = int(round(top + pv * H))
        if y >= hem - 1:
            y = hem - 2
        xs = [x for x in range(CELL) if shape[y, x]]
        if len(xs) < 4:
            continue
        # find column whose u is closest to pu
        x = min(xs[1:-1], key=lambda xx: abs(u[y, xx] - pu))
        put(img, x, y, BLUSH)
        # a leaf under only some blooms keeps the pattern delicate
        if pu < 0 and shape[y + 1, x] and y + 1 < hem - 1:
            put(img, x, y + 1, LEAF)


def hand_point(f, raised=False, prefer='left'):
    """Lowest (or highest) bare-skin arm pixel, used to place the bouquet."""
    body = mask(f.body)
    torso = mask(f.torso)
    arms = body & ~torso
    arms[:f.neck + 1, :] = False
    arms[f.waist + 3:, :] = False
    ys, xs = np.nonzero(arms)
    if not len(ys):
        return None
    if raised:
        i = np.argmin(ys)
        return int(xs[i]), int(ys[i])
    if prefer == 'left':
        sel = xs < f.cx
        if sel.any():
            ys, xs = ys[sel], xs[sel]
    elif prefer in ('front_r', 'front_l'):
        # the arm on the facing side
        sel = xs >= f.cx if prefer == 'front_r' else xs <= f.cx
        if sel.any():
            ys, xs = ys[sel], xs[sel]
    i = np.argmax(ys)
    return int(xs[i]), int(ys[i])


BOUQUET = [
    '.pwp.',
    'pWpWp',
    'wpWpw',
    '.gwg.',
    '..g..',
]
BQ_PAL = {'p': BLUSH, 'P': BLUSH_D, 'w': hx('#fbf6ec'), 'W': hx('#f0e3d0'), 'g': LEAF}


def stamp_bouquet(img, x, y):
    for j, row in enumerate(BOUQUET):
        for i, ch in enumerate(row):
            if ch in BQ_PAL:
                put(img, x - 2 + i, y - 2 + j, BQ_PAL[ch])
    # thin outline around the bloom for readability
    for j, row in enumerate(BOUQUET[:3]):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            for dx, dy in ((0, -1), (-1, 0), (1, 0)):
                ii, jj = i + dx, j + dy
                inside = 0 <= jj < 3 and 0 <= ii < 5 and BOUQUET[jj][ii] != '.'
                if not inside:
                    px, py = x - 2 + ii, y - 2 + jj
                    if 0 <= px < CELL and 0 <= py < CELL and img[py, px, 3] == 0:
                        put(img, px, py, BLUSH_D)


def paint_thuy(f, dirn, pose, sway=0.0, flare=0.0, kick=0, bouquet=False):
    img = np.zeros((CELL, CELL, 4), dtype=np.uint8)
    cx = f.cx
    hair_r = recolor(recolor(f.g('hairT_r'), HAIR), GLOBAL)
    hair_f = recolor(recolor(f.g('hairT_f'), HAIR), GLOBAL)

    # Veil: a narrow, tapering fall of tulle from the bun.
    hm = mask(hair_r)
    veil = np.zeros((CELL, CELL), dtype=bool)
    if hm.any():
        hys, hxs = np.nonzero(hm)
        bun_y = int(hys.min()) + 3
        if dirn == 'up':
            c0 = int(round(cx))
            vend = f.waist - 2
            for y in range(bun_y, vend + 1):
                t = (y - bun_y) / max(1, vend - bun_y)
                hw = 0.6 + 1.9 * t
                if y == vend:
                    hw -= 1  # rounded tip
                for x in range(int(math.floor(c0 + 0.5 - hw)), int(math.ceil(c0 + 0.5 + hw))):
                    veil[y, x] = True
        elif dirn in ('left', 'right'):
            back = -1 if dirn == 'right' else 1
            bx = int(hxs.min()) if back < 0 else int(hxs.max())
            vend = f.waist - 1
            for y in range(bun_y, vend + 1):
                t = (y - bun_y) / max(1, vend - bun_y)
                out = int(round(0.4 + 1.8 * t))
                if y == vend:
                    out = max(0, out - 1)
                for k in range(0, out + 1):
                    veil[y, bx + back * k] = True
        else:  # front: only thin edges peeking beside the neck and shoulders
            left, right = int(hxs.min()), int(hxs.max())
            for y in range(f.neck - 2, f.neck + 5):
                veil[y, left] = True
                veil[y, right] = True
                if y > f.neck + 1:
                    veil[y, left - 1] = True
                    veil[y, right + 1] = True

    def paint_veil():
        for y, x in zip(*np.nonzero(veil)):
            put(img, x, y, VEIL if (x * 3 + y) % 4 else VEIL_D)
        outline_shape(img, veil, VEIL_E)

    if dirn != 'up':
        paint_veil()

    over(img, f.body)
    over(img, f.eyes)

    # Shoes hidden under the gown; legs replaced by the skirt.
    shape, u = skirt_shape(f, dirn, sway, flare, kick)
    legs = mask(f.legs)
    img[legs & ~shape] = 0 if False else img[legs & ~shape]

    # Strapless bodice: torso mask from 2 rows below the shoulders to the waist.
    tm = mask(f.torso)
    tl = shade_levels(f.torso)
    bust = f.neck + 3
    for y, x in zip(*np.nonzero(tm)):
        if y < bust or y > f.waist:
            continue
        if tl[y, x] == -2:
            put(img, x, y, O)
            continue
        col = IV['hi'] if tl[y, x] == 2 else IV['base'] if tl[y, x] == 1 else IV['mid']
        put(img, x, y, col)
    # Sweetheart neckline: outline across the top with a centre dip.
    row = np.nonzero(tm[bust])[0]
    if len(row) and dirn != 'up':
        for x in range(row.min(), row.max() + 1):
            put(img, x, bust, IV['sh'])
        if dirn == 'down':
            c0 = int(math.floor(cx))
            put(img, c0, bust, img[bust - 1, c0, :3])
            put(img, c0 + 1, bust, img[bust - 1, c0 + 1, :3])
    elif len(row):
        for x in range(row.min(), row.max() + 1):
            put(img, x, bust, IV['mid'])

    # Skirt.
    # Clear leg pixels that the skirt replaces, then paint the skirt.
    for y, x in zip(*np.nonzero(legs)):
        if y > f.waist and not shape[y, x]:
            img[y, x] = 0
    # feet below the skirt are hidden too
    img[f.waist + 1:, :][~shape[f.waist + 1:, :]] = 0
    paint_skirt(img, f, dirn, shape, u)
    stamp_flowers(img, shape, u, f, dirn)

    # Re-draw bare arms over the skirt top (hands in front of the gown).
    body = f.body
    arms = mask(body) & ~tm
    arms[:bust, :] = False
    arms[f.waist + 3:, :] = False
    for y, x in zip(*np.nonzero(arms)):
        if shape[y, x] or y >= f.waist - 1:
            img[y, x] = body[y, x]

    # Champagne sash at the waist, flower on her left hip.
    srow = f.waist
    xs = [x for x in range(CELL) if shape[srow, x] or tm[srow, x]]
    if xs:
        for x in range(min(xs) + 1, max(xs)):
            put(img, x, srow, SASH)
        if dirn == 'down':
            fx = int(round(cx)) + 2
            put(img, fx, srow, BLUSH)
            put(img, fx + 1, srow, BLUSH_D)
            put(img, fx, srow + 1, LEAF)
        elif dirn == 'up':
            # bow at the back
            c0 = int(round(cx))
            for dx in (-2, -1, 1, 2):
                put(img, c0 + dx, srow, SASH_D if abs(dx) == 2 else SASH)
            put(img, c0, srow, SASH_D)
            put(img, c0 - 1, srow + 1, SASH)
            put(img, c0 + 1, srow + 1, SASH)
            put(img, c0 - 1, srow + 2, SASH_D)
            put(img, c0 + 1, srow + 2, SASH_D)

    if dirn == 'up':
        paint_veil()

    # Hair (dark updo) and a small ivory flower comb.
    over(img, hair_r)
    over(img, hair_f)
    if hm.any():
        hys, hxs = np.nonzero(hm)
        hy = int(hys.min())
        if dirn == 'down':
            put(img, int(hxs.max()) - 1, hy + 3, '#fbf6ec')
            put(img, int(hxs.max()) - 2, hy + 3, BLUSH)
        elif dirn == 'up':
            put(img, int(round(cx)) + 1, hy + 2, '#fbf6ec')
            put(img, int(round(cx)), hy + 2, BLUSH)
        else:
            back = -1 if dirn == 'right' else 1
            bx = int(hxs.min()) + 1 if back < 0 else int(hxs.max()) - 1
            put(img, bx, hy + 3, '#fbf6ec')
            put(img, bx - back, hy + 3, BLUSH)

    if bouquet:
        prefer = {'down': 'left', 'right': 'front_r', 'left': 'front_l'}.get(dirn, 'none')
        if pose == 'hold':
            prefer = 'front_r'  # the other hand holds his
        hp = hand_point(f, raised=(pose == 'raise'), prefer=prefer)
        if hp and dirn != 'up':
            hxp, hyp = hp
            if pose == 'raise':
                # held up beside the head, never over the face
                out = -3 if hxp < cx else 3
                stamp_bouquet(img, hxp + out, hyp - 2)
            else:
                stamp_bouquet(img, hxp, hyp)
    return img


# ---------------------------------------------------------------- reaching arm
SKIN = {'L': hx('#f6dcaf'), 'm': hx('#e4c19c'), 'd': hx('#c08b4c')}
SKIN_T = {'L': hx('#fff2ca'), 'm': hx('#f6dcaf'), 'd': hx('#e4c19c')}


def draw_arm(img, f, side, mode, sleeve=None, skin=SKIN):
    """Draw an arm reaching sideways from the shoulder (hand-holding poses)."""
    sgn = 1 if side == 'right' else -1
    sx = (f.waist_r + 1.0) if side == 'right' else (f.waist_l - 0.0)
    sy = f.neck + 2.0
    dx, dy = (5.2, 4.8) if mode == 'hold' else (3.4, 5.6)
    ex, ey = sx + sgn * dx, sy + dy
    shape = np.zeros((CELL, CELL), dtype=bool)
    tmap = np.zeros((CELL, CELL))
    vx, vy = ex - sx, ey - sy
    L2 = vx * vx + vy * vy
    for y in range(int(sy) - 2, int(ey) + 3):
        for x in range(int(min(sx, ex)) - 2, int(max(sx, ex)) + 3):
            px, py = x + 0.5, y + 0.5
            t = max(0.0, min(1.0, ((px - sx) * vx + (py - sy) * vy) / L2))
            qx, qy = sx + t * vx, sy + t * vy
            if (px - qx) ** 2 + (py - qy) ** 2 <= 1.45 ** 2:
                shape[y, x] = True
                tmap[y, x] = t
    slope = vy / vx
    for y, x in zip(*np.nonzero(shape)):
        t = tmap[y, x]
        upper = (y + 0.5) < (sy + (x + 0.5 - sx) * slope)
        if sleeve is not None and t < 0.74:
            col = sleeve[2] if upper else sleeve[1]
        elif sleeve is not None and t < 0.86:
            col = hx('#f3f0ea')  # shirt cuff
        else:
            col = skin['L'] if upper else skin['m']
        put(img, x, y, col)
    outline_shape(img, shape)
    # Open the shoulder joint into the torso so the arm looks attached.
    jx = int(sx) - (1 if side == 'right' else 0)
    for y in range(int(sy) - 1, int(sy) + 2):
        if img[y, jx, 3] and tuple(img[y, jx, :3]) == O:
            put(img, jx, y, sleeve[1] if sleeve is not None else skin['m'])
    # Hand: a soft 2x2 block with a knuckle shade.
    hxp = int(round(ex)) - (1 if side == 'right' else 0)
    hyp = int(round(ey)) - 1
    for j in range(2):
        for i in range(2):
            put(img, hxp + i, hyp + j, skin['m'] if j else skin['L'])
    put(img, hxp + (1 if side == 'right' else 0), hyp + 1, skin['d'])
    return img


# ---------------------------------------------------------------- frame plans
def shift_region(img, y0, y1, dy):
    """Move rows y0..y1 down by dy (rows above are cleared) — for breath/nod."""
    out = img.copy()
    band = img[y0:y1 + 1].copy()
    out[y0:y0 + dy] = 0
    m = band[:, :, 3] > 0
    tgt = out[y0 + dy:y1 + 1 + dy]
    tgt[m] = band[m]
    return out


def head_bottom(f):
    return f.neck


def build_minh():
    frames = {}
    for d, r in DIRS.items():
        def F(c, flip=False, rr=r):
            return Frame('bodyM', rr, c, flip)
        stand = F(1)
        frames[f'{d}-stand'] = paint_minh(stand, d, 'stand')
        frames[f'{d}-blink'] = paint_minh(F(3), d, 'blink')
        frames[f'{d}-walk0'] = paint_minh(F(0), d, 'walk')
        frames[f'{d}-walk1'] = frames[f'{d}-stand']
        frames[f'{d}-walk2'] = paint_minh(F(2), d, 'walk')
        frames[f'{d}-walk3'] = frames[f'{d}-stand']
        frames[f'{d}-breath'] = shift_region(frames[f'{d}-stand'], stand.top, stand.waist - 1, 1)
        frames[f'{d}-nod'] = shift_region(frames[f'{d}-stand'], stand.top, stand.neck, 1)
        # Special: offer his hand. Side views use the forward-reach pose.
        if d == 'down':
            frames[f'{d}-offer'] = paint_minh(F(9), d, 'offer')
        elif d == 'left':
            frames[f'{d}-offer'] = paint_minh(Frame('bodyM', 2, 9), d, 'offer')
        elif d == 'right':
            frames[f'{d}-offer'] = paint_minh(Frame('bodyM', 2, 9, flip=True), d, 'offer')
        else:
            frames[f'{d}-offer'] = paint_minh(F(9), d, 'offer')
        frames[f'{d}-wave'] = paint_minh(F(10), d, 'wave')
        # Hand-holding: his arm toward her (she stands on the viewer's right).
        if d in ('down', 'up'):
            for mode in ('reach', 'hold'):
                fr = Frame('bodyM', r, 1, drop_arm='right')
                img = paint_minh(fr, d, mode)
                frames[f'{d}-{mode}'] = draw_arm(img, fr, 'right', mode, sleeve=SUIT)
    return frames


def build_thuy():
    frames = {}
    for bq in (False, True):
        sfx = '-bq' if bq else ''
        for d, r in DIRS.items():
            def F(c, flip=False, rr=r):
                return Frame('bodyT', rr, c, flip)
            stand = F(1)
            P = lambda fr, pose='stand', **k: paint_thuy(fr, d, pose, bouquet=bq, **k)
            frames[f'{d}-stand{sfx}'] = P(stand)
            frames[f'{d}-blink{sfx}'] = P(F(3))
            # Walk: step / pass / step / pass, the skirt swings each way.
            frames[f'{d}-walk0{sfx}'] = P(F(0), 'walk', sway=1.2, kick=1)
            frames[f'{d}-walk1{sfx}'] = P(stand, 'walk', sway=0.4)
            frames[f'{d}-walk2{sfx}'] = P(F(2), 'walk', sway=-1.2, kick=-1)
            frames[f'{d}-walk3{sfx}'] = P(stand, 'walk', sway=-0.4)
            # Idle sway (skirt breathes left/right very slightly).
            frames[f'{d}-swayL{sfx}'] = P(stand, sway=-0.7)
            frames[f'{d}-swayR{sfx}'] = P(stand, sway=0.7)
            frames[f'{d}-breath{sfx}'] = shift_region(frames[f'{d}-stand{sfx}'], stand.top, stand.waist - 1, 1)
            frames[f'{d}-nod{sfx}'] = shift_region(frames[f'{d}-stand{sfx}'], stand.top, stand.neck, 1)
            # Twirl: flared skirt.
            frames[f'{d}-flare{sfx}'] = P(stand, flare=2.2)
            # Special: raise the bouquet / hand.
            frames[f'{d}-raise{sfx}'] = P(F(10), 'raise')
            # Hand-holding: her arm toward him (he stands on the viewer's left).
            if d in ('down', 'up'):
                for mode in ('reach', 'hold'):
                    fr = Frame('bodyT', r, 1, drop_arm='left')
                    img = paint_thuy(fr, d, 'hold', bouquet=bq)
                    frames[f'{d}-{mode}{sfx}'] = draw_arm(img, fr, 'left', mode, skin=SKIN_T)
    return frames


def write_atlas(name, frames):
    names = list(frames.keys())
    cols = 12
    rows = math.ceil(len(names) / cols)
    sheet = Image.new('RGBA', (cols * CELL, rows * CELL))
    data = {'frames': {}, 'meta': {'app': 'build-wedding-characters.py', 'image': f'{name}.png',
                                   'size': {'w': cols * CELL, 'h': rows * CELL}, 'scale': '1', 'format': 'RGBA8888'}}
    for i, n in enumerate(names):
        x, y = (i % cols) * CELL, (i // cols) * CELL
        sheet.paste(Image.fromarray(frames[n]), (x, y))
        data['frames'][n] = {'frame': {'x': x, 'y': y, 'w': CELL, 'h': CELL}, 'rotated': False, 'trimmed': False,
                             'spriteSourceSize': {'x': 0, 'y': 0, 'w': CELL, 'h': CELL},
                             'sourceSize': {'w': CELL, 'h': CELL}}
    os.makedirs(OUT, exist_ok=True)
    sheet.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    with open(os.path.join(OUT, f'{name}.json'), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, indent=1)
    print('wrote', name, len(names), 'frames', os.path.getsize(os.path.join(OUT, f'{name}.png')), 'bytes')
    return sheet


def preview(frames, keys, path, sc=7):
    w, h = 26, 36
    img = Image.new('RGBA', (len(keys[0]) * (w * sc + 6) + 6, len(keys) * (h * sc + 6) + 6), (52, 74, 50, 255))
    for r, row in enumerate(keys):
        for c, k in enumerate(row):
            if k not in frames:
                continue
            cellimg = Image.fromarray(frames[k]).crop((11, 9, 11 + w, 9 + h)).resize((w * sc, h * sc), Image.NEAREST)
            img.alpha_composite(cellimg, (6 + c * (w * sc + 6), 6 + r * (h * sc + 6)))
    img.save(path)


def main():
    m = build_minh()
    t = build_thuy()
    write_atlas('minh-groom', m)
    write_atlas('thuy-bride', t)
    if '--preview' in sys.argv:
        d = sys.argv[sys.argv.index('--preview') + 1]
        os.makedirs(d, exist_ok=True)
        cols = ['walk0', 'walk1', 'walk2', 'walk3', 'stand', 'offer', 'wave', 'reach', 'hold']
        preview(m, [[f'{dd}-{c}' for c in cols] for dd in DIRS], os.path.join(d, 'wed-minh.png'))
        cols = ['walk0', 'walk1', 'walk2', 'walk3', 'stand-bq', 'raise-bq', 'flare', 'reach-bq', 'hold-bq']
        preview(t, [[f'{dd}-{c}' for c in cols] for dd in DIRS], os.path.join(d, 'wed-thuy.png'))


if __name__ == '__main__':
    main()
