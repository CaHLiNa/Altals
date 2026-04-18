export const EDITOR_RUNTIME_EVENT_NAME = 'scribeflow:editor-runtime-event'

export function emitEditorRuntimeTelemetry(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(EDITOR_RUNTIME_EVENT_NAME, {
      detail: {
        ts: new Date().toISOString(),
        ...detail,
      },
    })
  )
}

export function createEditorRuntimeContract(runtime = {}) {
  const {
    runtimeKind = 'web',
    paneId = '',
    filePath = '',
    getView = () => null,
    getContent = () => '',
    persistContent = async () => false,
    applyExternalContent = async () => false,
    requestSelection = () => null,
    revealOffset = () => false,
    revealRange = () => false,
    setDiagnostics = () => false,
    setOutlineContext = () => false,
    dispose = () => {},
  } = runtime

  return {
    runtimeKind,
    paneId,
    filePath,

    get state() {
      return getView()?.state || null
    },

    get rawView() {
      return getView()
    },

    dispatch(spec) {
      const view = getView()
      if (!view?.dispatch) return false
      view.dispatch(spec)
      return true
    },

    focus() {
      getView()?.focus?.()
    },

    destroy() {
      if (typeof dispose === 'function') {
        return dispose()
      }
      const view = getView()
      if (!view?.destroy) return false
      view.destroy()
      return true
    },

    scribeflowPersist() {
      return persistContent()
    },

    scribeflowGetContent() {
      return getContent()
    },

    scribeflowApplyExternalContent(nextContent = '') {
      return applyExternalContent(nextContent)
    },

    scribeflowRequestSelection() {
      return requestSelection()
    },

    scribeflowRevealOffset(offset, options = {}) {
      return revealOffset(offset, options)
    },

    scribeflowRevealRange(from, to, options = {}) {
      return revealRange(from, to, options)
    },

    scribeflowSetDiagnostics(diagnostics = []) {
      return setDiagnostics(diagnostics)
    },

    scribeflowSetOutlineContext(context = null) {
      return setOutlineContext(context)
    },
  }
}
