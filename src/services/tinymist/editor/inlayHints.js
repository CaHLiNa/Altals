import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'
import {
  requestTinymistInlayHints,
  subscribeTinymistStatus,
} from '../session.js'
import {
  offsetToTinymistPosition,
  tinymistPositionToOffset,
} from '../textEdits.js'

const INLAY_HINTS_REFRESH_MS = 160
const INLAY_HINTS_VIEWPORT_MARGIN = 12
const INLAY_HINTS_SETTINGS_EVENT = 'typst-inlay-hints-changed'

const setTinymistInlayHintsEffect = StateEffect.define()

function labelText(label) {
  if (typeof label === 'string') return label
  if (!Array.isArray(label)) return ''
  return label.map((part) => {
    if (typeof part === 'string') return part
    return String(part?.value || '')
  }).join('').trim()
}

function buildViewportRange(view) {
  if (!view?.state) return null

  const startLine = Math.max(1, view.state.doc.lineAt(view.viewport.from).number - INLAY_HINTS_VIEWPORT_MARGIN)
  const endLine = Math.min(view.state.doc.lines, view.state.doc.lineAt(view.viewport.to).number + INLAY_HINTS_VIEWPORT_MARGIN)
  const from = view.state.doc.line(startLine).from
  const to = view.state.doc.line(endLine).to

  return {
    start: offsetToTinymistPosition(view.state, from),
    end: offsetToTinymistPosition(view.state, to),
  }
}

function normalizeInlayHints(state, hints = []) {
  return (Array.isArray(hints) ? hints : [])
    .map((hint, index) => {
      const label = labelText(hint?.label)
      if (!label || !hint?.position) return null

      return {
        id: `${hint.position.line}:${hint.position.character}:${label}:${index}`,
        label,
        offset: tinymistPositionToOffset(state, hint.position),
        paddingLeft: hint?.paddingLeft === true,
        paddingRight: hint?.paddingRight !== false,
        side: hint?.paddingLeft === true && hint?.paddingRight !== true ? 1 : -1,
      }
    })
    .filter(Boolean)
    .sort((left, right) => (
      left.offset - right.offset || left.label.localeCompare(right.label)
    ))
}

class TinymistInlayHintWidget extends WidgetType {
  constructor(hint) {
    super()
    this.hint = hint
  }

  eq(other) {
    return this.hint.id === other.hint.id
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-typst-inlay-hint'
    if (this.hint.paddingLeft) wrap.classList.add('cm-typst-inlay-hint-pad-left')
    if (this.hint.paddingRight) wrap.classList.add('cm-typst-inlay-hint-pad-right')
    wrap.textContent = this.hint.label
    wrap.setAttribute('aria-hidden', 'true')
    return wrap
  }

  ignoreEvent() {
    return true
  }
}

function buildDecorations(hints = []) {
  if (!Array.isArray(hints) || hints.length === 0) return Decoration.none
  return Decoration.set(
    hints.map((hint) => (
      Decoration.widget({
        widget: new TinymistInlayHintWidget(hint),
        side: hint.side,
      }).range(hint.offset)
    )),
    true,
  )
}

const tinymistInlayHintsField = StateField.define({
  create() {
    return {
      hints: [],
      decorations: Decoration.none,
    }
  },

  update(value, tr) {
    let hints = value.hints
    let changed = false

    if (tr.docChanged) {
      hints = []
      changed = true
    }

    for (const effect of tr.effects) {
      if (effect.is(setTinymistInlayHintsEffect)) {
        hints = effect.value
        changed = true
      }
    }

    if (!changed) return value

    return {
      hints,
      decorations: buildDecorations(hints),
    }
  },

  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
})

export function createTinymistTypstInlayHintsExtension(options = {}) {
  return [
    tinymistInlayHintsField,
    ViewPlugin.fromClass(class {
      constructor(view) {
        this.view = view
        this.requestId = 0
        this.refreshTimer = null
        this.tinymistActive = false
        this.cleanupTinymistStatus = subscribeTinymistStatus((status) => {
          this.tinymistActive = status.available === true
          this.refresh()
        })
        this.handleSettingsChange = () => {
          this.refresh()
        }
        if (typeof window !== 'undefined') {
          window.addEventListener(INLAY_HINTS_SETTINGS_EVENT, this.handleSettingsChange)
        }
        this.refresh()
      }

      update(update) {
        if (update.docChanged || update.viewportChanged) {
          this.refresh()
        }
      }

      clearHints() {
        this.requestId += 1
        clearTimeout(this.refreshTimer)
        this.refreshTimer = null
        this.view.dispatch({
          effects: setTinymistInlayHintsEffect.of([]),
        })
      }

      refresh() {
        clearTimeout(this.refreshTimer)
        this.refreshTimer = null

        const enabled = options.isEnabled?.() === true
        if (!enabled || !this.tinymistActive) {
          this.clearHints()
          return
        }

        const range = buildViewportRange(this.view)
        if (!range) {
          this.clearHints()
          return
        }

        const requestId = ++this.requestId
        this.refreshTimer = setTimeout(async () => {
          try {
            const result = await requestTinymistInlayHints(options.filePath, range)
            if (requestId !== this.requestId) return
            const hints = normalizeInlayHints(this.view.state, result).slice(0, 200)
            this.view.dispatch({
              effects: setTinymistInlayHintsEffect.of(hints),
            })
          } catch {
            if (requestId !== this.requestId) return
            this.view.dispatch({
              effects: setTinymistInlayHintsEffect.of([]),
            })
          }
        }, INLAY_HINTS_REFRESH_MS)
      }

      destroy() {
        clearTimeout(this.refreshTimer)
        this.refreshTimer = null
        this.cleanupTinymistStatus?.()
        if (typeof window !== 'undefined') {
          window.removeEventListener(INLAY_HINTS_SETTINGS_EVENT, this.handleSettingsChange)
        }
      }
    }),
  ]
}
