import { invoke } from '@tauri-apps/api/core'

const HIDDEN_HISTORY_INDEX_DIR = 'snapshots'
const HIDDEN_HISTORY_INDEX_FILE = 'hidden-history.json'
const HIDDEN_HISTORY_INDEX_VERSION = 1

function normalizeValue(value = '') {
  return String(value || '').trim()
}

function normalizePath(value = '') {
  return normalizeValue(value).replace(/\\/g, '/')
}

function normalizeDate(value = '') {
  const normalized = normalizeValue(value)
  if (!normalized) {
    return ''
  }

  const timestamp = Date.parse(normalized)
  return Number.isNaN(timestamp) ? normalized : new Date(timestamp).toISOString()
}

export function resolveHiddenHistoryIndexDir(workspaceDataDir = '') {
  const normalized = normalizeValue(workspaceDataDir)
  return normalized ? `${normalized}/${HIDDEN_HISTORY_INDEX_DIR}` : ''
}

export function resolveHiddenHistoryIndexPath(workspaceDataDir = '') {
  const dir = resolveHiddenHistoryIndexDir(workspaceDataDir)
  return dir ? `${dir}/${HIDDEN_HISTORY_INDEX_FILE}` : ''
}

export function createEmptyHiddenHistoryIndex() {
  return {
    version: HIDDEN_HISTORY_INDEX_VERSION,
    entries: [],
  }
}

export function buildHiddenHistoryEntryKey(snapshot = null) {
  const scope = normalizeValue(snapshot?.scope)
  const filePath = normalizePath(snapshot?.filePath)
  const sourceId = normalizeValue(snapshot?.sourceId)
  const createdAt = normalizeDate(snapshot?.createdAt)
  const message = normalizeValue(snapshot?.rawMessage || snapshot?.message)

  if (!scope) {
    return ''
  }

  if (sourceId) {
    return `${scope}:${filePath}:${sourceId}`
  }

  return `${scope}:${filePath}:${createdAt}:${message}`
}

export function createHiddenHistoryEntry({ snapshot = null, hiddenAt = '' } = {}) {
  const key = buildHiddenHistoryEntryKey(snapshot)
  if (!key) {
    return null
  }

  return {
    key,
    scope: normalizeValue(snapshot?.scope),
    filePath: normalizePath(snapshot?.filePath),
    sourceId: normalizeValue(snapshot?.sourceId),
    createdAt: normalizeDate(snapshot?.createdAt),
    message: normalizeValue(snapshot?.message),
    hiddenAt: normalizeDate(hiddenAt) || new Date().toISOString(),
  }
}

export function isHistoryEntryHidden({ snapshot = null, hiddenEntries = [] } = {}) {
  const key = buildHiddenHistoryEntryKey(snapshot)
  if (!key) {
    return false
  }

  return hiddenEntries.some((entry) => entry?.key === key)
}

export function filterVisibleHistoryEntries({ snapshots = [], hiddenEntries = [] } = {}) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return []
  }
  if (!Array.isArray(hiddenEntries) || hiddenEntries.length === 0) {
    return [...snapshots]
  }

  return snapshots.filter((snapshot) => !isHistoryEntryHidden({ snapshot, hiddenEntries }))
}

export function createWorkspaceHistoryVisibilityRuntime({
  readFileImpl = async (path) => invoke('read_file', { path }),
  writeFileImpl = async (path, content) => invoke('write_file', { path, content }),
  createDirImpl = async (path) => invoke('create_dir', { path }),
  nowImpl = () => new Date(),
} = {}) {
  async function readHiddenHistoryIndex({ workspaceDataDir = '' } = {}) {
    const indexPath = resolveHiddenHistoryIndexPath(workspaceDataDir)
    if (!indexPath) {
      return createEmptyHiddenHistoryIndex()
    }

    try {
      const raw = await readFileImpl(indexPath)
      const parsed = JSON.parse(raw)
      const entries = Array.isArray(parsed?.entries)
        ? parsed.entries
            .map((entry) =>
              createHiddenHistoryEntry({
                snapshot: entry,
                hiddenAt: entry?.hiddenAt,
              })
            )
            .filter(Boolean)
        : []
      return {
        version: HIDDEN_HISTORY_INDEX_VERSION,
        entries,
      }
    } catch {
      return createEmptyHiddenHistoryIndex()
    }
  }

  async function writeHiddenHistoryIndex({ workspaceDataDir = '', entries = [] } = {}) {
    const indexDir = resolveHiddenHistoryIndexDir(workspaceDataDir)
    const indexPath = resolveHiddenHistoryIndexPath(workspaceDataDir)
    if (!indexDir || !indexPath) {
      return false
    }

    await createDirImpl(indexDir).catch(() => {})
    await writeFileImpl(
      indexPath,
      JSON.stringify(
        {
          version: HIDDEN_HISTORY_INDEX_VERSION,
          entries,
        },
        null,
        2
      )
    )
    return true
  }

  async function loadHiddenHistoryEntries({ workspaceDataDir = '' } = {}) {
    const index = await readHiddenHistoryIndex({ workspaceDataDir })
    return index.entries
  }

  async function hideHistoryEntry({ workspaceDataDir = '', snapshot = null } = {}) {
    const entry = createHiddenHistoryEntry({
      snapshot,
      hiddenAt: nowImpl().toISOString(),
    })
    if (!workspaceDataDir || !entry) {
      return null
    }

    const current = await loadHiddenHistoryEntries({ workspaceDataDir })
    const nextEntries = [entry, ...current.filter((existing) => existing?.key !== entry.key)]
    await writeHiddenHistoryIndex({
      workspaceDataDir,
      entries: nextEntries,
    })
    return entry
  }

  async function filterVisibleEntries({ workspaceDataDir = '', snapshots = [] } = {}) {
    if (!workspaceDataDir || !Array.isArray(snapshots) || snapshots.length === 0) {
      return Array.isArray(snapshots) ? [...snapshots] : []
    }

    const hiddenEntries = await loadHiddenHistoryEntries({ workspaceDataDir })
    return filterVisibleHistoryEntries({
      snapshots,
      hiddenEntries,
    })
  }

  return {
    loadHiddenHistoryEntries,
    hideHistoryEntry,
    filterVisibleEntries,
  }
}
