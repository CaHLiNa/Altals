import { tinymistUriToFilePath } from './session.js'

export function normalizeTinymistLocations(result) {
  const values = Array.isArray(result)
    ? result
    : result ? [result] : []

  return values
    .map((entry) => {
      if (!entry) return null

      if (entry.targetUri) {
        return {
          filePath: tinymistUriToFilePath(entry.targetUri),
          range: entry.targetRange || null,
          targetSelectionRange: entry.targetSelectionRange || entry.targetRange || null,
        }
      }

      if (entry.uri) {
        return {
          filePath: tinymistUriToFilePath(entry.uri),
          range: entry.range || null,
          targetSelectionRange: entry.range || null,
        }
      }

      return null
    })
    .filter(location => location?.filePath)
}

export function formatTinymistLocationLabel(location = {}) {
  const filePath = String(location.filePath || '')
  const fileName = filePath.split('/').pop() || filePath || 'file'
  const line = Number.isInteger(location?.targetSelectionRange?.start?.line)
    ? location.targetSelectionRange.start.line + 1
    : Number.isInteger(location?.range?.start?.line)
      ? location.range.start.line + 1
      : null
  return line ? `${fileName}:${line}` : fileName
}
