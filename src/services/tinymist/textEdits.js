function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function offsetToTinymistPosition(state, pos) {
  const line = state.doc.lineAt(pos)
  return {
    line: line.number - 1,
    character: pos - line.from,
  }
}

export function tinymistPositionToOffset(state, position = {}) {
  const lineNumber = clamp((Number(position.line) || 0) + 1, 1, Math.max(1, state.doc.lines))
  const line = state.doc.line(lineNumber)
  const character = clamp(Number(position.character) || 0, 0, line.length)
  return line.from + character
}

export function tinymistRangeToOffsets(state, range = {}) {
  if (!range?.start || !range?.end) return null
  return {
    from: tinymistPositionToOffset(state, range.start),
    to: tinymistPositionToOffset(state, range.end),
  }
}

function buildChangesFromTinymistTextEdits(state, edits = []) {
  return edits
    .map((edit) => {
      const offsets = tinymistRangeToOffsets(state, edit?.range)
      if (!offsets) return null
      return {
        from: offsets.from,
        to: offsets.to,
        insert: String(edit?.newText || ''),
      }
    })
    .filter(Boolean)
    .sort((left, right) => (
      right.from - left.from || right.to - left.to
    ))
}

export function applyTinymistTextEdits(view, edits = []) {
  const changes = buildChangesFromTinymistTextEdits(view.state, edits)

  if (changes.length === 0) return false

  view.dispatch({ changes })
  return true
}

export function applyTinymistTextEditsToText(text = '', edits = []) {
  const state = {
    doc: {
      lines: String(text || '').split('\n').length || 1,
      line(lineNumber) {
        const normalized = Math.max(1, Math.min(lineNumber, this.lines))
        const lines = String(text || '').split('\n')
        let offset = 0
        for (let index = 1; index < normalized; index += 1) {
          offset += (lines[index - 1] || '').length + 1
        }
        const lineText = lines[normalized - 1] || ''
        return {
          from: offset,
          to: offset + lineText.length,
          length: lineText.length,
        }
      },
    },
  }

  const changes = buildChangesFromTinymistTextEdits(state, edits)
  if (changes.length === 0) return String(text || '')

  let nextText = String(text || '')
  for (const change of changes) {
    nextText = `${nextText.slice(0, change.from)}${change.insert}${nextText.slice(change.to)}`
  }
  return nextText
}
