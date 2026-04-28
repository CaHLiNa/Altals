import { invoke } from '@tauri-apps/api/core'

export async function resolveDocumentOutlineItems(filePath, options = {}) {
  const normalizedPath = String(filePath || '').trim()
  if (!normalizedPath) return []

  const contentOverrides = options.contentOverrides && typeof options.contentOverrides === 'object'
    ? options.contentOverrides
    : {}

  return invoke('document_outline_resolve', {
    params: {
      filePath: normalizedPath,
      content: String(options.content || ''),
      workspacePath: String(options.workspacePath || '').trim(),
      flatFiles: Array.isArray(options.flatFiles)
        ? options.flatFiles
            .map((entry) => (typeof entry === 'string' ? entry : entry?.path || ''))
            .map((path) => String(path || '').trim())
            .filter(Boolean)
        : [],
      includeHidden: options.includeHidden !== false,
      contentOverrides,
    },
  })
}
