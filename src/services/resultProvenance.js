const liveProvenance = new Map()
const PROVENANCE_EVENT = 'result-provenance-updated'

function stableHash(input = '') {
  let hash = 2166136261
  const text = String(input || '')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

function stringifyData(value) {
  if (Array.isArray(value)) return value.join('')
  return value == null ? '' : String(value)
}

function inferArtifactKind(outputs = []) {
  for (const output of outputs || []) {
    const data = output?.data || {}
    if (data['image/png'] || data['image/jpeg'] || data['image/svg+xml']) return 'image'
    if (typeof data['text/html'] === 'string' && /<table[\s>]/i.test(data['text/html'])) return 'table'
    if (Array.isArray(data['text/html']) && /<table[\s>]/i.test(data['text/html'].join(''))) return 'table'
    if (data['text/plain']) {
      const text = stringifyData(data['text/plain']).trim()
      if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(text)) return 'scalar'
      if (text.includes('\t') || /\n/.test(text)) return 'table'
      return 'text'
    }
  }
  return outputs.some(output => output?.output_type === 'error') ? 'error' : 'text'
}

export function buildSourceSignature(source = '') {
  return stableHash(String(source || '').trim())
}

export function classifyExecutionFailure(message = '', outputs = []) {
  const combined = [
    String(message || ''),
    ...(outputs || []).map((output) => [output?.ename, output?.evalue, ...(output?.traceback || [])].join('\n')),
  ].join('\n')

  if (/command not found|no such file or directory|not recognized as an internal or external command/i.test(combined)) {
    return {
      code: 'missing-command',
      hintKey: 'A required command or executable was not found. Check your environment setup and PATH.',
    }
  }
  if (/NoKernel|kernel.*not found|No Jupyter kernels available/i.test(combined)) {
    return {
      code: 'missing-kernel',
      hintKey: 'No usable Jupyter kernel is available yet. Install the matching kernel and re-detect the environment.',
    }
  }
  if (/timeout|timed out|deadline exceeded/i.test(combined)) {
    return {
      code: 'timeout',
      hintKey: 'Execution timed out. Try restarting the kernel or simplifying the cell before rerunning.',
    }
  }
  if (/ModuleNotFoundError|ImportError|No module named/i.test(combined)) {
    return {
      code: 'missing-package',
      hintKey: 'A required package is missing from the active environment. Install the package and rerun the cell.',
    }
  }
  if (/file not found|cannot open|No such file|Path does not exist/i.test(combined)) {
    return {
      code: 'path-error',
      hintKey: 'A referenced file or path could not be resolved. Check the working directory and input paths.',
    }
  }
  return {
    code: 'generic',
    hintKey: 'Execution failed. Review the output above for details, then retry after fixing the upstream issue.',
  }
}

export function getResultStatusLabelKey(status = 'idle') {
  switch (status) {
    case 'running':
      return 'Running'
    case 'fresh':
      return 'Result up to date'
    case 'error':
      return 'Run failed'
    case 'stale':
      return 'Result is stale'
    default:
      return 'Not run'
  }
}

export function getResultStatusTone(status = 'idle') {
  switch (status) {
    case 'running':
      return 'info'
    case 'fresh':
      return 'success'
    case 'error':
      return 'danger'
    case 'stale':
      return 'warning'
    default:
      return 'muted'
  }
}

export function buildNotebookCellProvenance({
  filePath,
  cellId,
  cellIndex,
  source,
  outputs = [],
  status = 'fresh',
  generatedAt = new Date().toISOString(),
  executionCount = null,
  errorHint = '',
} = {}) {
  return {
    producerType: 'notebook-cell',
    producerId: cellId,
    producerLabel: `cell-${cellIndex + 1}`,
    sourceFile: filePath,
    sourceSignature: buildSourceSignature(source),
    artifactKind: inferArtifactKind(outputs),
    generatedAt,
    status,
    executionCount,
    errorHint,
  }
}

export function buildChunkProvenance({
  filePath,
  chunkKey,
  language,
  source,
  outputs = [],
  status = 'fresh',
  generatedAt = new Date().toISOString(),
  errorHint = '',
} = {}) {
  return {
    producerType: 'chunk',
    producerId: chunkKey,
    producerLabel: language || 'chunk',
    sourceFile: filePath,
    sourceSignature: buildSourceSignature(source),
    artifactKind: inferArtifactKind(outputs),
    generatedAt,
    status,
    errorHint,
  }
}

export function producerRegistryKey(meta = {}) {
  return `${meta.producerType || 'unknown'}::${meta.sourceFile || ''}::${meta.producerId || ''}`
}

export function registerLiveProvenance(meta = {}) {
  const key = producerRegistryKey(meta)
  liveProvenance.set(key, { ...meta })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROVENANCE_EVENT, {
      detail: {
        key,
        meta: { ...meta },
      },
    }))
  }
  return key
}

export function getLiveProvenance(meta = {}) {
  return liveProvenance.get(producerRegistryKey(meta)) || null
}

export function markLiveProvenanceStatus(meta = {}, status = 'stale', extra = {}) {
  const current = getLiveProvenance(meta) || meta
  return registerLiveProvenance({
    ...current,
    ...extra,
    status,
  })
}

export function serializeResultProvenanceComment(meta = {}) {
  const payload = JSON.stringify(meta)
  const filePath = String(meta.targetFile || '')
  if (/\.te?x$/i.test(filePath) || /\.latex$/i.test(filePath)) {
    return `% result_provenance: ${payload}`
  }
  if (/\.typ$/i.test(filePath)) {
    return `// result_provenance: ${payload}`
  }
  return `<!-- result_provenance: ${payload} -->`
}

export function parseResultProvenanceComments(text = '') {
  const source = String(text || '')
  const matches = []
  const patterns = [
    /<!--\s*result_provenance:\s*({.+?})\s*-->/g,
    /^%+\s*result_provenance:\s*({.+})$/gm,
    /^\/\/\s*result_provenance:\s*({.+})$/gm,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(source)) !== null) {
      try {
        matches.push({
          from: match.index,
          to: match.index + match[0].length,
          meta: JSON.parse(match[1]),
        })
      } catch {
        // Ignore malformed comments so they stay visible in the document.
      }
    }
  }
  return matches
}

export function extractPrimaryArtifact(outputs = []) {
  for (const output of outputs || []) {
    const data = output?.data || {}
    if (data['image/png']) {
      return { kind: 'image', extension: 'png', mimeType: 'image/png', content: stringifyData(data['image/png']).trim() }
    }
    if (data['image/jpeg']) {
      return { kind: 'image', extension: 'jpg', mimeType: 'image/jpeg', content: stringifyData(data['image/jpeg']).trim() }
    }
    if (data['image/svg+xml']) {
      return { kind: 'image', extension: 'svg', mimeType: 'image/svg+xml', content: stringifyData(data['image/svg+xml']) }
    }
    if (data['text/html'] && /<table[\s>]/i.test(stringifyData(data['text/html']))) {
      return { kind: 'table', mimeType: 'text/html', content: stringifyData(data['text/html']) }
    }
    if (data['text/plain']) {
      const text = stringifyData(data['text/plain']).trim()
      if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(text)) {
        return { kind: 'scalar', mimeType: 'text/plain', content: text }
      }
      if (text) {
        return { kind: 'text', mimeType: 'text/plain', content: text }
      }
    }
  }
  return null
}

export function htmlTableToMarkdown(html = '') {
  if (typeof DOMParser === 'undefined') {
    return stringifyData(html)
  }
  try {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
    const rows = [...doc.querySelectorAll('tr')].map((row) => (
      [...row.querySelectorAll('th,td')].map((cell) => cell.textContent?.trim() || '')
    )).filter((row) => row.length > 0)
    if (rows.length === 0) return stringifyData(html)
    const header = rows[0]
    const divider = header.map(() => '---')
    const body = rows.slice(1)
    return [
      `| ${header.join(' | ')} |`,
      `| ${divider.join(' | ')} |`,
      ...body.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n')
  } catch {
    return stringifyData(html)
  }
}

export function getResultProvenanceEventName() {
  return PROVENANCE_EVENT
}

export function normalizeEnvironmentHealth(entries = []) {
  return (entries || []).map((entry) => ({
    id: entry.id,
    label: entry.label,
    status: entry.status,
    detail: entry.detail || '',
  }))
}
