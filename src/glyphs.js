/**
 * Per-glyph structural data for a–z, A–Z and 0–9.
 *
 * This is the raw material the pair database is generated from. Two kinds of
 * knowledge live here:
 *
 * 1. *Known readings* — what a glyph actually reads as once it has been turned
 *    180° (`rot`) or mirrored (`mir`). `n` rotated reads as `u`; `M` rotated
 *    reads as `W`. These are facts, so they win outright.
 * 2. *Shape description* — the vertical band the glyph occupies, its width, and
 *    what each of its four edges looks like. Everything the known-reading lists
 *    don't cover is scored from these, so no combination falls through to a
 *    shrug.
 *
 * Edge tokens describe the terminal of the glyph on that side:
 *   stem  vertical stroke        bowl  closed round curve
 *   arch  closed round shoulder  cup   open round trough
 *   point converging diagonals   flat  horizontal bar
 *   open  open aperture (c/s/e)  hook  curved terminal
 *   cross diagonal crossing      dot   detached dot
 *
 * `in` is what sits between those edges, using the same tokens plus `none` for
 * a glyph with no interior (l, i, I) and `bar` for a crossbar (H, e, A). Edges
 * alone are not enough: n, u, m, w, H, N, U, V and Y all present a stem to the
 * left and a stem to the right, and it is the interior that tells them apart.
 *
 * `hand` records whether the glyph survives a mirror. `s` glyphs are drawn
 * symmetrically about a vertical axis (o, A, H, x); `h` glyphs are handed, and
 * mirroring one produces a shape that is not a letter — mirrored `Z` is `Ƨ`.
 * Rotation preserves handedness, which is why rotational ambigrams are the
 * easier kind, so the flag only bites in mirror mode.
 *
 * Bands are named by the space the glyph fills, in em above the baseline:
 *   x 0…0.50   asc 0…0.74   desc -0.22…0.50   full -0.22…0.74   cap 0…0.70
 *
 * Case is kept separate on purpose. Lowercase `a` is not mirror-symmetric but
 * uppercase `A` is; lowercase `l` rotates onto itself, uppercase `L` does not.
 * A table that folds case together gets both of those wrong.
 *
 * Columns: char band width top bottom left right in hand rot rotSoft mir mirSoft
 * `-` means "nothing here". `rot`/`mir` hold strong readings, the `Soft`
 * columns hold readings that need drawing work but are recognised tricks.
 */

const TABLE = `
a   x     .52  hook   stem   bowl   stem   bowl   h   -     e      -     -
b   asc   .55  stem   bowl   stem   bowl   bowl   h   q     -      d     -
c   x     .50  open   open   bowl   open   open   h   -     -      -     e
d   asc   .55  stem   bowl   bowl   stem   bowl   h   p     -      b     -
e   x     .50  bowl   open   bowl   open   bar    h   -     a      -     c
f   asc   .34  hook   stem   hook   flat   bar    h   -     t      -     -
g   desc  .55  bowl   hook   bowl   stem   bowl   h   -     be     -     -
h   asc   .52  stem   stem   stem   arch   arch   h   -     y      -     -
i   x     .26  dot    stem   stem   stem   none   s   -     i      i     -
j   desc  .30  dot    hook   hook   stem   none   h   -     r      -     -
k   asc   .52  stem   point  stem   point  diag   h   -     x      -     -
l   asc   .26  stem   stem   stem   stem   none   s   lI1   -      lI1   -
m   x     .84  arch   stem   stem   stem   arch   s   w     -      m     -
n   x     .52  arch   stem   stem   stem   arch   s   u     -      n     -
o   x     .55  bowl   bowl   bowl   bowl   bowl   s   oO0   -      oO0   -
p   desc  .55  bowl   stem   stem   bowl   bowl   h   d     b      q     -
q   desc  .55  bowl   stem   bowl   stem   bowl   h   b     d      p     -
r   x     .34  arch   stem   stem   arch   none   h   -     j      -     -
s   x     .48  open   open   open   open   open   h   sS    zZ     -     zZ
t   asc   .34  stem   hook   flat   flat   bar    h   -     f      t     -
u   x     .52  stem   cup    stem   stem   cup    s   n     -      u     -
v   x     .50  stem   point  stem   stem   point  s   -     A      v     -
w   x     .74  stem   point  stem   stem   point  s   mM    -      w     -
x   x     .50  cross  cross  cross  cross  cross  s   xX    -      xX    -
y   desc  .50  stem   point  stem   stem   point  h   h     -      y     -
z   x     .50  flat   flat   flat   flat   diag   h   zZ    sS     -     sS
A   cap   .66  point  stem   point  point  bar    s   V     v      A     -
B   cap   .62  bowl   bowl   stem   bowl   bar    h   -     8      -     -
C   cap   .64  open   open   bowl   open   open   h   -     -      -     -
D   cap   .66  bowl   bowl   stem   bowl   bowl   h   -     -      -     -
E   cap   .58  flat   flat   stem   open   bar    h   -     -      3     -
F   cap   .56  flat   stem   stem   open   bar    h   -     -      -     -
G   cap   .68  open   open   bowl   open   bar    h   -     -      -     -
H   cap   .68  stem   stem   stem   stem   bar    s   H     -      H     -
I   cap   .30  stem   stem   stem   stem   none   s   Il1   -      Il1   -
J   cap   .42  flat   hook   hook   stem   none   h   -     r      -     L
K   cap   .64  stem   point  stem   point  diag   h   -     -      -     -
L   cap   .56  stem   flat   stem   open   none   h   -     7      -     J
M   cap   .86  stem   stem   stem   stem   diag   s   W     w      M     -
N   cap   .70  stem   stem   stem   stem   diag   h   N     -      -     -
O   cap   .72  bowl   bowl   bowl   bowl   bowl   s   O0o   -      O0o   -
P   cap   .60  bowl   stem   stem   bowl   bowl   h   -     bd     -     -
Q   cap   .72  bowl   hook   bowl   hook   bowl   h   -     O      -     -
R   cap   .64  bowl   point  stem   point  diag   h   -     -      -     -
S   cap   .58  open   open   open   open   open   h   Ss    Zz     -     Zz
T   cap   .60  flat   stem   flat   flat   none   s   -     -      T     -
U   cap   .68  stem   cup    stem   stem   cup    s   -     nN     U     -
V   cap   .64  stem   point  stem   stem   point  s   A     a      V     -
W   cap   .92  stem   point  stem   stem   point  s   M     m      W     -
X   cap   .64  cross  cross  cross  cross  cross  s   Xx    -      Xx    -
Y   cap   .62  stem   point  stem   stem   point  s   -     h      Y     -
Z   cap   .60  flat   flat   flat   flat   diag   h   Zz    Ss     -     Ss
0   cap   .58  bowl   bowl   bowl   bowl   bowl   s   0oO   -      0oO   -
1   cap   .40  stem   stem   stem   stem   none   h   1lI   -      -     I
2   cap   .56  flat   open   open   flat   diag   h   -     5      -     -
3   cap   .55  bowl   bowl   open   bowl   open   h   -     E      E     -
4   cap   .58  point  flat   point  flat   diag   h   -     -      -     -
5   cap   .56  flat   open   flat   open   open   h   -     2      -     -
6   cap   .56  hook   bowl   bowl   hook   bowl   h   9     -      -     -
7   cap   .54  flat   stem   flat   point  diag   h   -     L      -     -
8   cap   .58  bowl   bowl   bowl   bowl   bar    s   8     B      8     -
9   cap   .56  bowl   hook   hook   bowl   bowl   h   6     -      -     -
`

/** Vertical extent of each band, in em relative to the baseline. */
export const BANDS = {
  x: [0, 0.5],
  asc: [0, 0.74],
  desc: [-0.22, 0.5],
  full: [-0.22, 0.74],
  cap: [0, 0.7],
}

/**
 * Where `dominant-baseline: central` puts y=0, in em above the baseline. The
 * renderer draws every glyph with that baseline, so this is the origin the
 * auto-fit offsets are measured from.
 */
export const CENTRAL = 0.25

const parse = (source) => {
  const glyphs = {}
  for (const line of source.trim().split('\n')) {
    const [char, band, width, top, bot, left, right, inside, hand, rot, rotSoft, mir, mirSoft] =
      line.trim().split(/\s+/)
    const [bottom, ceiling] = BANDS[band]
    glyphs[char] = {
      char,
      band,
      width: Number(width),
      bottom,
      top: ceiling,
      height: ceiling - bottom,
      /** Ink centre relative to the drawing origin, in em (positive is up). */
      centre: (ceiling + bottom) / 2 - CENTRAL,
      edges: { top, bottom: bot, left, right },
      inside,
      handed: hand === 'h',
      rot: rot === '-' ? '' : rot,
      rotSoft: rotSoft === '-' ? '' : rotSoft,
      mir: mir === '-' ? '' : mir,
      mirSoft: mirSoft === '-' ? '' : mirSoft,
    }
  }
  return glyphs
}

export const GLYPHS = parse(TABLE)

/** Every character the database covers, in table order. */
export const ALPHABET = Object.keys(GLYPHS)

/** Stand-in for anything outside the table (punctuation, spaces, emoji). */
const UNKNOWN = {
  char: '?',
  band: 'x',
  width: 0.52,
  bottom: 0,
  top: 0.5,
  height: 0.5,
  centre: 0,
  edges: { top: 'stem', bottom: 'stem', left: 'stem', right: 'stem' },
  inside: 'none',
  handed: true,
  rot: '',
  rotSoft: '',
  mir: '',
  mirSoft: '',
}

export const glyphOf = (char) => GLYPHS[char] ?? UNKNOWN
export const isKnown = (char) => char in GLYPHS
