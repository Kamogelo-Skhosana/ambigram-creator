import './style.css'
import '@themeloom/themes-classic/flourishes.css'
import { artworkDefaults } from './theme.js'
import { mountAds } from './ads.js'
import { buildSvg, svgToString, svgToPngBlob } from './render.js'
import { autoFit, lookupPair, wordScore, scoreVerdict } from './pairs.js'

const $ = (sel) => document.querySelector(sel)

const escape = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)

const stage = $('#stage')
const pairsEl = $('#pairs')
const scoreEl = $('#score')

const state = {
  wordA: 'ambigram',
  wordB: 'ambigram',
  mode: 'rotate',
  renderMode: 'blend',
  font: "Georgia, 'Times New Roman', serif",
  weight: 700,
  cell: 100,
  stroke: 0,
  ink: artworkDefaults.ink,
  paper: artworkDefaults.paper,
  opacity: 55,
  showAxis: true,
  transparent: false,
  autoFit: true,
  pairs: [],
}

const emptyTweaks = () => ({
  dxA: 0, dyA: 0, rotA: 0, sxA: 1, syA: 1, hideA: false,
  dxB: 0, dyB: 0, rotB: 0, sxB: 1, syB: 1, hideB: false,
  touched: false,
})

const letters = (word) => [...word.trim()].filter((ch) => ch !== ' ')

/**
 * Seat the flipped half where the database says it belongs. Any manual tweaks
 * on the pair are dropped — a fit is only ever applied when the letters or the
 * symmetry changed, at which point those tweaks described a different shape.
 */
function fitPair(pair) {
  Object.assign(pair, emptyTweaks())
  if (state.autoFit) Object.assign(pair, autoFit(pair.a, pair.b, state.mode))
}

/** Re-seat every pair. Untouched ones only, unless forced. */
function refitAll({ force = false } = {}) {
  for (const pair of state.pairs) if (force || !pair.touched) fitPair(pair)
}

/** Pair letter i of the first word with letter n-1-i of the second. */
function buildPairs() {
  const a = letters(state.wordA)
  const b = letters(state.wordB)
  const length = Math.max(a.length, b.length, 1)
  const previous = state.pairs

  state.pairs = Array.from({ length }, (_, i) => {
    const before = previous[i]
    const pair = { ...emptyTweaks(), ...(before ?? {}), a: a[i] ?? '', b: b[length - 1 - i] ?? '' }
    if (!before || before.a !== pair.a || before.b !== pair.b) fitPair(pair)
    return pair
  })
}

/* -------------------------------------------------------------- drawing --- */

function draw() {
  const svg = buildSvg(state)
  stage.replaceChildren(svg)
  stage.style.setProperty('--paper', state.paper)
  stage.dataset.mode = state.mode
  drawScore()
}

function drawScore() {
  const score = wordScore(state.pairs.filter((p) => p.a && p.b), state.mode)
  const verdict = scoreVerdict(score)
  scoreEl.dataset.tone = verdict.tone
  scoreEl.innerHTML = `
    <div class="score__bar"><i style="width:${score}%"></i></div>
    <div class="score__text"><b>${score}/100</b> — ${verdict.label}</div>
  `
}

/* ---------------------------------------------------------- pair editor --- */

const SLIDERS = [
  { key: 'dx', label: 'X', min: -60, max: 60, step: 1, suffix: '' },
  { key: 'dy', label: 'Y', min: -60, max: 60, step: 1, suffix: '' },
  { key: 'rot', label: 'Rotate', min: -180, max: 180, step: 1, suffix: '°' },
  { key: 'sx', label: 'Width', min: 0.4, max: 2, step: 0.02, suffix: '×' },
  { key: 'sy', label: 'Height', min: 0.4, max: 2, step: 0.02, suffix: '×' },
]

function sideControls(pair, index, side) {
  const rows = SLIDERS.map(({ key, label, min, max, step, suffix }) => {
    const name = `${key}${side}`
    const value = pair[name]
    return `
      <label class="tweak">
        <span>${label}<em>${suffix === '×' ? value.toFixed(2) : value}${suffix}</em></span>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${value}"
               data-index="${index}" data-key="${name}" />
      </label>`
  }).join('')

  return `
    <div class="side">
      <div class="side__head">
        <b>${side === 'A' ? 'Upright' : 'Flipped'}</b>
        <label class="mini-check">
          <input type="checkbox" data-index="${index}" data-key="hide${side}" ${pair[`hide${side}`] ? 'checked' : ''} />
          hide
        </label>
      </div>
      ${rows}
    </div>`
}

/** Everything on a card except the two letter inputs, which keep their focus. */
function cardBody(pair, index) {
  const { hint, becomes, fixes } = lookupPair(pair.a, pair.b, state.mode)
  const verb = state.mode === 'mirror' ? 'mirrors to' : 'turns into'

  const readings = [
    becomes.a && becomes.a !== pair.a ? `${pair.a} ${verb} ${becomes.a}` : null,
    becomes.b && becomes.b !== pair.b ? `${pair.b} ${verb} ${becomes.b}` : null,
  ].filter(Boolean)

  const chips = fixes
    .map(
      (fix) => `
      <button class="chip" type="button" title="${escape(fix.note)}"
              data-index="${index}" data-fix-a="${escape(fix.a)}" data-fix-b="${escape(fix.b)}">
        ${escape(fix.a)}<span>${state.mode === 'mirror' ? '⇄' : '⇵'}</span>${escape(fix.b)}
      </button>`,
    )
    .join('')

  return `
    <p class="pair__hint">${hint}</p>
    ${readings.length ? `<p class="pair__becomes">${escape(readings.join(' · '))}</p>` : ''}
    ${chips ? `<div class="pair__fixes"><span>Try</span>${chips}</div>` : ''}
    <details class="pair__tweaks">
      <summary>Adjust</summary>
      <div class="sides">
        ${sideControls(pair, index, 'A')}
        ${sideControls(pair, index, 'B')}
      </div>
    </details>`
}

function renderPairs() {
  pairsEl.innerHTML = state.pairs.map((pair, index) => {
    const { tier } = lookupPair(pair.a, pair.b, state.mode)
    return `
      <article class="pair pair--${tier}" data-card="${index}">
        <header class="pair__head">
          <span class="pair__index">${index + 1}</span>
          <input class="pair__letter" value="${escape(pair.a)}" data-index="${index}" data-key="a" maxlength="3" aria-label="Upright letters" />
          <span class="pair__swap">${state.mode === 'mirror' ? '⇄' : '⇵'}</span>
          <input class="pair__letter" value="${escape(pair.b)}" data-index="${index}" data-key="b" maxlength="3" aria-label="Flipped letters" />
        </header>
        <div class="pair__body">${cardBody(pair, index)}</div>
      </article>`
  }).join('')
}

/** Refresh one card in place, so an input being typed into keeps focus. */
function refreshCard(index) {
  const pair = state.pairs[index]
  const card = pairsEl.querySelector(`[data-card="${index}"]`)
  if (!card) return
  card.className = `pair pair--${lookupPair(pair.a, pair.b, state.mode).tier}`
  card.querySelector('.pair__body').innerHTML = cardBody(pair, index)
}

pairsEl.addEventListener('input', (event) => {
  const target = event.target
  const index = Number(target.dataset.index)
  const key = target.dataset.key
  if (Number.isNaN(index) || !key) return

  const pair = state.pairs[index]
  if (target.type === 'checkbox') {
    pair[key] = target.checked
    pair.touched = true
  } else if (target.type === 'range') {
    pair[key] = Number(target.value)
    pair.touched = true
    const label = target.previousElementSibling?.querySelector('em')
    if (label) {
      const suffix = key.startsWith('rot') ? '°' : key.startsWith('s') ? '×' : ''
      label.textContent = suffix === '×' ? `${pair[key].toFixed(2)}×` : `${pair[key]}${suffix}`
    }
  } else {
    // A different letter is a different shape, so the fit is worked out again.
    pair[key] = target.value
    fitPair(pair)
    refreshCard(index)
  }
  draw()
})

// Applying a suggested swap rewrites that side of the pair and re-fits it.
pairsEl.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip')
  if (!chip) return

  const index = Number(chip.dataset.index)
  const pair = state.pairs[index]
  pair.a = chip.dataset.fixA
  pair.b = chip.dataset.fixB
  fitPair(pair)

  const card = pairsEl.querySelector(`[data-card="${index}"]`)
  const [inputA, inputB] = card.querySelectorAll('.pair__letter')
  inputA.value = pair.a
  inputB.value = pair.b
  refreshCard(index)
  draw()
})

/* -------------------------------------------------------------- controls --- */

const bind = (id, key, transform = (v) => v, afterRebuild = false) => {
  const input = $(`#${id}`)
  const read = () => (input.type === 'checkbox' ? input.checked : transform(input.value))
  input.addEventListener('input', () => {
    state[key] = read()
    if (afterRebuild) {
      buildPairs()
      renderPairs()
    }
    syncLabels()
    draw()
  })
}

// While the second word mirrors the first, keep them in sync — the common case
// is one word that reads the same both ways.
$('#wordA').addEventListener('input', (event) => {
  const linked = state.wordA.trim().toLowerCase() === state.wordB.trim().toLowerCase()
  state.wordA = event.target.value
  if (linked) {
    state.wordB = state.wordA
    $('#wordB').value = state.wordB
  }
  buildPairs()
  renderPairs()
  draw()
})

// The same letters need a different fit under a different symmetry.
$('#mode').addEventListener('input', (event) => {
  state.mode = event.target.value
  buildPairs()
  refitAll()
  renderPairs()
  draw()
})

$('#autoFit').addEventListener('input', (event) => {
  state.autoFit = event.target.checked
  refitAll()
  renderPairs()
  draw()
})

bind('wordB', 'wordB', (v) => v, true)
bind('renderMode', 'renderMode')
bind('font', 'font')
bind('weight', 'weight', Number)
bind('cell', 'cell', Number)
bind('stroke', 'stroke', Number)
bind('ink', 'ink')
bind('paper', 'paper')
bind('opacity', 'opacity', Number)
bind('showAxis', 'showAxis')
bind('transparent', 'transparent')

function syncLabels() {
  $('#weightLabel').textContent = state.weight
  $('#cellLabel').textContent = state.cell
  $('#strokeLabel').textContent = state.stroke
  $('#opacityLabel').textContent = `${state.opacity}%`
}

$('#reset').addEventListener('click', () => {
  refitAll({ force: true })
  renderPairs()
  draw()
})

$('#flip').addEventListener('click', () => {
  stage.classList.toggle('is-flipped')
  stage.dataset.mode = state.mode
})

/* --------------------------------------------------------------- export --- */

function download(blob, extension) {
  const name = (state.wordA.trim() || 'ambigram').replace(/\W+/g, '-').toLowerCase()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.${extension}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

$('#exportSvg').addEventListener('click', () => {
  const svg = buildSvg(state, { forExport: true })
  download(new Blob([svgToString(svg)], { type: 'image/svg+xml' }), 'svg')
})

$('#exportPng').addEventListener('click', async () => {
  const svg = buildSvg(state, { forExport: true })
  const blob = await svgToPngBlob(svg, Number($('#pngScale').value))
  if (blob) download(blob, 'png')
})

/* ----------------------------------------------------------------- init --- */

// The colour inputs carry their own defaults in the markup; the theme owns the
// real ones, so push them back into the DOM before anything reads from it.
$('#ink').value = state.ink
$('#paper').value = state.paper

buildPairs()
renderPairs()
syncLabels()
draw()
stage.dataset.mode = state.mode
mountAds()
