import { invoke } from '@tauri-apps/api/core'

import { createWorkspaceHistoryPreparationRuntime } from './workspaceHistoryPreparationRuntime.js'

const WORKSPACE_SNAPSHOT_PAYLOAD_VERSION = 1
const WORKSPACE_SNAPSHOT_PAYLOAD_KIND = 'workspace-text-v1'
const WORKSPACE_SNAPSHOT_PAYLOADS_DIR = 'snapshots/payloads'
const WORKSPACE_SNAPSHOT_PAYLOAD_FILES_DIR = 'files'
const WORKSPACE_SNAPSHOT_PAYLOAD_MANIFEST_FILE = 'manifest.json'

function normalizeSnapshotValue(value = '') {
  return String(value || '').trim()
}

function normalizeSnapshotDate(value = '') {
  const normalized = normalizeSnapshotValue(value)
  if (!normalized) {
    return ''
  }

  const timestamp = Date.parse(normalized)
  return Number.isNaN(timestamp) ? normalized : new Date(timestamp).toISOString()
}

function normalizePathValue(value = '') {
  return normalizeSnapshotValue(value).replace(/\\/g, '/').replace(/\/+$/, '')
}

function sanitizePayloadKey(value = '') {
  const normalized = normalizeSnapshotValue(value).replace(/[^a-zA-Z0-9._-]+/g, '_')
  return normalized.replace(/^_+|_+$/g, '') || 'workspace-snapshot'
}

function buildWorkspaceSnapshotPayloadKey(snapshot = null) {
  const sourceId = normalizeSnapshotValue(snapshot?.sourceId)
  if (sourceId) {
    return sanitizePayloadKey(sourceId)
  }

  return sanitizePayloadKey(`${normalizeSnapshotDate(snapshot?.createdAt)}-${normalizeSnapshotValue(snapshot?.message)}`)
}

function isWorkspaceFilePath(filePath = '', workspacePath = '') {
  const normalizedFilePath = normalizePathValue(filePath)
  const normalizedWorkspacePath = normalizePathValue(workspacePath)
  if (!normalizedFilePath || !normalizedWorkspacePath) {
    return false
  }

  return normalizedFilePath === normalizedWorkspacePath
    || normalizedFilePath.startsWith(`${normalizedWorkspacePath}/`)
}

function resolveWorkspaceRelativePath(filePath = '', workspacePath = '') {
  const normalizedFilePath = normalizePathValue(filePath)
  const normalizedWorkspacePath = normalizePathValue(workspacePath)
  if (!normalizedFilePath || !normalizedWorkspacePath) {
    return ''
  }
  if (normalizedFilePath === normalizedWorkspacePath) {
    return '.'
  }
  if (!normalizedFilePath.startsWith(`${normalizedWorkspacePath}/`)) {
    return normalizedFilePath
  }
  return normalizedFilePath.slice(normalizedWorkspacePath.length + 1)
}

export function resolveWorkspaceSnapshotPayloadsDir(workspaceDataDir = '') {
  const normalized = normalizeSnapshotValue(workspaceDataDir)
  return normalized ? `${normalized}/${WORKSPACE_SNAPSHOT_PAYLOADS_DIR}` : ''
}

export function resolveWorkspaceSnapshotPayloadDir(workspaceDataDir = '', snapshot = null) {
  const payloadsDir = resolveWorkspaceSnapshotPayloadsDir(workspaceDataDir)
  if (!payloadsDir) {
    return ''
  }
  return `${payloadsDir}/${buildWorkspaceSnapshotPayloadKey(snapshot)}`
}

export function resolveWorkspaceSnapshotPayloadManifestPath(workspaceDataDir = '', snapshot = null) {
  const payloadDir = resolveWorkspaceSnapshotPayloadDir(workspaceDataDir, snapshot)
  return payloadDir ? `${payloadDir}/${WORKSPACE_SNAPSHOT_PAYLOAD_MANIFEST_FILE}` : ''
}

export function createWorkspaceSnapshotPayloadMeta(payload = null) {
  const manifestPath = normalizeSnapshotValue(payload?.manifestPath)
  const fileCount = Number.parseInt(payload?.fileCount, 10)
  if (!manifestPath || !Number.isInteger(fileCount) || fileCount <= 0) {
    return null
  }

  return {
    version: WORKSPACE_SNAPSHOT_PAYLOAD_VERSION,
    kind: WORKSPACE_SNAPSHOT_PAYLOAD_KIND,
    manifestPath,
    fileCount,
    capturedAt: normalizeSnapshotDate(payload?.capturedAt) || new Date().toISOString(),
  }
}

export function createWorkspaceSnapshotPayloadManifest({
  workspacePath = '',
  snapshot = null,
  files = [],
  payload = null,
} = {}) {
  const normalizedWorkspacePath = normalizePathValue(workspacePath)
  const normalizedPayload = createWorkspaceSnapshotPayloadMeta(payload)
  if (!normalizedWorkspacePath || !normalizedPayload || !Array.isArray(files) || files.length === 0) {
    return null
  }

  return {
    version: WORKSPACE_SNAPSHOT_PAYLOAD_VERSION,
    kind: WORKSPACE_SNAPSHOT_PAYLOAD_KIND,
    workspacePath: normalizedWorkspacePath,
    snapshot: {
      sourceId: normalizeSnapshotValue(snapshot?.sourceId),
      createdAt: normalizeSnapshotDate(snapshot?.createdAt) || normalizedPayload.capturedAt,
      message: normalizeSnapshotValue(snapshot?.message),
    },
    capturedAt: normalizedPayload.capturedAt,
    fileCount: normalizedPayload.fileCount,
    files: files.map((file) => ({
      path: normalizeSnapshotValue(file?.path),
      relativePath: normalizeSnapshotValue(file?.relativePath),
      contentPath: normalizeSnapshotValue(file?.contentPath),
    })),
  }
}

export function createWorkspaceLocalSnapshotPayloadRuntime({
  historyPreparationRuntime = createWorkspaceHistoryPreparationRuntime(),
  readFileImpl = async (path) => invoke('read_file', { path }),
  writeFileImpl = async (path, content) => invoke('write_file', { path, content }),
  createDirImpl = async (path) => invoke('create_dir', { path }),
  applyFileContentImpl = async (path, content) => invoke('write_file', { path, content }),
} = {}) {
  function collectPayloadCandidatePaths({
    workspacePath = '',
    editorStore,
  } = {}) {
    const allOpenFiles = Array.from(editorStore?.allOpenFiles || [])
    return Array.from(new Set(allOpenFiles.filter((filePath) =>
      historyPreparationRuntime.isPersistableHistoryPath(filePath)
      && isWorkspaceFilePath(filePath, workspacePath)
    )))
  }

  async function captureWorkspaceSnapshotPayload({
    workspacePath = '',
    workspaceDataDir = '',
    snapshot = null,
    editorStore,
    filesStore,
  } = {}) {
    const manifestPath = resolveWorkspaceSnapshotPayloadManifestPath(workspaceDataDir, snapshot)
    const payloadDir = resolveWorkspaceSnapshotPayloadDir(workspaceDataDir, snapshot)
    if (!workspacePath || !workspaceDataDir || !manifestPath || !payloadDir) {
      return null
    }

    const candidatePaths = collectPayloadCandidatePaths({
      workspacePath,
      editorStore,
    })
    if (candidatePaths.length === 0) {
      return null
    }

    const payloadFiles = []
    const payloadFilesDir = `${payloadDir}/${WORKSPACE_SNAPSHOT_PAYLOAD_FILES_DIR}`
    await createDirImpl(payloadDir).catch(() => {})
    await createDirImpl(payloadFilesDir).catch(() => {})

    for (const [index, filePath] of candidatePaths.entries()) {
      let content = ''
      try {
        content = await readFileImpl(filePath)
      } catch {
        const fallback = filesStore?.fileContents?.[filePath]
        if (typeof fallback !== 'string') {
          continue
        }
        content = fallback
      }

      const contentPath = `${WORKSPACE_SNAPSHOT_PAYLOAD_FILES_DIR}/${index}.txt`
      await writeFileImpl(`${payloadDir}/${contentPath}`, content)
      payloadFiles.push({
        path: filePath,
        relativePath: resolveWorkspaceRelativePath(filePath, workspacePath),
        contentPath,
      })
    }

    if (payloadFiles.length === 0) {
      return null
    }

    const payload = createWorkspaceSnapshotPayloadMeta({
      manifestPath,
      fileCount: payloadFiles.length,
      capturedAt: new Date().toISOString(),
    })
    const manifest = createWorkspaceSnapshotPayloadManifest({
      workspacePath,
      snapshot,
      files: payloadFiles,
      payload,
    })
    await writeFileImpl(manifestPath, JSON.stringify(manifest, null, 2))
    return payload
  }

  async function loadWorkspaceSnapshotPayloadManifest({
    workspaceDataDir = '',
    snapshot = null,
  } = {}) {
    const manifestPath = normalizeSnapshotValue(snapshot?.payload?.manifestPath)
      || resolveWorkspaceSnapshotPayloadManifestPath(workspaceDataDir, snapshot)
    if (!manifestPath) {
      return null
    }

    try {
      return JSON.parse(await readFileImpl(manifestPath))
    } catch {
      return null
    }
  }

  async function restoreWorkspaceSnapshotPayload({
    workspacePath = '',
    workspaceDataDir = '',
    snapshot = null,
    applyFileContent = applyFileContentImpl,
  } = {}) {
    if (!workspacePath || !workspaceDataDir || !snapshot) {
      return { restored: false, reason: 'missing-input' }
    }

    const manifest = await loadWorkspaceSnapshotPayloadManifest({
      workspaceDataDir,
      snapshot,
    })
    if (!manifest) {
      return { restored: false, reason: 'missing-payload' }
    }

    const normalizedWorkspacePath = normalizePathValue(workspacePath)
    const manifestWorkspacePath = normalizePathValue(manifest.workspacePath)
    if (!manifestWorkspacePath || manifestWorkspacePath !== normalizedWorkspacePath) {
      return { restored: false, reason: 'workspace-mismatch', manifest }
    }

    const payloadDir = resolveWorkspaceSnapshotPayloadDir(workspaceDataDir, snapshot)
    const restoredFiles = []
    for (const file of manifest.files || []) {
      const targetPath = normalizeSnapshotValue(file?.path)
      const contentPath = normalizeSnapshotValue(file?.contentPath)
      if (!targetPath || !contentPath) {
        continue
      }

      const content = await readFileImpl(`${payloadDir}/${contentPath}`)
      const applied = await applyFileContent(targetPath, content)
      if (applied === false) {
        return {
          restored: false,
          reason: 'apply-failed',
          filePath: targetPath,
          restoredFiles,
          manifest,
        }
      }
      restoredFiles.push(targetPath)
    }

    return {
      restored: restoredFiles.length > 0,
      restoredFiles,
      manifest,
    }
  }

  return {
    captureWorkspaceSnapshotPayload,
    loadWorkspaceSnapshotPayloadManifest,
    restoreWorkspaceSnapshotPayload,
  }
}
