import {
  buildExtensionArtifactPreviewEntries,
  mergeDefaultResultEntries,
  titleCaseKey,
  extensionArtifactToPreviewEntry,
} from './extensionResultEntries.js'

function normalizeText(value = '') {
  return String(value || '').trim()
}

export function buildExtensionTaskResultEntries(task = {}) {
  const explicitEntries = Array.isArray(task?.resultEntries) ? task.resultEntries : []
  const results = mergeDefaultResultEntries({
    existingEntries: explicitEntries,
    artifacts: task?.artifacts,
    outputs: task?.outputs,
  })
  return results
}

export {
  buildExtensionArtifactPreviewEntries,
  extensionArtifactToPreviewEntry,
  titleCaseKey,
}
