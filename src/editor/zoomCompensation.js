import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

function normalizeZoomScale(value) {
  const scale = Number(value)
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

export function getCssRootZoomScale() {
  if (typeof document === 'undefined') return 1
  return normalizeZoomScale(Number.parseFloat(document.documentElement.style.zoom || '1'))
}

export function getZoomCompensatedClientPoint(event, scale = getCssRootZoomScale()) {
  const normalizedScale = normalizeZoomScale(scale)
  if (normalizedScale === 1) {
    return { x: event.clientX, y: event.clientY }
  }
  return {
    x: event.clientX / normalizedScale,
    y: event.clientY / normalizedScale,
  }
}

function getClickType(event) {
  return Math.min(3, Math.max(1, Number(event?.detail) || 1))
}

function rangeForClick(state, pos, type) {
  if (type === 1) {
    return EditorSelection.cursor(pos)
  }

  if (type === 2) {
    const word = state.wordAt(pos) || state.wordAt(Math.max(0, pos - 1))
    return word ? EditorSelection.range(word.from, word.to) : EditorSelection.cursor(pos)
  }

  const line = state.doc.lineAt(pos)
  let to = line.to
  if (to < state.doc.length) to += 1
  return EditorSelection.range(line.from, to)
}

export function zoomAwareMouseSelectionExtension(getScale = getCssRootZoomScale) {
  return EditorView.mouseSelectionStyle.of((view, startEvent) => {
    const scale = normalizeZoomScale(getScale())
    if (scale === 1 || startEvent.button !== 0) return null

    let startPos = view.posAtCoords(getZoomCompensatedClientPoint(startEvent, scale), false)
    if (startPos === null) return null

    let startSelection = view.state.selection
    const clickType = getClickType(startEvent)

    return {
      update(update) {
        if (update.docChanged) {
          startPos = update.changes.mapPos(startPos)
          startSelection = startSelection.map(update.changes)
        }
      },
      get(curEvent, extend, multiple) {
        const currentPos = view.posAtCoords(getZoomCompensatedClientPoint(curEvent, scale), false) ?? startPos
        let range = rangeForClick(view.state, currentPos, clickType)

        if (startPos !== currentPos && !extend) {
          if (clickType === 1) {
            range = EditorSelection.range(startPos, currentPos)
          } else {
            const startRange = rangeForClick(view.state, startPos, clickType)
            const from = Math.min(startRange.from, range.from)
            const to = Math.max(startRange.to, range.to)
            range = EditorSelection.range(startRange.from <= range.from ? from : to, startRange.from <= range.from ? to : from)
          }
        }

        if (extend) {
          return startSelection.replaceRange(startSelection.main.extend(range.from, range.to, range.assoc))
        }
        if (multiple) {
          return startSelection.addRange(range)
        }
        return EditorSelection.create([range])
      },
    }
  })
}
