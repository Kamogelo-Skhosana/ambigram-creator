/**
 * Word-level readability, on top of the pair database.
 *
 * The per-pair judgement lives in pairdb.js — this file only aggregates it into
 * the score shown for the whole word.
 */

import { scorePair } from './pairdb.js'

export { lookupPair, scorePair, autoFit, suggestFixes, bestPartners, becomes, tierFor } from './pairdb.js'

/** Overall readability, 0 – 100. */
export function wordScore(pairs, mode) {
  if (!pairs.length) return 0
  const total = pairs.reduce((sum, p) => sum + scorePair(p.a, p.b, mode), 0)
  return Math.round((total / pairs.length) * 100)
}

export function scoreVerdict(score) {
  if (score >= 85) return { label: 'Very readable', tone: 'ok' }
  if (score >= 60) return { label: 'Readable with tweaking', tone: 'ok' }
  if (score >= 40) return { label: 'Needs design work', tone: 'warn' }
  return { label: 'Hard word — expect heavy stylising', tone: 'error' }
}
