const SNAPSHOT_MANIFEST_START = '[[altals-snapshot:'
const SNAPSHOT_MANIFEST_END = ']]'
const SUPPORTED_SNAPSHOT_SCOPES = new Set(['workspace', 'file'])
const SUPPORTED_SNAPSHOT_KINDS = new Set(['named', 'save', 'auto', 'empty'])

function normalizeSnapshotManifestValue(value = '') {
  return String(value || '').trim()
}

function normalizeSnapshotManifestScope(scope = '') {
  const normalized = normalizeSnapshotManifestValue(scope)
  return SUPPORTED_SNAPSHOT_SCOPES.has(normalized) ? normalized : ''
}

function normalizeSnapshotManifestKind(kind = '') {
  const normalized = normalizeSnapshotManifestValue(kind)
  return SUPPORTED_SNAPSHOT_KINDS.has(normalized) ? normalized : ''
}

function parseSnapshotManifestPayload(payload = '') {
  const fields = String(payload || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)

  const manifest = {
    version: 0,
    scope: '',
    kind: '',
  }

  for (const field of fields) {
    const separatorIndex = field.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = field.slice(0, separatorIndex).trim()
    const value = field.slice(separatorIndex + 1).trim()
    if (!key || !value) {
      continue
    }

    if (key === 'v') {
      const version = Number.parseInt(value, 10)
      manifest.version = Number.isInteger(version) && version > 0 ? version : 0
      continue
    }

    if (key === 'scope') {
      manifest.scope = normalizeSnapshotManifestScope(value)
      continue
    }

    if (key === 'kind') {
      manifest.kind = normalizeSnapshotManifestKind(value)
    }
  }

  if (!manifest.version || !manifest.scope || !manifest.kind) {
    return null
  }

  return manifest
}

export function createWorkspaceSnapshotManifest({
  scope = '',
  kind = '',
  version = 1,
} = {}) {
  const normalizedScope = normalizeSnapshotManifestScope(scope)
  const normalizedKind = normalizeSnapshotManifestKind(kind)
  const normalizedVersion = Number.isInteger(version) && version > 0 ? version : 1

  if (!normalizedScope || !normalizedKind) {
    return null
  }

  return {
    version: normalizedVersion,
    scope: normalizedScope,
    kind: normalizedKind,
  }
}

export function parseWorkspaceSnapshotPersistedMessage(rawMessage = '') {
  const normalizedRawMessage = normalizeSnapshotManifestValue(rawMessage)
  const markerIndex = normalizedRawMessage.lastIndexOf(SNAPSHOT_MANIFEST_START)

  if (markerIndex < 0 || !normalizedRawMessage.endsWith(SNAPSHOT_MANIFEST_END)) {
    return {
      rawMessage: normalizedRawMessage,
      message: normalizedRawMessage,
      manifest: null,
    }
  }

  const payloadStart = markerIndex + SNAPSHOT_MANIFEST_START.length
  const payloadEnd = normalizedRawMessage.length - SNAPSHOT_MANIFEST_END.length
  const manifest = parseSnapshotManifestPayload(
    normalizedRawMessage.slice(payloadStart, payloadEnd),
  )

  if (!manifest) {
    return {
      rawMessage: normalizedRawMessage,
      message: normalizedRawMessage,
      manifest: null,
    }
  }

  return {
    rawMessage: normalizedRawMessage,
    message: normalizedRawMessage.slice(0, markerIndex).trimEnd(),
    manifest,
  }
}

export function buildWorkspaceSnapshotManifestTrailer(input = {}) {
  const manifest = createWorkspaceSnapshotManifest(input)
  if (!manifest) {
    return ''
  }

  return ` ${SNAPSHOT_MANIFEST_START}v=${manifest.version};scope=${manifest.scope};kind=${manifest.kind}${SNAPSHOT_MANIFEST_END}`
}

export function buildWorkspaceSnapshotPersistedMessage({
  message = '',
  scope = '',
  kind = '',
} = {}) {
  const parsed = parseWorkspaceSnapshotPersistedMessage(message)
  const trailer = buildWorkspaceSnapshotManifestTrailer({ scope, kind })
  return `${parsed.message}${trailer}`.trim()
}

export function getWorkspaceSnapshotManifestScope(snapshot = null) {
  return normalizeSnapshotManifestScope(snapshot?.manifest?.scope)
}

export function getWorkspaceSnapshotManifestKind(snapshot = null) {
  return normalizeSnapshotManifestKind(snapshot?.manifest?.kind)
}
