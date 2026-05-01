function normalizeText(value = '') {
  return String(value || '').trim()
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

export function mergeDefaultResultEntries({
  existingEntries = [],
  outputs = [],
} = {}) {
  const preserved = Array.isArray(existingEntries) ? existingEntries : []
  const generated = buildStructuredOutputEntries(outputs)
  if (!generated.length) return preserved

  const generatedIds = new Set(generated.map((entry) => entry.id))
  const filteredPreserved = preserved.filter((entry) => !generatedIds.has(normalizeText(entry?.id)))
  return [...filteredPreserved, ...generated]
}
