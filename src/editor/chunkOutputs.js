// CM6 extension for inline chunk outputs below code chunks in .Rmd/.qmd files.
// Shows rich outputs (plots, tables, errors) via CellOutput.vue rendered as block widgets.
// Block decorations MUST come from a StateField (not ViewPlugin) —
// CM6 throws "Block decorations may not be specified via plugins".

import { StateField, StateEffect } from '@codemirror/state'
import { EditorView, Decoration, WidgetType } from '@codemirror/view'
import { createApp, h } from 'vue'
import { formatDate, t } from '../i18n'
import ExecutionResultCard from '../components/editor/ExecutionResultCard.vue'
import { useEditorStore } from '../stores/editor'
import { useToastStore } from '../stores/toast'
import { buildSourceSignature, getResultStatusLabelKey, getResultStatusTone } from '../services/resultProvenance'
import { chunkField } from './codeChunks'

// ── State Effects ────────────────────────────────────────────

export const setChunkOutput = StateEffect.define()   // { chunkKey, outputs, status }
export const clearChunkOutput = StateEffect.define()  // chunkKey string
export const clearAllOutputs = StateEffect.define()   // no value

// ── Chunk Identity ───────────────────────────────────────────

export function chunkKey(chunk) {
  return `${chunk.language}::${chunk.ordinal ?? chunk.headerLine}`
}

// ── State Field (output data) ────────────────────────────────

export const chunkOutputField = StateField.define({
  create() {
    return new Map()
  },

  update(map, tr) {
    let changed = false
    let next = map

    for (const effect of tr.effects) {
      if (effect.is(setChunkOutput)) {
        if (!changed) { next = new Map(map); changed = true }
        next.set(effect.value.chunkKey, {
          outputs: effect.value.outputs,
          status: effect.value.status,
          timestamp: Date.now(),
          sourceSignature: effect.value.sourceSignature || '',
          provenance: effect.value.provenance || null,
          hint: effect.value.hint || '',
        })
      } else if (effect.is(clearChunkOutput)) {
        if (map.has(effect.value)) {
          if (!changed) { next = new Map(map); changed = true }
          next.delete(effect.value)
        }
      } else if (effect.is(clearAllOutputs)) {
        if (map.size > 0) {
          next = new Map()
          changed = true
        }
      }
    }

    if (tr.docChanged && next.size > 0) {
      const chunks = tr.state.field(chunkField)
      for (const chunk of chunks) {
        const key = chunkKey(chunk)
        const entry = next.get(key)
        if (!entry || !entry.sourceSignature || entry.status === 'running') continue
        const source = tr.state.doc.sliceString(chunk.contentFrom, chunk.contentTo).trim()
        if (buildSourceSignature(source) === entry.sourceSignature) continue
        if (!changed) { next = new Map(next); changed = true }
        next.set(key, {
          ...entry,
          status: 'stale',
        })
      }
    }

    return next
  },
})

// ── Widget ───────────────────────────────────────────────────

class ChunkOutputWidget extends WidgetType {
  constructor(chunkKey, entry) {
    super()
    this.chunkKey = chunkKey
    this.entry = entry
    this._app = null
  }

  eq(other) {
    return this.chunkKey === other.chunkKey &&
      JSON.stringify(this.entry) === JSON.stringify(other.entry)
  }

  toDOM(view) {
    const container = document.createElement('div')
    container.className = 'cm-chunk-output-widget'
    const mountPoint = document.createElement('div')
    container.appendChild(mountPoint)

    const key = this.chunkKey
    const entry = this.entry
    const toastStore = useToastStore()
    const editorStore = useEditorStore()
    const generatedAtLabel = entry.provenance?.generatedAt
      ? formatDate(entry.provenance.generatedAt, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      : ''

    this._app = createApp({
      render: () => h(ExecutionResultCard, {
        outputs: entry.outputs,
        tone: getResultStatusTone(entry.status),
        statusText: t(getResultStatusLabelKey(entry.status)),
        hint: entry.hint || (entry.status === 'stale' ? t('This result is stale. Rerun the source to refresh it.') : ''),
        producerLabel: entry.provenance?.producerLabel || key,
        generatedAtLabel,
        showInsert: entry.status !== 'running' && entry.status !== 'error' && (entry.outputs || []).length > 0,
        showDismiss: entry.status !== 'running',
        insertLabel: t('Insert result'),
        dismissLabel: t('Dismiss output'),
        onDismiss: () => {
          view.dispatch({ effects: clearChunkOutput.of(key) })
        },
        onInsert: async () => {
          const result = await editorStore.insertExecutionResultIntoManuscript({
            outputs: entry.outputs,
            provenance: entry.provenance || {},
          })
          if (!result.ok) {
            toastStore.showOnce(`chunk-insert:${key}`, result.reason === 'no-target'
              ? t('Open a Markdown, LaTeX, or Typst manuscript to insert this result.')
              : t('Could not insert this result into the current manuscript.'), {
              type: 'warning',
              duration: 4000,
            })
            return
          }
          toastStore.showOnce(`chunk-insert:${key}:success`, t('Inserted result into {file}', {
            file: result.path.split('/').pop(),
          }), {
            type: 'success',
            duration: 3000,
          })
        },
      }),
    })
    this._app.mount(mountPoint)

    return container
  }

  destroy(dom) {
    if (this._app) {
      this._app.unmount()
      this._app = null
    }
  }
}

// ── Decoration StateField ────────────────────────────────────

function buildOutputDecorations(state) {
  const outputMap = state.field(chunkOutputField)
  if (outputMap.size === 0) return Decoration.none

  const chunks = state.field(chunkField)
  const decorations = []

  for (const chunk of chunks) {
    if (!chunk.endLine) continue
    const key = chunkKey(chunk)
    const entry = outputMap.get(key)
    if (!entry) continue

    const endLine = state.doc.line(chunk.endLine)
    decorations.push(
      Decoration.widget({
        widget: new ChunkOutputWidget(key, entry),
        block: true,
        side: 1,
      }).range(endLine.to)
    )
  }

  return Decoration.set(decorations, true)
}

const chunkOutputDecorations = StateField.define({
  create(state) {
    return Decoration.none
  },

  update(decos, tr) {
    if (tr.docChanged || tr.effects.some(e =>
      e.is(setChunkOutput) || e.is(clearChunkOutput) || e.is(clearAllOutputs)
    )) {
      return buildOutputDecorations(tr.state)
    }
    return decos
  },

  provide: f => EditorView.decorations.from(f),
})

// ── Extension ────────────────────────────────────────────────

export function chunkOutputsExtension() {
  return [
    chunkOutputField,
    chunkOutputDecorations,
  ]
}
