/**
 * The pair database.
 *
 * Every ordered combination of the 62 characters in glyphs.js is scored for
 * both symmetries — 62 × 62 × 2 = 7,688 entries — and held in memory. Scoring
 * is arithmetic over the glyph table, so the whole thing builds in a few
 * milliseconds at import time and needs no network, no assets and no font
 * metrics.
 *
 * Each entry answers three questions:
 *   - how well do these two letters read as one shape? (`score`, `tier`)
 *   - where do the two halves have to sit for that to happen? (`autoFit`)
 *   - and if the answer is "badly", what should be drawn instead? (`suggestFixes`)
 */

import { ALPHABET, CENTRAL, glyphOf, isKnown } from './glyphs.js'

/* ------------------------------------------------------------- affinities --- */

/**
 * How readily one edge shape can be drawn as another. Symmetric; anything not
 * listed falls back to DEFAULT_AFFINITY, and an edge matched against itself
 * falls back to SELF_AFFINITY.
 */
const AFFINITY = {
  'stem|stem': 1,
  'bowl|bowl': 1,
  'cross|cross': 1,
  'none|none': 1,
  'flat|flat': 0.9,
  'bar|bar': 0.9,
  'arch|arch': 0.85,
  'cup|cup': 0.85,
  'diag|diag': 0.85,
  'open|open': 0.85,
  'point|point': 0.8,
  'dot|dot': 0.8,
  'hook|hook': 0.7,
  // ∩ and ∪ are different shapes. They only become interchangeable once one of
  // them has been turned over, which ROTATED handles.
  'arch|cup': 0.4,
  'bowl|arch': 0.6,
  'bowl|cup': 0.6,
  'bowl|open': 0.6,
  'stem|flat': 0.55,
  'open|hook': 0.55,
  'stem|arch': 0.5,
  'stem|cup': 0.5,
  'open|flat': 0.5,
  'point|cross': 0.5,
  'bowl|hook': 0.45,
  'stem|hook': 0.45,
  'open|arch': 0.45,
  'open|cup': 0.45,
  'hook|arch': 0.45,
  'hook|cup': 0.45,
  'stem|point': 0.4,
  'stem|cross': 0.4,
  'point|hook': 0.4,
  'bowl|flat': 0.35,
  'stem|bowl': 0.35,
  'stem|dot': 0.35,
  'point|flat': 0.35,
  'flat|hook': 0.35,
  'flat|arch': 0.35,
  'flat|cup': 0.35,
  'cross|flat': 0.35,
  'diag|point': 0.6,
  'diag|cross': 0.6,
  'none|dot': 0.5,
  'bar|open': 0.45,
  'bar|none': 0.4,
  'bar|bowl': 0.4,
  'bar|diag': 0.4,
  'bar|point': 0.4,
  'bar|flat': 0.5,
  'bar|stem': 0.45,
  'bar|arch': 0.35,
  'bar|cup': 0.35,
  'bar|hook': 0.3,
  'diag|none': 0.35,
  'diag|arch': 0.35,
  'diag|cup': 0.35,
  'diag|open': 0.35,
  'diag|flat': 0.4,
  'diag|stem': 0.4,
  'diag|bowl': 0.3,
  'diag|hook': 0.3,
  'none|arch': 0.35,
  'none|cup': 0.35,
  'none|point': 0.35,
  'none|stem': 0.6,
  'none|flat': 0.35,
  'none|bowl': 0.3,
  'none|open': 0.3,
  'none|cross': 0.3,
  'none|hook': 0.3,
}

/**
 * What a feature turns into once the glyph has been turned 180°. Only the
 * arch/cup pair actually changes identity — a stem is still a stem upside
 * down — but that one swap is what makes `n` and `u` the same drawing.
 */
const ROTATED = { arch: 'cup', cup: 'arch' }
const rotated = (token) => ROTATED[token] ?? token

/**
 * Penalty for mirroring a handed glyph. Mirrored `s` is not an `s`, so when the
 * table records no reading and either side is handed, the shape model's opinion
 * is discounted hard. Rotation needs no equivalent — turning a page keeps
 * handedness intact, which is why most ambigrams are rotational.
 */
const HANDED_PENALTY = 0.6

/**
 * Penalty for a letter paired with itself and no recorded reading.
 *
 * Compared against itself a glyph agrees on every feature, so the shape model
 * always likes it — but a letter only flips onto itself if it is genuinely
 * symmetric, and every letter that is says so in the `rot`/`mir` columns.
 * Rotated `C` is `Ɔ`, rotated `D` is `ᗡ`, rotated `M` is `W`.
 */
const SELF_PENALTY = 0.62

/** The few inferences the shape vocabulary is too coarse to get right. */
const FALSE_FRIENDS = {
  // Both are diagonal-interior capitals, but M turns into W and N into N.
  'rotate:MN': 0.4,
  'rotate:MH': 0.4,
}

const DEFAULT_AFFINITY = 0.3
const SELF_AFFINITY = 0.8

function affinity(a, b) {
  const hit = AFFINITY[`${a}|${b}`] ?? AFFINITY[`${b}|${a}`]
  if (hit !== undefined) return hit
  return a === b ? SELF_AFFINITY : DEFAULT_AFFINITY
}

/* ----------------------------------------------------------------- scoring --- */

const STRONG = 1
const SOFT = 0.78
/** Ceiling on inferred scores, so a known reading always outranks a guess. */
const INFERRED_CAP = 0.72

const ratio = (a, b) => (a && b ? Math.min(a, b) / Math.max(a, b) : 0)

/** Does the table record that these two actually read as each other? */
function known(a, b, mode) {
  const ga = glyphOf(a)
  const gb = glyphOf(b)
  const [strongA, softA] = mode === 'mirror' ? [ga.mir, ga.mirSoft] : [ga.rot, ga.rotSoft]
  const [strongB, softB] = mode === 'mirror' ? [gb.mir, gb.mirSoft] : [gb.rot, gb.rotSoft]

  if (strongA.includes(b) || strongB.includes(a)) return STRONG
  if (softA.includes(b) || softB.includes(a)) return SOFT
  return 0
}

/**
 * Score from shape alone.
 *
 * Under a 180° turn the top of one glyph has to serve as the bottom of the
 * other, so the edges are compared crosswise. Under a mirror it is left
 * against right instead. Height and width similarity are folded in because two
 * glyphs of wildly different mass never merge cleanly however well the
 * terminals agree.
 */
function structural(ga, gb, mode) {
  const ea = ga.edges
  const eb = gb.edges
  const mirrored = mode === 'mirror'

  // Under a 180° turn the flipped glyph's bottom edge arrives at the top, and
  // arrives upside down — so it is compared against the upright glyph's top
  // edge after being rotated itself. A mirror swaps left for right and leaves
  // every feature the right way up.
  const edges = mirrored
    ? (affinity(ea.left, eb.right) + affinity(ea.right, eb.left)) / 2
    : (affinity(ea.top, rotated(eb.bottom)) + affinity(ea.bottom, rotated(eb.top))) / 2

  const inside = affinity(ga.inside, mirrored ? gb.inside : rotated(gb.inside))

  // A mirrored glyph stays in its own band, so sitting in different bands is a
  // real cost. A rotated glyph swaps ascender for descender, so only the amount
  // of vertical space matters.
  let height = ratio(ga.height, gb.height)
  if (mirrored && ga.band !== gb.band) height *= 0.85

  const width = ratio(ga.width, gb.width)

  // Scaled rather than clipped, so the whole inferred range stays orderable
  // instead of piling up against the ceiling.
  let raw = (0.44 * edges + 0.22 * inside + 0.2 * height + 0.14 * width) * INFERRED_CAP
  if (mirrored && (ga.handed || gb.handed)) raw *= HANDED_PENALTY
  if (ga.char === gb.char) raw *= SELF_PENALTY
  return raw
}

function computeScore(a, b, mode) {
  const hit = known(a, b, mode)
  if (hit) return hit

  const penalty = FALSE_FRIENDS[`${mode}:${a}${b}`] ?? FALSE_FRIENDS[`${mode}:${b}${a}`]
  return penalty ?? structural(glyphOf(a), glyphOf(b), mode)
}

/* ------------------------------------------------------------------ table --- */

const key = (a, b, mode) => `${mode}:${a}${b}`

/** char-pair → score, for every combination of both cases and the digits. */
export const PAIR_TABLE = new Map()

for (const mode of ['rotate', 'mirror']) {
  for (const a of ALPHABET) {
    for (const b of ALPHABET) {
      PAIR_TABLE.set(key(a, b, mode), computeScore(a, b, mode))
    }
  }
}

/** Score for two single characters, using the table when it covers them. */
function scoreChars(a, b, mode) {
  const cached = PAIR_TABLE.get(key(a, b, mode))
  return cached !== undefined ? cached : computeScore(a, b, mode)
}

/* ------------------------------------------------------------ multi-glyph --- */

/**
 * A letter group standing in for a single letter — `rn` for `m` is the classic.
 * The group is judged on the outline it presents: the tallest glyph supplies
 * the edges, the widths add up. It is an approximation, so composites carry a
 * small penalty and never score as a clean single-glyph match.
 */
const COMPOSITE_PENALTY = 0.9

function collapse(text) {
  const glyphs = [...text].map(glyphOf)
  if (glyphs.length === 1) return glyphs[0]

  const tallest = glyphs.reduce((best, g) => (g.height > best.height ? g : best))
  const bottom = Math.min(...glyphs.map((g) => g.bottom))
  const top = Math.max(...glyphs.map((g) => g.top))

  return {
    ...tallest,
    char: text,
    bottom,
    top,
    height: top - bottom,
    centre: (top + bottom) / 2 - CENTRAL,
    width: glyphs.reduce((sum, g) => sum + g.width, 0),
    handed: glyphs.some((g) => g.handed),
    edges: {
      top: tallest.edges.top,
      bottom: tallest.edges.bottom,
      left: glyphs[0].edges.left,
      right: glyphs[glyphs.length - 1].edges.right,
    },
    rot: '',
    rotSoft: '',
    mir: '',
    mirSoft: '',
  }
}

/**
 * Score any two sides, single letters or groups.
 * @param {string} a upright side
 * @param {string} b side that gets flipped
 * @param {'rotate'|'mirror'} mode
 * @returns {number} 0–1
 */
export function scorePair(a, b, mode) {
  const left = (a ?? '').trim()
  const right = (b ?? '').trim()
  if (!left || !right) return 0

  if (left.length === 1 && right.length === 1) return scoreChars(left, right, mode)

  // Groups are compared through the same shape model, on their merged outline.
  return structural(collapse(left), collapse(right), mode) * COMPOSITE_PENALTY
}

/* ------------------------------------------------------------------ tiers --- */

const TIERS = [
  { at: 0.85, tier: 'natural', label: 'Natural', hint: 'Naturally symmetric — this one draws itself.' },
  { at: 0.6, tier: 'workable', label: 'Workable', hint: 'Close. Nudge the size or position of one half until they share a spine.' },
  { at: 0.4, tier: 'stretch', label: 'Needs work', hint: 'The two halves fight a little — stretch one, or add a flourish that reads as ink in both directions.' },
  { at: 0, tier: 'hard', label: 'Hard', hint: 'These do not want to be the same shape. Try a swap below, or a two-letter group.' },
]

export function tierFor(score) {
  return TIERS.find((t) => score >= t.at) ?? TIERS[TIERS.length - 1]
}

/* --------------------------------------------------------------- auto-fit --- */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const round = (value, places = 2) => Number(value.toFixed(places))

/**
 * Where the flipped half has to sit to line up with the upright one.
 *
 * The renderer draws the flipped glyph inside the symmetry transform, so a
 * tweak of `dy` in the glyph's own space lands at `-dy` under a 180° turn and
 * at `+dy` under a mirror. Solving for "both ink centres coincide" gives the
 * offsets below. Scale is applied before the translation in the SVG transform
 * list, so the height correction is folded into the centre before the shift is
 * worked out.
 *
 * @returns {{dxB:number, dyB:number, rotB:number, sxB:number, syB:number}}
 */
export function autoFit(a, b, mode) {
  const left = (a ?? '').trim()
  const right = (b ?? '').trim()
  const idle = { dxB: 0, dyB: 0, rotB: 0, sxB: 1, syB: 1 }
  if (!left || !right) return idle

  const ga = collapse(left)
  const gb = collapse(right)

  // Only correct proportions that are actually off — small differences are what
  // gives a hand-drawn ambigram its life. Width is corrected halfway (the square
  // root of the ratio): pulling a narrow `l` out to the width of an `o` destroys
  // the `l`, and meeting in the middle reads better than either extreme.
  const widthRatio = gb.width ? ga.width / gb.width : 1
  const sxB =
    widthRatio > 1.14 || widthRatio < 0.88 ? round(clamp(Math.sqrt(widthRatio), 0.6, 1.6)) : 1

  const heightRatio = gb.height ? ga.height / gb.height : 1
  const syB = heightRatio > 1.25 || heightRatio < 0.8 ? round(clamp(heightRatio, 0.6, 1.6)) : 1

  const centreB = gb.centre * syB
  const shift = mode === 'mirror' ? centreB - ga.centre : centreB + ga.centre

  return { ...idle, dyB: clamp(Math.round(shift * 100), -60, 60), sxB, syB }
}

/* ------------------------------------------------------------ suggestions --- */

/**
 * Two-letter groups that habitually stand in for a single letter. These are the
 * moves ambigram designers make when a pair refuses to resolve.
 */
const COMPOSITES = {
  m: ['rn'],
  w: ['vv'],
  d: ['cl', 'ol'],
  b: ['lo'],
  h: ['ln', 'lr'],
  u: ['ll'],
  n: ['ri'],
  a: ['ci', 'oi'],
  g: ['cj', 'oj'],
  q: ['oj'],
  y: ['ij'],
  k: ['lc'],
  M: ['NI'],
  W: ['VV'],
  N: ['IV'],
  D: ['IO'],
  U: ['LI'],
  H: ['II'],
}

const other = (char) =>
  char >= 'a' && char <= 'z'
    ? char.toUpperCase()
    : char >= 'A' && char <= 'Z'
      ? char.toLowerCase()
      : null

/**
 * Better spellings for a pair that does not resolve.
 *
 * Tries the same letters in the other case and the standard composite
 * substitutions, and returns whichever variants beat what is there now.
 *
 * @returns {Array<{a:string, b:string, score:number, note:string}>}
 */
export function suggestFixes(a, b, mode, limit = 3) {
  const left = (a ?? '').trim()
  const right = (b ?? '').trim()
  if (!left || !right) return []

  const current = scorePair(left, right, mode)
  const candidates = []
  const add = (nextA, nextB, note) => {
    if (nextA === left && nextB === right) return
    candidates.push({ a: nextA, b: nextB, score: scorePair(nextA, nextB, mode), note })
  }

  const altA = left.length === 1 ? other(left) : null
  const altB = right.length === 1 ? other(right) : null
  if (altA) add(altA, right, `${altA} in place of ${left}`)
  if (altB) add(left, altB, `${altB} in place of ${right}`)
  if (altA && altB) add(altA, altB, 'both sides in the other case')

  for (const group of COMPOSITES[left] ?? []) add(group, right, `${group} in place of ${left}`)
  for (const group of COMPOSITES[right] ?? []) add(left, group, `${group} in place of ${right}`)

  const seen = new Set()
  return candidates
    .filter((c) => c.score >= current + 0.05)
    .sort((x, y) => y.score - x.score)
    .filter((c) => {
      const id = `${c.a}|${c.b}`
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .slice(0, limit)
}

/**
 * What a single character turns into under the symmetry — the recorded reading
 * if there is one, otherwise its strongest partner. Always available, and it is
 * the most useful thing to know about a pair that refuses to resolve: it says
 * which two shapes the drawing has to sit between.
 */
export function becomes(char, mode) {
  const g = glyphOf(char)
  const strong = mode === 'mirror' ? g.mir : g.rot
  if (strong) return strong[0]

  const soft = mode === 'mirror' ? g.mirSoft : g.rotSoft
  if (soft) return soft[0]

  const [best] = bestPartners(char, mode, 1)
  return best?.char ?? null
}

/** The characters a given one flips onto most convincingly. */
export function bestPartners(char, mode, limit = 6) {
  if (!isKnown(char)) return []
  return ALPHABET.map((other) => ({ char: other, score: scoreChars(char, other, mode) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
}

/* ----------------------------------------------------------------- lookup --- */

/**
 * Everything the database knows about one pair.
 * @returns {{score:number, tier:string, label:string, hint:string, fit:object, fixes:Array}}
 */
export function lookupPair(a, b, mode) {
  const left = (a ?? '').trim()
  const right = (b ?? '').trim()
  const score = scorePair(left, right, mode)
  const { tier, label, hint } = tierFor(score)

  return {
    score,
    tier,
    label,
    hint,
    fit: autoFit(left, right, mode),
    fixes: score >= 0.85 ? [] : suggestFixes(left, right, mode),
    // Only meaningful for single letters — a group has no reading of its own.
    becomes: {
      a: left.length === 1 ? becomes(left, mode) : null,
      b: right.length === 1 ? becomes(right, mode) : null,
    },
  }
}

/**
 * Rows in the table whose two directions disagree — a bookkeeping slip in the
 * glyph data rather than a runtime concern. Exported so it can be checked
 * without shipping a test runner.
 */
export function findAsymmetries() {
  const bad = []
  for (const mode of ['rotate', 'mirror']) {
    for (const a of ALPHABET) {
      for (const b of ALPHABET) {
        const forward = PAIR_TABLE.get(key(a, b, mode))
        const back = PAIR_TABLE.get(key(b, a, mode))
        if (Math.abs(forward - back) > 1e-9) bad.push({ mode, a, b, forward, back })
      }
    }
  }
  return bad
}
