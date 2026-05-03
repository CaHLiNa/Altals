import { focusEditorLineWithHighlight, focusEditorRangeWithHighlight } from '../../editor/revealHighlight.js'
import { resolveLatexEditorSelectionFromContext } from '../../domains/latex/latexPreviewSelection.js'
import { normalizeFsPath } from '../documentIntelligence/workspaceGraph.js'
import { resolveLatexSyncTarget } from './runtime.js'

const VIEW_WAIT_TIMEOUT_MS = 1500

export async function resolveLatexSyncTargetPath(reportedFile = '', options = {}) {
  const resolved = await resolveLatexSyncTarget({
    reportedFile,
    sourcePath: options.sourcePath || '',
    compileTargetPath: options.compileTargetPath || '',
    workspacePath: options.workspacePath || '',
  }).catch(() => null)
  const resolvedPath = normalizeFsPath(resolved?.path || '')
  return resolvedPath
}

export async function waitForLatexEditorView(editorStore, targetPath, timeoutMs = VIEW_WAIT_TIMEOUT_MS) {
  const startedAt = Date.now()
  let targetView = editorStore?.getAnyEditorView?.(targetPath) || null

  while (!targetView && Date.now() - startedAt < timeoutMs) {
    await new Promise(resolve => window.setTimeout(resolve, 16))
    targetView = editorStore?.getAnyEditorView?.(targetPath) || null
  }

  return targetView
}

export async function revealLatexSourceLocation(editorStore, location, options = {}) {
  const targetPath = normalizeFsPath(location?.filePath || '')
  const line = Number(location?.line || 0)
  if (!targetPath || !Number.isInteger(line) || line < 1) return false

  const existingPaneId = editorStore?.findPaneWithTab?.(targetPath)?.id || ''
  const preferredPaneId = String(existingPaneId || options.paneId || editorStore?.activePaneId || '')
  if (preferredPaneId && editorStore?.findPane?.(editorStore.paneTree, preferredPaneId)) {
    editorStore?.openFileInPane?.(targetPath, preferredPaneId, { activatePane: true })
  } else {
    editorStore?.openFile?.(targetPath)
  }

  const targetView = await waitForLatexEditorView(
    editorStore,
    targetPath,
    Number(options.timeoutMs || VIEW_WAIT_TIMEOUT_MS),
  )
  if (!targetView) return false

  const resolvedSelection = resolveLatexEditorSelectionFromContext(targetView, location)
  if (resolvedSelection?.from != null) {
    return focusEditorRangeWithHighlight(
      targetView,
      resolvedSelection.from,
      resolvedSelection.to,
      options,
    )
  }

  return focusEditorLineWithHighlight(targetView, line, options)
}
