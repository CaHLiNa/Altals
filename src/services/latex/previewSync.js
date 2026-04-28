import { invoke } from '@tauri-apps/api/core'
import { focusEditorLineWithHighlight, focusEditorRangeWithHighlight } from '../../editor/revealHighlight.js'
import { normalizeFsPath } from '../documentIntelligence/workspaceGraph.js'

const VIEW_WAIT_TIMEOUT_MS = 1500

export async function resolveLatexSyncTargetPath(reportedFile = '', options = {}) {
  const normalizedReported = normalizeFsPath(reportedFile)
  if (!normalizedReported) return ''

  const resolved = await invoke('latex_preview_resolve_sync_target_path', {
    params: {
      reportedFile: normalizedReported,
      sourcePath: normalizeFsPath(options.sourcePath || ''),
      compileTargetPath: normalizeFsPath(options.compileTargetPath || ''),
      workspacePath: normalizeFsPath(options.workspacePath || ''),
      includeHidden: options.includeHidden !== false,
    },
  }).catch(() => '')

  return normalizeFsPath(resolved || normalizedReported)
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

export async function resolveLatexEditorSelectionFromContext(view, location = {}) {
  const line = Number(location?.line || 0)
  if (!view || !Number.isInteger(line) || line < 1) return null

  const resolved = await invoke('latex_preview_resolve_editor_selection', {
    params: {
      content: view.state.doc.toString(),
      line,
      column: Number(location?.column || 0),
      textBeforeSelection: String(location?.textBeforeSelection || ''),
      textAfterSelection: String(location?.textAfterSelection || ''),
      strictLine: location?.strictLine === true,
    },
  }).catch(() => null)

  const lineNumber = Number(resolved?.lineNumber || line)
  const column = Number(resolved?.column || 0)
  const safeLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines))
  const lineInfo = view.state.doc.line(safeLine)
  const safeColumn = Math.max(0, Math.min(column, lineInfo.text.length))

  return {
    lineNumber: safeLine,
    from: lineInfo.from + safeColumn,
    to: lineInfo.from + safeColumn,
  }
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

  const resolvedSelection = await resolveLatexEditorSelectionFromContext(targetView, location)
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
