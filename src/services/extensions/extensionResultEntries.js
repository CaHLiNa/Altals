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

function buildArtifactPreviewEntry(artifact = {}, index = 0) {
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

function buildArtifactPreviewEntries(artifacts = []) {
  return (Array.isArray(artifacts) ? artifacts : [])
    .map((artifact, index) => buildArtifactPreviewEntry(artifact, index))
    .filter(Boolean)
}

function buildStructuredOutputEntries(outputs = []) {
  return (Array.isArray(outputs) ? outputs : [])
    .map((output, index) => {
      const id = normalizeText(output?.id) || `result-output:${index + 1}`
      const outputType = normalizeText(output?.type || output?.outputType || output?.output_type).toLowerCase()
      const mediaType = normalizeText(output?.mediaType || output?.media_type)
      const label = normalizeText(output?.title) || normalizeText(output?.label)
      const description = normalizeText(output?.description)
      const text = normalizeText(output?.text)
      const html = normalizeText(output?.html)

      if (outputType === 'inlinetext' && text) {
        return {
          id,
          label: label || 'Inline Text Output',
          description,
          action: 'open',
          previewMode: 'text',
          previewTitle: label || 'Inline Text Output',
          mediaType: mediaType || 'text/plain',
          payload: { text },
        }
      }

      if (outputType === 'inlinehtml' && html) {
        return {
          id,
          label: label || 'Inline HTML Output',
          description,
          action: 'open',
          previewMode: 'html',
          previewTitle: label || 'Inline HTML Output',
          mediaType: mediaType || 'text/html',
          payload: { html },
        }
      }

      return null
    })
    .filter(Boolean)
}

export function buildDefaultResultEntries({
  artifacts = [],
  outputs = [],
} = {}) {
  return [
    ...buildArtifactPreviewEntries(artifacts),
    ...buildStructuredOutputEntries(outputs),
  ]
}

export function mergeDefaultResultEntries({
  existingEntries = [],
  artifacts = [],
  outputs = [],
} = {}) {
  const preserved = Array.isArray(existingEntries) ? existingEntries : []
  const generated = buildDefaultResultEntries({ artifacts, outputs })
  if (!generated.length) return preserved

  const generatedIds = new Set(generated.map((entry) => entry.id))
  const filteredPreserved = preserved.filter((entry) => !generatedIds.has(normalizeText(entry?.id)))
  return [...filteredPreserved, ...generated]
}

export {
  buildArtifactPreviewEntries as buildExtensionArtifactPreviewEntries,
  buildArtifactPreviewEntry as extensionArtifactToPreviewEntry,
  titleCaseKey,
}
