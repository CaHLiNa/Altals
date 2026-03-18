import { StateEffect, StateField } from '@codemirror/state'
import { ViewPlugin } from '@codemirror/view'
import { foldService } from '@codemirror/language'
import {
  requestTinymistFoldingRanges,
  subscribeTinymistStatus,
} from '../session.js'
import { tinymistPositionToOffset } from '../textEdits.js'

const FOLDING_REFRESH_DELAY_MS = 260
const setTinymistFoldingRangesEffect = StateEffect.define()

function normalizeFoldingRanges(state, ranges = []) {
  return ranges
    .map((entry) => {
      const start = entry?.startCharacter != null
        ? tinymistPositionToOffset(state, {
          line: entry.startLine,
          character: entry.startCharacter,
        })
        : state.doc.line(Math.max(1, (Number(entry?.startLine) || 0) + 1)).from

      const end = entry?.endCharacter != null
        ? tinymistPositionToOffset(state, {
          line: entry.endLine,
          character: entry.endCharacter,
        })
        : state.doc.line(Math.max(1, (Number(entry?.endLine) || 0) + 1)).to

      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
      return {
        from: start,
        to: end,
        lineStart: state.doc.lineAt(start).from,
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.lineStart - right.lineStart || left.from - right.from)
}

function foldRangeForLine(ranges = [], lineStart, lineEnd) {
  return ranges.find((entry) => (
    entry.lineStart === lineStart
    && entry.from <= lineEnd
    && entry.to > lineEnd
  )) || null
}

const tinymistFoldingField = StateField.define({
  create() {
    return []
  },

  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setTinymistFoldingRangesEffect)) {
        return effect.value
      }
    }

    if (tr.docChanged) {
      return []
    }

    return value
  },

  provide: field => foldService.of((state, lineStart, lineEnd) => {
    const ranges = state.field(field)
    const match = foldRangeForLine(ranges, lineStart, lineEnd)
    return match ? { from: match.from, to: match.to } : null
  }),
})

export function createTinymistTypstFoldingExtension(options = {}) {
  const filePath = String(options.filePath || '')
  if (!filePath) return []

  const refreshPlugin = ViewPlugin.fromClass(class {
    constructor(view) {
      this.timeout = null
      this.refreshToken = 0
      this.destroyed = false
      this.unsubscribeStatus = subscribeTinymistStatus((status) => {
        if (status.available === true) {
          this.scheduleRefresh(view)
        }
      })
      this.scheduleRefresh(view)
    }

    scheduleRefresh(view, delay = FOLDING_REFRESH_DELAY_MS) {
      if (this.destroyed) return
      if (this.timeout !== null) {
        window.clearTimeout(this.timeout)
        this.timeout = null
      }

      const token = ++this.refreshToken
      this.timeout = window.setTimeout(async () => {
        this.timeout = null
        const result = await requestTinymistFoldingRanges(filePath)
        if (this.destroyed || token !== this.refreshToken) return
        view.dispatch({
          effects: setTinymistFoldingRangesEffect.of(
            normalizeFoldingRanges(view.state, result),
          ),
        })
      }, delay)
    }

    update(update) {
      if (update.docChanged) {
        this.scheduleRefresh(update.view)
      }
    }

    destroy() {
      this.destroyed = true
      if (this.timeout !== null) {
        window.clearTimeout(this.timeout)
        this.timeout = null
      }
      this.unsubscribeStatus?.()
    }
  })

  return [tinymistFoldingField, refreshPlugin]
}
