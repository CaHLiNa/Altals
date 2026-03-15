import { invoke } from '@tauri-apps/api/core'
import { parseNotebook, serializeNotebook } from '../utils/notebookFormat'

function readCachedContent(filePath, fileContentsCache) {
  if (!fileContentsCache) return undefined
  if (!Object.prototype.hasOwnProperty.call(fileContentsCache, filePath)) return undefined
  return fileContentsCache[filePath]
}

function writeCachedContent(filePath, content, fileContentsCache) {
  if (!fileContentsCache) return
  fileContentsCache[filePath] = content
}

export async function readNotebookDocument(filePath, fileContentsCache) {
  let content = readCachedContent(filePath, fileContentsCache)
  if (typeof content !== 'string') {
    content = await invoke('read_file', { path: filePath })
    writeCachedContent(filePath, content, fileContentsCache)
  }

  return {
    content,
    ...parseNotebook(content),
  }
}

export async function writeNotebookDocument(filePath, notebook, fileContentsCache) {
  const content = serializeNotebook(
    notebook.cells,
    notebook.metadata,
    notebook.nbformat,
    notebook.nbformatMinor,
  )
  await invoke('write_file', { path: filePath, content })
  writeCachedContent(filePath, content, fileContentsCache)
  return content
}

export async function writeNotebookDocumentPreservingPendingEdits(
  filePath,
  notebook,
  findPendingEditForCell,
  fileContentsCache,
) {
  const raw = await invoke('read_file', { path: filePath })
  const diskNotebook = parseNotebook(raw)
  const cellsById = new Map(notebook.cells.map((cell) => [cell.id, cell]))

  for (const diskCell of diskNotebook.cells) {
    const nextCell = cellsById.get(diskCell.id)
    if (!nextCell) continue

    const pending = typeof findPendingEditForCell === 'function'
      ? findPendingEditForCell(filePath, diskCell.id)
      : null

    if (!pending) {
      diskCell.source = nextCell.source
    }
  }

  const content = serializeNotebook(
    diskNotebook.cells,
    diskNotebook.metadata,
    diskNotebook.nbformat,
    diskNotebook.nbformat_minor,
  )
  await invoke('write_file', { path: filePath, content })
  writeCachedContent(filePath, content, fileContentsCache)
  return content
}
