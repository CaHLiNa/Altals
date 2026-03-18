import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import { dirnamePath, resolveRelativePath } from '../../documentIntelligence/workspaceGraph.js'
import { openExternalHttpUrl } from '../../externalLinks.js'
import {
  requestTinymistDocumentLinks,
  subscribeTinymistStatus,
  tinymistUriToFilePath,
} from '../session.js'
import { tinymistRangeToOffsets } from '../textEdits.js'

const DOC_LINK_REFRESH_DELAY_MS = 260
const setTypstDocumentLinksEffect = StateEffect.define()

function normalizeLinkTarget(target, sourcePath) {
  const raw = String(target || '').trim()
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (url.protocol === 'file:') {
      const filePath = tinymistUriToFilePath(raw)
      return filePath ? { kind: 'file', value: filePath } : null
    }
    return { kind: 'external', value: url.toString() }
  } catch {
    const normalized = raw.replace(/[?#].*$/, '')
    if (!normalized) return null
    return {
      kind: 'file',
      value: resolveRelativePath(dirnamePath(sourcePath), normalized),
    }
  }
}

function normalizeDocumentLinks(state, links = [], sourcePath = '') {
  return links
    .map((entry) => {
      const offsets = tinymistRangeToOffsets(state, entry?.range)
      const target = normalizeLinkTarget(entry?.target, sourcePath)
      if (!offsets || !target) return null
      return {
        from: offsets.from,
        to: offsets.to,
        target,
      }
    })
    .filter(Boolean)
}

function buildDocumentLinkDecorations(links = []) {
  if (!Array.isArray(links) || links.length === 0) return Decoration.none
  return Decoration.set(
    links
      .map(link => Decoration.mark({ class: 'cm-tinymist-doc-link' }).range(link.from, link.to))
      .sort((left, right) => left.from - right.from),
    true,
  )
}

function findDocumentLinkAt(links = [], pos) {
  return links.find(link => pos >= link.from && pos <= link.to) || null
}

async function openDocumentLink(link, options = {}) {
  if (!link?.target) return false

  if (link.target.kind === 'file') {
    if (typeof options.openFile === 'function') {
      options.openFile(link.target.value)
      return true
    }
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(link.target.value)
    return true
  }

  if (link.target.kind === 'external') {
    const opened = await openExternalHttpUrl(link.target.value).catch(() => false)
    if (opened) return true
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(link.target.value)
    return true
  }

  return false
}

const typstDocumentLinksField = StateField.define({
  create() {
    return {
      links: [],
      decorations: Decoration.none,
    }
  },

  update(value, tr) {
    let links = value.links
    let changed = false

    for (const effect of tr.effects) {
      if (effect.is(setTypstDocumentLinksEffect)) {
        links = effect.value
        changed = true
      }
    }

    if (!changed && !tr.docChanged) {
      return value
    }

    return {
      links,
      decorations: buildDocumentLinkDecorations(links),
    }
  },

  provide: field => EditorView.decorations.from(field, value => value.decorations),
})

export function createTinymistTypstDocumentLinksExtension(options = {}) {
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

    scheduleRefresh(view, delay = DOC_LINK_REFRESH_DELAY_MS) {
      if (this.destroyed) return
      if (this.timeout !== null) {
        window.clearTimeout(this.timeout)
        this.timeout = null
      }

      const token = ++this.refreshToken
      this.timeout = window.setTimeout(async () => {
        this.timeout = null
        const result = await requestTinymistDocumentLinks(filePath)
        if (this.destroyed || token !== this.refreshToken) return
        view.dispatch({
          effects: setTypstDocumentLinksEffect.of(
            normalizeDocumentLinks(view.state, result, filePath),
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

  const clickHandler = EditorView.domEventHandlers({
    click(event, view) {
      if (!event.metaKey && !event.ctrlKey) return false

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos === null) return false

      const { links } = view.state.field(typstDocumentLinksField)
      const link = findDocumentLinkAt(links, pos)
      if (!link) return false

      event.preventDefault()
      event.stopPropagation()

      void openDocumentLink(link, options).catch((error) => {
        options.toastStore?.showOnce?.(
          `typst-doc-link-open-failed:${filePath}:${pos}`,
          options.t?.('Could not open linked target: {error}', {
            error: error?.message || String(error || ''),
          }) || String(error || 'Could not open linked target.'),
          { type: 'error', duration: 4500 },
          3000,
        )
      })

      return true
    },
  })

  return [typstDocumentLinksField, refreshPlugin, clickHandler]
}
