import { StateEffect, StateField } from '@codemirror/state'
import { EditorView, showTooltip, ViewPlugin } from '@codemirror/view'
import { requestTinymistSignatureHelp } from '../session.js'
import { offsetToTinymistPosition } from '../textEdits.js'

const SIGNATURE_HELP_REFRESH_DELAY_MS = 220
const setTinymistSignatureTooltipEffect = StateEffect.define()

function normalizeDocumentation(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value.value === 'string') return value.value
  return ''
}

function compactDocumentationText(value) {
  const text = normalizeDocumentation(value)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/^[#>\-\*\s]+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return ''
  return text.length > 180 ? `${text.slice(0, 177).trim()}...` : text
}

function resolveActiveSignature(result) {
  const signatures = Array.isArray(result?.signatures) ? result.signatures : []
  if (signatures.length === 0) return null
  const activeSignatureIndex = Math.max(0, Number(result?.activeSignature) || 0)
  const signature = signatures[activeSignatureIndex] || signatures[0]
  if (!signature?.label) return null
  return {
    signature,
    activeParameter: Number.isInteger(result?.activeParameter)
      ? result.activeParameter
      : Number.isInteger(signature?.activeParameter)
        ? signature.activeParameter
        : null,
  }
}

function appendSignatureLabel(parent, label, parameterLabel) {
  if (!parameterLabel) {
    parent.textContent = label
    return
  }

  const labelText = String(label || '')
  if (Array.isArray(parameterLabel) && parameterLabel.length === 2) {
    const [from, to] = parameterLabel
    parent.append(document.createTextNode(labelText.slice(0, from)))
    const active = document.createElement('span')
    active.className = 'cm-tinymist-signature__param'
    active.textContent = labelText.slice(from, to)
    parent.append(active)
    parent.append(document.createTextNode(labelText.slice(to)))
    return
  }

  const simple = String(parameterLabel || '')
  const index = simple ? labelText.indexOf(simple) : -1
  if (index < 0) {
    parent.textContent = labelText
    return
  }

  parent.append(document.createTextNode(labelText.slice(0, index)))
  const active = document.createElement('span')
  active.className = 'cm-tinymist-signature__param'
  active.textContent = simple
  parent.append(active)
  parent.append(document.createTextNode(labelText.slice(index + simple.length)))
}

function createSignatureDom(signature, activeParameter) {
  const root = document.createElement('div')
  root.className = 'cm-tinymist-signature__body'

  const label = document.createElement('div')
  label.className = 'cm-tinymist-signature__label'
  const parameterLabel = activeParameter != null
    ? signature?.parameters?.[activeParameter]?.label
    : null
  appendSignatureLabel(label, signature?.label || '', parameterLabel)
  root.append(label)

  const activeParameterDoc = activeParameter != null
    ? compactDocumentationText(signature?.parameters?.[activeParameter]?.documentation)
    : ''
  const fallbackDoc = compactDocumentationText(signature?.documentation)
  const docText = activeParameterDoc || fallbackDoc

  if (docText) {
    const docsDom = document.createElement('div')
    docsDom.className = 'cm-tinymist-signature__hint'
    docsDom.textContent = docText
    root.append(docsDom)
  }

  return root
}

function buildSignatureTooltip(pos, result) {
  const active = resolveActiveSignature(result)
  if (!active) return null

  return {
    pos,
    above: false,
    strictSide: false,
    clip: false,
    class: 'cm-tinymist-signature',
    create() {
      return {
        dom: createSignatureDom(active.signature, active.activeParameter),
      }
    },
  }
}

const tinymistSignatureField = StateField.define({
  create() {
    return null
  },

  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setTinymistSignatureTooltipEffect)) {
        return effect.value
      }
    }

    if (tr.docChanged || tr.selection) {
      return null
    }

    return value
  },

  provide: field => showTooltip.from(field),
})

export function createTinymistTypstSignatureHelpExtension(options = {}) {
  const filePath = String(options.filePath || '')
  if (!filePath) return []

  const refreshPlugin = ViewPlugin.fromClass(class {
    constructor(view) {
      this.timeout = null
      this.requestToken = 0
      this.destroyed = false
      this.scheduleRefresh(view)
    }

    scheduleRefresh(view, delay = SIGNATURE_HELP_REFRESH_DELAY_MS) {
      if (this.destroyed) return
      if (this.timeout !== null) {
        window.clearTimeout(this.timeout)
        this.timeout = null
      }

      const selection = view.state.selection.main
      if (!selection.empty) {
        view.dispatch({ effects: setTinymistSignatureTooltipEffect.of(null) })
        return
      }

      const pos = selection.head
      const token = ++this.requestToken
      this.timeout = window.setTimeout(async () => {
        this.timeout = null
        const result = await requestTinymistSignatureHelp(
          filePath,
          offsetToTinymistPosition(view.state, pos),
        )
        if (this.destroyed || token !== this.requestToken) return
        view.dispatch({
          effects: setTinymistSignatureTooltipEffect.of(
            buildSignatureTooltip(pos, result),
          ),
        })
      }, delay)
    }

    update(update) {
      if (update.docChanged || update.selectionSet) {
        this.scheduleRefresh(update.view)
      }
    }

    destroy() {
      this.destroyed = true
      if (this.timeout !== null) {
        window.clearTimeout(this.timeout)
        this.timeout = null
      }
    }
  })

  return [
    tinymistSignatureField,
    refreshPlugin,
  ]
}
