import { invoke } from '@tauri-apps/api/core'

const WORKSPACE_SAVE_POINT_INDEX_DIR = 'snapshots'
const WORKSPACE_SAVE_POINT_INDEX_FILE = 'workspace-save-points.json'
const WORKSPACE_SAVE_POINT_INDEX_VERSION = 1

function normalizeSnapshotValue(value = '') {
  return String(value || '').trim()
}

function normalizeSnapshotManifest(manifest = null) {
  const version = Number.parseInt(manifest?.version, 10)
  const scope = normalizeSnapshotValue(manifest?.scope)
  const kind = normalizeSnapshotValue(manifest?.kind)
  if (!version || !scope || !kind) {
    return null
  }

  return {
    version,
    scope,
    kind,
  }
}

function buildWorkspaceSavePointKey(snapshot = null) {
  const sourceId = normalizeSnapshotValue(snapshot?.sourceId)
  if (sourceId) {
    return `source:${sourceId}`
  }

  return `synthetic:${normalizeSnapshotValue(snapshot?.createdAt)}:${normalizeSnapshotValue(snapshot?.message)}`
}

function normalizeSnapshotDate(value = '') {
  const normalized = normalizeSnapshotValue(value)
  if (!normalized) {
    return ''
  }

  const timestamp = Date.parse(normalized)
  return Number.isNaN(timestamp) ? normalized : new Date(timestamp).toISOString()
}

function sortWorkspaceSavePointsDesc(entries = []) {
  return [...entries].sort((left, right) => {
    const leftTime = Date.parse(left?.createdAt || '')
    const rightTime = Date.parse(right?.createdAt || '')
    const normalizedLeft = Number.isNaN(leftTime) ? Number.NEGATIVE_INFINITY : leftTime
    const normalizedRight = Number.isNaN(rightTime) ? Number.NEGATIVE_INFINITY : rightTime
    return normalizedRight - normalizedLeft
  })
}

export function resolveWorkspaceSavePointIndexDir(workspaceDataDir = '') {
  const normalized = normalizeSnapshotValue(workspaceDataDir)
  return normalized ? `${normalized}/${WORKSPACE_SAVE_POINT_INDEX_DIR}` : ''
}

export function resolveWorkspaceSavePointIndexPath(workspaceDataDir = '') {
  const dir = resolveWorkspaceSavePointIndexDir(workspaceDataDir)
  return dir ? `${dir}/${WORKSPACE_SAVE_POINT_INDEX_FILE}` : ''
}

export function createEmptyWorkspaceSavePointIndex() {
  return {
    version: WORKSPACE_SAVE_POINT_INDEX_VERSION,
    entries: [],
  }
}

export function createLocalWorkspaceSavePointRecord({
  snapshot = null,
} = {}) {
  const scope = normalizeSnapshotValue(snapshot?.scope)
  if (scope !== 'workspace') {
    return null
  }

  const sourceId = normalizeSnapshotValue(snapshot?.sourceId)
  const createdAt = normalizeSnapshotDate(snapshot?.createdAt) || new Date().toISOString()
  const message = normalizeSnapshotValue(snapshot?.message)
  const rawMessage = normalizeSnapshotValue(snapshot?.rawMessage) || message
  const kind = normalizeSnapshotValue(snapshot?.kind)
  const label = normalizeSnapshotValue(snapshot?.label)
  const manifest = normalizeSnapshotManifest(snapshot?.manifest)
  const idSuffix = sourceId || `${createdAt}:${message}`

  return {
    id: `local:workspace:${idSuffix}`,
    backend: 'local',
    sourceKind: 'workspace-save-point',
    sourceId,
    scope: 'workspace',
    filePath: '',
    kind,
    label,
    message,
    rawMessage,
    createdAt,
    manifest,
  }
}

export function mergeWorkspaceSavePointEntries({
  localEntries = [],
  gitEntries = [],
} = {}) {
  const merged = []
  const seen = new Set()

  for (const entry of localEntries) {
    const key = buildWorkspaceSavePointKey(entry)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(entry)
  }

  for (const entry of gitEntries) {
    const key = buildWorkspaceSavePointKey(entry)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(entry)
  }

  return sortWorkspaceSavePointsDesc(merged)
}

export function createWorkspaceLocalSnapshotStoreRuntime({
  readFileImpl = async (path) => invoke('read_file', { path }),
  writeFileImpl = async (path, content) => invoke('write_file', { path, content }),
  createDirImpl = async (path) => invoke('create_dir', { path }),
} = {}) {
  async function readWorkspaceSavePointIndex({
    workspaceDataDir = '',
  } = {}) {
    const indexPath = resolveWorkspaceSavePointIndexPath(workspaceDataDir)
    if (!indexPath) {
      return createEmptyWorkspaceSavePointIndex()
    }

    try {
      const raw = await readFileImpl(indexPath)
      const parsed = JSON.parse(raw)
      const entries = Array.isArray(parsed?.entries)
        ? parsed.entries
          .map((entry) => createLocalWorkspaceSavePointRecord({ snapshot: entry }))
          .filter(Boolean)
        : []
      return {
        version: WORKSPACE_SAVE_POINT_INDEX_VERSION,
        entries: sortWorkspaceSavePointsDesc(entries),
      }
    } catch {
      return createEmptyWorkspaceSavePointIndex()
    }
  }

  async function writeWorkspaceSavePointIndex({
    workspaceDataDir = '',
    entries = [],
  } = {}) {
    const indexDir = resolveWorkspaceSavePointIndexDir(workspaceDataDir)
    const indexPath = resolveWorkspaceSavePointIndexPath(workspaceDataDir)
    if (!indexDir || !indexPath) {
      return false
    }

    await createDirImpl(indexDir).catch(() => {})
    await writeFileImpl(indexPath, JSON.stringify({
      version: WORKSPACE_SAVE_POINT_INDEX_VERSION,
      entries: sortWorkspaceSavePointsDesc(entries),
    }, null, 2))
    return true
  }

  async function loadWorkspaceSavePointEntries({
    workspaceDataDir = '',
  } = {}) {
    const index = await readWorkspaceSavePointIndex({ workspaceDataDir })
    return index.entries
  }

  async function syncWorkspaceSavePointEntries({
    workspaceDataDir = '',
    snapshots = [],
  } = {}) {
    if (!workspaceDataDir) {
      return []
    }

    const current = await loadWorkspaceSavePointEntries({ workspaceDataDir })
    const incoming = snapshots
      .map((snapshot) => createLocalWorkspaceSavePointRecord({ snapshot }))
      .filter(Boolean)
    const nextEntries = mergeWorkspaceSavePointEntries({
      localEntries: current,
      gitEntries: incoming,
    })
    await writeWorkspaceSavePointIndex({
      workspaceDataDir,
      entries: nextEntries,
    })
    return nextEntries
  }

  async function recordWorkspaceSavePoint({
    workspaceDataDir = '',
    snapshot = null,
  } = {}) {
    const entry = createLocalWorkspaceSavePointRecord({ snapshot })
    if (!workspaceDataDir || !entry) {
      return null
    }

    const current = await loadWorkspaceSavePointEntries({ workspaceDataDir })
    const nextEntries = sortWorkspaceSavePointsDesc([
      entry,
      ...current.filter((existing) => buildWorkspaceSavePointKey(existing) !== buildWorkspaceSavePointKey(entry)),
    ])
    await writeWorkspaceSavePointIndex({
      workspaceDataDir,
      entries: nextEntries,
    })
    return entry
  }

  return {
    loadWorkspaceSavePointEntries,
    syncWorkspaceSavePointEntries,
    recordWorkspaceSavePoint,
  }
}
