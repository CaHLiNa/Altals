import {
  applyTinymistTextEdits,
  applyTinymistTextEditsToText,
} from './textEdits.js'
import { tinymistUriToFilePath } from './session.js'

function normalizeTextEdit(edit = {}) {
  if (!edit?.range) return null
  return {
    range: edit.range,
    newText: String(edit?.newText || ''),
  }
}

function collectWorkspaceChanges(workspaceEdit = {}) {
  const grouped = new Map()

  function pushEdits(uri, edits = []) {
    const filePath = tinymistUriToFilePath(uri)
    if (!filePath) return

    const normalized = edits.map(normalizeTextEdit).filter(Boolean)
    if (normalized.length === 0) return

    const existing = grouped.get(filePath) || []
    existing.push(...normalized)
    grouped.set(filePath, existing)
  }

  if (workspaceEdit?.changes && typeof workspaceEdit.changes === 'object') {
    for (const [uri, edits] of Object.entries(workspaceEdit.changes)) {
      pushEdits(uri, Array.isArray(edits) ? edits : [])
    }
  }

  if (Array.isArray(workspaceEdit?.documentChanges)) {
    for (const change of workspaceEdit.documentChanges) {
      if (Array.isArray(change?.edits) && change?.textDocument?.uri) {
        pushEdits(change.textDocument.uri, change.edits)
      }
    }
  }

  return [...grouped.entries()].map(([filePath, edits]) => ({
    filePath,
    edits,
  }))
}

export function normalizeTinymistWorkspaceEdit(workspaceEdit = {}) {
  return collectWorkspaceChanges(workspaceEdit)
}

export async function applyTinymistWorkspaceEdit(workspaceEdit, options = {}) {
  const { filesStore, editorStore } = options
  const fileEdits = normalizeTinymistWorkspaceEdit(workspaceEdit)
  const appliedFiles = []
  const skippedFiles = []

  for (const entry of fileEdits) {
    const { filePath, edits } = entry
    const openViews = typeof editorStore?.getEditorViewsForPath === 'function'
      ? editorStore.getEditorViewsForPath(filePath)
      : []

    if (openViews.length > 0) {
      let appliedToView = false
      for (const view of openViews) {
        appliedToView = applyTinymistTextEdits(view, edits) || appliedToView
      }
      if (appliedToView) {
        filesStore.fileContents[filePath] = openViews[0].state.doc.toString()
        appliedFiles.push(filePath)
      } else {
        skippedFiles.push(filePath)
      }
      continue
    }

    let content = filesStore?.fileContents?.[filePath]
    if (content === undefined) {
      content = await filesStore.readFile(filePath)
    }
    if (typeof content !== 'string') {
      skippedFiles.push(filePath)
      continue
    }

    const nextContent = applyTinymistTextEditsToText(content, edits)
    await filesStore.saveFile(filePath, nextContent)
    appliedFiles.push(filePath)
  }

  return {
    appliedFiles,
    skippedFiles,
    totalFiles: fileEdits.length,
    totalEdits: fileEdits.reduce((sum, entry) => sum + entry.edits.length, 0),
  }
}
