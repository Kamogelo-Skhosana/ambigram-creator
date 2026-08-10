/**
 * Builds the ambigram as an SVG element.
 *
 * Layout: one cell per letter pair. Cell i holds letter A[i] drawn upright and
 * letter B[n-1-i] drawn under the symmetry transform, so that flipping the whole
 * artwork swaps the two readings.
 */

const NS = 'http://www.w3.org/2000/svg'
const FONT_SIZE = 100
const HEIGHT = 220

const GUIDE_A = '#b3160f'
const GUIDE_B = '#0a48b4'

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

function glyph(text, { fill, opacity, font, weight, stroke, inkStroke, tweak }) {
  const group = el('g', {
    transform: `translate(${tweak.dx} ${tweak.dy}) rotate(${tweak.rot}) scale(${tweak.sx} ${tweak.sy})`,
    opacity,
  })

  const node = el('text', {
    x: 0,
    y: 0,
    fill,
    'font-family': font,
    'font-size': FONT_SIZE,
    'font-weight': weight,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
  })

  if (stroke > 0) {
    node.setAttribute('stroke', inkStroke)
    node.setAttribute('stroke-width', stroke * 2)
    node.setAttribute('stroke-linejoin', 'round')
    node.setAttribute('paint-order', 'stroke')
  }

  node.textContent = text
  group.append(node)
  return group
}

export function buildSvg(state, { forExport = false } = {}) {
  const pairs = state.pairs
  const cell = state.cell
  const width = Math.max(cell * pairs.length, cell)
  // No explicit xmlns here — the element already lives in the SVG namespace and
  // XMLSerializer adds the declaration, so setting it would emit it twice.
  const svg = el('svg', {
    viewBox: `${-width / 2} ${-HEIGHT / 2} ${width} ${HEIGHT}`,
    width,
    height: HEIGHT,
    'font-kerning': 'none',
  })

  if (!forExport || !state.transparent) {
    svg.append(el('rect', {
      x: -width / 2,
      y: -HEIGHT / 2,
      width,
      height: HEIGHT,
      fill: state.paper,
    }))
  }

  if (state.showAxis && !forExport) {
    const axis = el('g', { stroke: '#8a8a80', 'stroke-width': 1, 'stroke-dasharray': '6 6', opacity: 0.7 })
    axis.append(el('line', { x1: -width / 2, y1: 0, x2: width / 2, y2: 0 }))
    axis.append(el('line', { x1: 0, y1: -HEIGHT / 2, x2: 0, y2: HEIGHT / 2 }))
    svg.append(axis)
  }

  const flip = state.mode === 'mirror' ? 'scale(-1 1)' : 'rotate(180)'
  const opacityB = state.renderMode === 'blend' ? state.opacity / 100 : 1

  pairs.forEach((pair, index) => {
    const cx = -width / 2 + cell * (index + 0.5)
    const cellGroup = el('g', { transform: `translate(${cx} 0)` })

    const shared = {
      font: state.font,
      weight: state.weight,
      stroke: state.stroke,
      inkStroke: state.ink,
    }

    if (!pair.hideA && pair.a) {
      cellGroup.append(glyph(pair.a, {
        ...shared,
        fill: state.renderMode === 'guide' ? GUIDE_A : state.ink,
        opacity: 1,
        tweak: { dx: pair.dxA, dy: pair.dyA, rot: pair.rotA, sx: pair.sxA, sy: pair.syA },
      }))
    }

    if (!pair.hideB && pair.b) {
      const flipped = el('g', { transform: flip })
      flipped.append(glyph(pair.b, {
        ...shared,
        fill: state.renderMode === 'guide' ? GUIDE_B : state.ink,
        opacity: state.renderMode === 'guide' ? 0.8 : opacityB,
        tweak: { dx: pair.dxB, dy: pair.dyB, rot: pair.rotB, sx: pair.sxB, sy: pair.syB },
      }))
      cellGroup.append(flipped)
    }

    svg.append(cellGroup)
  })

  return svg
}

export function svgToString(svg) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`
}

export async function svgToPngBlob(svg, scale = 2) {
  const source = svgToString(svg)
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not rasterise the artwork.'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = Number(svg.getAttribute('width')) * scale
    canvas.height = Number(svg.getAttribute('height')) * scale
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}
