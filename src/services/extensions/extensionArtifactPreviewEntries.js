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
  const commandId = normalizeText(task?.commandId)
  const extensionId = normalizeText(task?.extensionId)
  const targetPath = normalizeText(task?.target?.path)
  const targetKind = normalizeText(task?.target?.kind)
  const referenceId = normalizeText(task?.target?.referenceId)
  const logPath = normalizeText(task?.logPath || task?.log_path)

  if (logPath) {
    results.push({
      id: `${normalizeText(task?.id) || 'task'}:log`,
      label: 'Task Log',
      description: logPath,
      path: logPath,
      action: 'open',
      previewMode: 'text',
      previewPath: logPath,
      previewTitle: 'Task Log',
      mediaType: 'text/plain',
    })
  }

  if (commandId && extensionId && targetPath) {
    results.push({
      id: `${normalizeText(task?.id) || 'task'}:rerun`,
      label: 'Run Again',
      description: 'Repeat this extension task with the same target.',
      action: 'execute-command',
      commandId,
      extensionId,
      targetPath,
      targetKind,
      referenceId,
      payload: {
        settings: task?.settings && typeof task.settings === 'object' ? task.settings : {},
      },
    })
  }

  return results
}

export {
  buildExtensionArtifactPreviewEntries,
  extensionArtifactToPreviewEntry,
  titleCaseKey,
}
