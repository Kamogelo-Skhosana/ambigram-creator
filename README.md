# Ambigram Creator

Design ambigrams — words that still read as words when you turn the page upside
down (rotational) or hold them up to a mirror.

## Run

```bash
npm install
npm run dev
```

Opens on http://localhost:5174

## How it works

An ambigram is built from *letter pairs*. If a word has 8 letters, letter 1 has to
double as letter 8 flipped, letter 2 as letter 7, and so on. This app lays the word
out one cell per pair, draws the upright letter and the flipped letter on top of each
other, and lets you push each half around until a single shape reads both ways.

## The pair database

Every combination of the 62 characters `a–z`, `A–Z` and `0–9` is scored for both
symmetries — 7,688 entries, held in memory and rebuilt at import time from the glyph
table in [src/glyphs.js](src/glyphs.js). Nothing is fetched and nothing is hard-coded
pair by pair.

Case is kept separate throughout, which matters more than it sounds: lowercase `a` is
not mirror-symmetric but `A` is, lowercase `l` rotates onto itself but `L` does not,
and `U/N` is a mediocre rotational pair where `u/n` is a perfect one. A table that
folds case together gets all three wrong.

Each entry is worked out in two steps:

- **Known readings.** The glyph table records what each character actually reads as
  once turned or mirrored — `n` becomes `u`, `M` becomes `W`, `E` mirrors to `3`.
  These are facts, so they win outright.
- **Shape inference.** Everything else is scored from the glyph's silhouette: the four
  edge terminals, the interior, the vertical band it fills and its width. Under a 180°
  turn the top of one letter has to serve as the bottom of the other, so the edges are
  compared crosswise and flipped as they go; under a mirror it is left against right.
  Nothing falls through to a shrug.

Two corrections keep the inference honest. A letter compared with *itself* agrees on
every feature, so it is discounted unless the table says it is genuinely symmetric —
rotated `D` is `ᗡ`, not `D`. And mirroring a *handed* glyph produces a shape that is
not a letter at all, so handed glyphs are discounted in mirror mode. Rotation keeps
handedness intact, which is exactly why rotational ambigrams are the easier kind.

What the app does with it:

- **Auto-fit** seats the flipped half automatically — the vertical offset, width and
  height that make the two ink centres coincide, derived from the same glyph metrics.
  Nudging any slider marks that pair as yours and auto-fit leaves it alone.
- **Suggested swaps** appear on pairs that do not resolve: the same letters in the
  other case, or a two-letter group standing in for one letter (`rn` for `m`, `cl` for
  `d`). Click one to apply it. Typing `SUNS` will offer you `u/n` in place of `U/N`.
- **Reading cues** say what each half turns into on its own, which is the most useful
  thing to know about a pair you have to draw by hand.

- **Reads as / Reads as, flipped** — one word for a symmetric ambigram, two different
  words for a "chain" ambigram (e.g. `hope` / `love`).
- **Symmetry** — 180° rotation, or horizontal mirror.
- **Style** — *Blend* fades the flipped reading so you can see both, *Guide* colours the
  two readings differently for tracing, *Solid* shows the flattened result.
- **Letter pairs** — every pair gets a card with a readability rating, suggested swaps
  and per-half controls for position, rotation and width/height. Type directly into a
  card to use a different letter or a two-letter group.
- **Score** — readability from the pair database, described below.
- **Export** — SVG (vector, editable in Illustrator/Inkscape) or PNG at 1×/2×/4×.

## Notes

- SVG export uses live text, so the font must exist on whichever machine opens it.
  Convert text to outlines in a vector editor, or export PNG, before sharing.
- The generated shape is a *starting point*. Real ambigrams are finished by hand —
  export the SVG and redraw the strokes so the two readings share one skeleton.

## Theming

The interface runs on a single [themeloom](https://github.com/Kamogelo-Skhosana/themeloom)
theme — **Y2K Chrome** (`retro-y2k`). A themeloom theme is a whole design
contract, not a palette: colour, type, shape and motion arrive together, which is
why the app has pill controls, a wide geometric masthead and a bouncy easing
curve rather than just a different accent colour.

The integration is one mapping block at the top of
[src/style.css](src/style.css), where the app's own variables are pointed at the
`--pt-*` custom properties the engine writes. Nothing further down that file
names a colour, a font or a radius, so switching theme is a one-line change in
[src/theme.js](src/theme.js):

```js
import { arcade8bit } from '@themeloom/themes-classic'
export const theme = arcade8bit
```

`data-theme` is set on `<html>` in [index.html](index.html) so the correct theme
is on the element before any CSS is parsed — update that too when you switch, or
the first paint uses the fallbacks in `style.css` until the engine starts.

The ink and backdrop colours the ambigram itself is drawn in default to the
theme's text and card colours, and stay editable — picking your own ink is the
point of the app.

> **Local dependency.** `@themeloom/core` and `@themeloom/themes-classic` are
> installed with `file:../themeloom/...`, so a fresh clone of this repo alone
> will not install. Either clone `themeloom` as a sibling directory and run
> `npm run build` in it first, or swap both entries in `package.json` for
> published versions once the packages are on npm.

## Stack

Vite + vanilla JS, SVG rendering. One runtime dependency: the themeloom engine
(~5 kB) and its theme pack.
# ambigram-creator
