function normalizeText(value = '') {
  return String(value || '').trim()
}

function titleCaseKey(value = '') {
  return value
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function titleForArtifact(artifact = {}) {
  const kind = normalizeText(artifact.kind)
  if (!kind) return 'Artifact Preview'
  return titleCaseKey(kind)
}

export function extensionArtifactToPreviewEntry(artifact = {}, index = 0) {
  const path = normalizeText(artifact.path)
  if (!path) return null
  const mediaType = normalizeText(artifact.mediaType || artifact.media_type)
  const title = titleForArtifact(artifact)
  const lowerPath = path.toLowerCase()

  let previewMode = ''
  if (mediaType === 'application/pdf' || lowerPath.endsWith('.pdf')) {
    previewMode = 'pdf'
  } else if (mediaType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerPath)) {
    previewMode = 'image'
  } else if (mediaType === 'text/html' || /\.html?$/i.test(lowerPath)) {
    previewMode = 'html'
  } else if (
    mediaType.startsWith('text/') ||
    /\.(txt|md|markdown|json|log|csv|tex|py|bib)$/i.test(lowerPath)
  ) {
    previewMode = 'text'
  }

  return {
    id: normalizeText(artifact.id) || `artifact-preview:${index}`,
    label: title,
    description: path,
    path,
    action: 'open',
    previewMode,
    previewPath: path,
    previewTitle: title,
    mediaType,
  }
}

export function buildExtensionArtifactPreviewEntries(artifacts = []) {
  return (Array.isArray(artifacts) ? artifacts : [])
    .map((artifact, index) => extensionArtifactToPreviewEntry(artifact, index))
    .filter(Boolean)
}

export function buildExtensionTaskResultEntries(task = {}) {
  const results = buildExtensionArtifactPreviewEntries(task?.artifacts)
  const outputEntries = (Array.isArray(task?.outputs) ? task.outputs : [])
    .map((output, index) => {
      const outputType = normalizeText(output?.type || output?.outputType || output?.output_type)
      const mediaType = normalizeText(output?.mediaType || output?.media_type)
      const text = normalizeText(output?.text)
      const html = normalizeText(output?.html)
      if (outputType.toLowerCase() === 'inlinetext' && text) {
        const title = normalizeText(output?.title) || 'Inline Text Output'
        return {
          id: normalizeText(output?.id) || `task-output:${index + 1}`,
          label: title,
          description: normalizeText(output?.description),
          action: 'open',
          previewMode: 'text',
          previewTitle: title,
          mediaType: mediaType || 'text/plain',
          payload: {
            text,
          },
        }
      }
      if (outputType.toLowerCase() === 'inlinehtml' && html) {
        const title = normalizeText(output?.title) || 'Inline HTML Output'
        return {
          id: normalizeText(output?.id) || `task-output:${index + 1}`,
          label: title,
          description: normalizeText(output?.description),
          action: 'open',
          previewMode: 'html',
          previewTitle: title,
          mediaType: mediaType || 'text/html',
          payload: {
            html,
          },
        }
      }
      return null
    })
    .filter(Boolean)
  results.push(...outputEntries)
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

export { titleCaseKey }
