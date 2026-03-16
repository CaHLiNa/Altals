import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'
import { formatDate, t } from '../i18n'
import {
  getLiveProvenance,
  getResultProvenanceEventName,
  getResultStatusLabelKey,
  getResultStatusTone,
  parseResultProvenanceComments,
} from '../services/resultProvenance'

const refreshResultBadges = StateEffect.define()

function effectiveMeta(meta = {}) {
  return getLiveProvenance(meta) || meta
}

function metaLabel(meta = {}) {
  const fileName = String(meta.sourceFile || '').split('/').pop() || ''
  const producer = meta.producerLabel || meta.producerId || t('Result')
  return [producer, fileName].filter(Boolean).join(' • ')
}

class ResultProvenanceBadgeWidget extends WidgetType {
  constructor(meta) {
    super()
    this.meta = effectiveMeta(meta)
    this.signature = JSON.stringify(this.meta)
  }

  eq(other) {
    return this.signature === other.signature
  }

  toDOM() {
    const wrap = document.createElement('div')
    wrap.className = `cm-result-provenance cm-result-provenance-${getResultStatusTone(this.meta.status)}`

    const status = document.createElement('span')
    status.className = 'cm-result-provenance-status'
    status.textContent = t(getResultStatusLabelKey(this.meta.status))
    wrap.appendChild(status)

    const label = document.createElement('span')
    label.className = 'cm-result-provenance-label'
    label.textContent = metaLabel(this.meta)
    wrap.appendChild(label)

    if (this.meta.generatedAt) {
      const time = document.createElement('span')
      time.className = 'cm-result-provenance-time'
      time.textContent = formatDate(this.meta.generatedAt, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      wrap.appendChild(time)
    }

    return wrap
  }
}

function buildDecorations(state) {
  const markers = parseResultProvenanceComments(state.doc.toString())
  if (!markers.length) return Decoration.none

  return Decoration.set(markers.map(({ to, meta }) => (
    Decoration.widget({
      widget: new ResultProvenanceBadgeWidget(meta),
      block: true,
      side: 1,
    }).range(to)
  )), true)
}

const resultBadgeField = StateField.define({
  create(state) {
    return buildDecorations(state)
  },
  update(value, tr) {
    if (tr.docChanged || tr.effects.some((effect) => effect.is(refreshResultBadges))) {
      return buildDecorations(tr.state)
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field),
})

const resultBadgeTheme = EditorView.baseTheme({
  '.cm-result-provenance': {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginTop: '6px',
    marginBottom: '4px',
    padding: '4px 8px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    fontSize: 'var(--ui-font-micro)',
    width: 'fit-content',
    maxWidth: '100%',
  },
  '.cm-result-provenance-status': {
    fontWeight: '600',
  },
  '.cm-result-provenance-label, .cm-result-provenance-time': {
    color: 'var(--fg-muted)',
  },
  '.cm-result-provenance-muted': {
    background: 'rgba(128, 128, 128, 0.1)',
  },
  '.cm-result-provenance-info': {
    background: 'rgba(122, 162, 247, 0.12)',
  },
  '.cm-result-provenance-success': {
    background: 'rgba(80, 250, 123, 0.12)',
  },
  '.cm-result-provenance-warning': {
    background: 'rgba(226, 185, 61, 0.12)',
  },
  '.cm-result-provenance-danger': {
    background: 'rgba(247, 118, 142, 0.12)',
  },
})

const resultBadgeSync = ViewPlugin.fromClass(class {
  constructor(view) {
    this.view = view
    this.handleRefresh = () => {
      this.view.dispatch({ effects: refreshResultBadges.of(null) })
    }
    window.addEventListener(getResultProvenanceEventName(), this.handleRefresh)
  }

  destroy() {
    window.removeEventListener(getResultProvenanceEventName(), this.handleRefresh)
  }
})

export function resultProvenanceBadgesExtension() {
  return [
    resultBadgeField,
    resultBadgeTheme,
    resultBadgeSync,
  ]
}
