import { getWorkspaceHistoryMessageKind } from './workspaceHistoryMessageRuntime.js'
import {
  createWorkspaceLocalSnapshotStoreRuntime,
  mergeWorkspaceSavePointEntries,
} from './workspaceLocalSnapshotStoreRuntime.js'
import {
  getWorkspaceSnapshotManifestKind,
  getWorkspaceSnapshotManifestScope,
  parseWorkspaceSnapshotPersistedMessage,
} from './workspaceSnapshotManifestRuntime.js'
import { createWorkspaceVersionHistoryRuntime } from './workspaceVersionHistoryRuntime.js'

function normalizeSnapshotMessage(value = '') {
  return String(value || '').trim()
}

function resolveWorkspaceSnapshotScope({
  filePath = '',
  manifest = null,
} = {}) {
  const manifestScope = getWorkspaceSnapshotManifestScope({ manifest })
  if (manifestScope) {
    return manifestScope
  }

  return filePath ? 'file' : 'workspace'
}

function buildWorkspaceSnapshotId(sourceId = '', fallbackKey = '') {
  if (sourceId) {
    return `git:${sourceId}`
  }
  return `git:synthetic:${fallbackKey}`
}

export function createWorkspaceSnapshotRecord({
  entry = {},
  filePath = '',
  t,
} = {}) {
  const normalizedFilePath = String(filePath || '').trim()
  const parsedMessage = parseWorkspaceSnapshotPersistedMessage(entry?.message)
  const rawMessage = normalizeSnapshotMessage(parsedMessage.rawMessage)
  const message = normalizeSnapshotMessage(parsedMessage.message)
  const sourceId = String(entry?.hash || '').trim()
  const createdAt = String(entry?.date || '').trim()
  const manifest = parsedMessage.manifest
  const kind = getWorkspaceSnapshotManifestKind({ manifest })
    || getWorkspaceHistoryMessageKind({ message, t })
  const scope = resolveWorkspaceSnapshotScope({
    filePath: normalizedFilePath,
    manifest,
  })

  return {
    id: buildWorkspaceSnapshotId(sourceId, `${filePath}:${message}:${createdAt}`),
    backend: 'git',
    sourceKind: 'git-commit',
    sourceId,
    scope,
    filePath: normalizedFilePath,
    kind,
    label: kind === 'named' ? message : '',
    message,
    rawMessage,
    createdAt,
    manifest,
  }
}

export function isNamedWorkspaceSnapshot(snapshot = null) {
  return String(snapshot?.kind || '') === 'named'
}

export function isFileWorkspaceSnapshot(snapshot = null) {
  return String(snapshot?.scope || '').trim() === 'file'
}

export function isWorkspaceFeedWorkspaceSnapshot(snapshot = null) {
  return String(snapshot?.scope || '').trim() === 'workspace' && !!snapshot?.manifest
}

export function getWorkspaceSnapshotDisplayMessage(snapshot = null) {
  return String(snapshot?.message || '').trim()
}

export function createWorkspaceSnapshotRuntime({
  versionHistoryRuntime = createWorkspaceVersionHistoryRuntime(),
  localSnapshotStoreRuntime = createWorkspaceLocalSnapshotStoreRuntime(),
  createSnapshotRecordImpl = createWorkspaceSnapshotRecord,
  mergeWorkspaceSavePointEntriesImpl = mergeWorkspaceSavePointEntries,
} = {}) {
  function mapWorkspaceSnapshotEntries({
    entries = [],
    filePath = '',
    t,
  } = {}) {
    return entries.map((entry) => createSnapshotRecordImpl({
      entry,
      filePath,
      t,
    }))
  }

  async function listFileVersionHistoryEntries({
    workspacePath = '',
    filePath = '',
    limit = 50,
    t,
  } = {}) {
    if (!workspacePath || !filePath) {
      return []
    }

    const entries = await versionHistoryRuntime.loadFileHistory({
      workspacePath,
      filePath,
      limit,
    })

    return mapWorkspaceSnapshotEntries({
      entries,
      filePath,
      t,
    })
  }

  async function listWorkspaceSavePointEntries({
    workspacePath = '',
    workspaceDataDir = '',
    limit = 50,
    t,
  } = {}) {
    if (!workspacePath) {
      return []
    }

    const [localEntries, entries] = await Promise.all([
      localSnapshotStoreRuntime.loadWorkspaceSavePointEntries({
        workspaceDataDir,
      }),
      versionHistoryRuntime.loadWorkspaceHistory({
        workspacePath,
        limit,
      }),
    ])

    const gitSnapshots = mapWorkspaceSnapshotEntries({
      entries,
      t,
    }).filter((snapshot) => isWorkspaceFeedWorkspaceSnapshot(snapshot))

    let synchronizedLocalEntries = localEntries
    if (
      workspaceDataDir
      && gitSnapshots.length > 0
      && typeof localSnapshotStoreRuntime.syncWorkspaceSavePointEntries === 'function'
    ) {
      synchronizedLocalEntries = await localSnapshotStoreRuntime.syncWorkspaceSavePointEntries({
        workspaceDataDir,
        snapshots: gitSnapshots,
      }).catch(() => localEntries)
    }

    const snapshots = mergeWorkspaceSavePointEntriesImpl({
      localEntries: synchronizedLocalEntries,
      gitEntries: gitSnapshots,
    })

    if (!Number.isInteger(limit) || limit <= 0) {
      return snapshots
    }

    return snapshots.slice(0, limit)
  }

  async function loadFileVersionHistoryPreview({
    workspacePath = '',
    filePath = '',
    snapshot = null,
  } = {}) {
    const sourceId = String(snapshot?.sourceId || '').trim()
    if (!workspacePath || !filePath || !sourceId || !isFileWorkspaceSnapshot(snapshot)) {
      return ''
    }

    return versionHistoryRuntime.loadFileHistoryPreview({
      workspacePath,
      filePath,
      commitHash: sourceId,
    })
  }

  async function restoreFileVersionHistoryEntry({
    workspacePath = '',
    filePath = '',
    snapshot = null,
    reloadFileImpl,
  } = {}) {
    const sourceId = String(snapshot?.sourceId || '').trim()
    if (!workspacePath || !filePath || !sourceId) {
      return { restored: false, reason: 'missing-input' }
    }
    if (!isFileWorkspaceSnapshot(snapshot)) {
      return { restored: false, reason: 'unsupported-scope' }
    }

    return versionHistoryRuntime.restoreFileHistoryEntry({
      workspacePath,
      filePath,
      commitHash: sourceId,
      reloadFileImpl,
    })
  }

  return {
    listFileVersionHistoryEntries,
    listWorkspaceSavePointEntries,
    loadFileVersionHistoryPreview,
    restoreFileVersionHistoryEntry,
  }
}
