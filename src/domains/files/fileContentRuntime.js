export function createFileContentRuntime({
  getPdfSourceState,
  setPdfSourceState,
  clearPdfSourceState,
  detectPdfSourceKind,
  readTextFile,
  saveTextFile,
  extractPdfText,
  isBinaryPath,
  setFileContent,
  clearFileLoadError,
  setFileLoadError,
  syncSavedMarkdownLinks,
  notifyPdfUpdated,
  onPdfReadError,
  onSaveError,
} = {}) {
  const pdfSourcePromises = new Map()

  function invalidatePdfSourceForPath(path) {
    if (!path) return
    const lowerPath = path.toLowerCase()
    if (lowerPath.endsWith('.pdf')) {
      clearPdfSourceState?.(path)
      return
    }
    if (lowerPath.endsWith('.tex') || lowerPath.endsWith('.typ')) {
      clearPdfSourceState?.(path.replace(/\.(tex|typ)$/i, '.pdf'))
    }
  }

  async function ensurePdfSourceKind(pdfPath, options = {}) {
    if (!pdfPath?.toLowerCase().endsWith('.pdf')) return 'plain'
    const { force = false } = options
    const cached = getPdfSourceState?.(pdfPath)
    if (!force && cached?.status === 'ready') {
      return cached.kind
    }

    const existingPromise = pdfSourcePromises.get(pdfPath)
    if (existingPromise && !force) {
      return existingPromise
    }

    setPdfSourceState?.(pdfPath, {
      status: 'loading',
      kind: cached?.kind || 'plain',
    })

    const loadPromise = (async () => {
      const kind = await detectPdfSourceKind?.(pdfPath)
      setPdfSourceState?.(pdfPath, {
        status: 'ready',
        kind,
      })
      return kind
    })()

    pdfSourcePromises.set(pdfPath, loadPromise)
    try {
      return await loadPromise
    } catch (error) {
      setPdfSourceState?.(pdfPath, {
        status: 'ready',
        kind: 'plain',
      })
      throw error
    } finally {
      pdfSourcePromises.delete(pdfPath)
    }
  }

  async function readFile(path, options = {}) {
    const { maxBytes } = options

    if (path.toLowerCase().endsWith('.pdf')) {
      try {
        const text = await extractPdfText?.(path)
        setFileContent?.(path, text)
        clearFileLoadError?.(path)
        return text
      } catch (error) {
        onPdfReadError?.(path, error)
        return null
      }
    }

    if (isBinaryPath?.(path)) return null

    try {
      const content = await readTextFile?.(path, maxBytes)
      setFileContent?.(path, content)
      clearFileLoadError?.(path)
      return content
    } catch (error) {
      setFileLoadError?.(path, error)
      return null
    }
  }

  async function reloadFile(path, options = {}) {
    if (path.toLowerCase().endsWith('.pdf')) {
      invalidatePdfSourceForPath(path)
      notifyPdfUpdated?.(path)
      return null
    }
    return readFile(path, options)
  }

  async function saveFile(path, content) {
    try {
      await saveTextFile?.(path, content)
      setFileContent?.(path, content)
      clearFileLoadError?.(path)
      syncSavedMarkdownLinks?.(path)
      return true
    } catch (error) {
      onSaveError?.(path, error)
      return false
    }
  }

  function setInMemoryFileContent(path, content) {
    if (!path || typeof content !== 'string') return
    setFileContent?.(path, content)
    clearFileLoadError?.(path)
  }

  function reset() {
    pdfSourcePromises.clear()
  }

  return {
    invalidatePdfSourceForPath,
    ensurePdfSourceKind,
    readFile,
    reloadFile,
    saveFile,
    setInMemoryFileContent,
    reset,
  }
}
