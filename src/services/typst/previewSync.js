import { invoke } from '@tauri-apps/api/core'
import {
  requestTinymistExecuteCommand,
  subscribeTinymistNotification,
} from '../tinymist/session.js'
import { normalizeFsPath } from '../documentIntelligence/workspaceGraph.js'
import { resolveCachedTypstRootPath } from './root.js'

const TYPST_PREVIEW_TASK_ID = 'altals-typst-preview-sync'
const DEFAULT_TIMEOUT_MS = 2500
const PREVIEW_RETRY_DELAY_MS = 180
const PREVIEW_RETRY_ATTEMPTS = 6

const previewTaskState = {
  taskId: null,
  rootPath: null,
  workspacePath: null,
  dataPlanePort: null,
  startToken: 0,
  startPromise: null,
}

const pendingForwardSyncByRoot = new Map()

function toNotificationJumpLocation(payload = {}) {
  const filePath = String(payload?.filepath || '')
  if (!filePath) return null

  const start = Array.isArray(payload?.start)
    ? { line: Number(payload.start[0] || 0), character: Number(payload.start[1] || 0) }
    : null
  const end = Array.isArray(payload?.end)
    ? { line: Number(payload.end[0] || 0), character: Number(payload.end[1] || 0) }
    : null

  return {
    filePath,
    targetSelectionRange: {
      start: start || end || { line: 0, character: 0 },
      end: end || start || { line: 0, character: 0 },
    },
    range: {
      start: start || end || { line: 0, character: 0 },
      end: end || start || { line: 0, character: 0 },
    },
  }
}

function chooseNearestJumpPosition(positions = [], currentPage = 1) {
  const valid = (Array.isArray(positions) ? positions : [])
    .filter((entry) => Number.isFinite(entry?.page) && Number.isFinite(entry?.x) && Number.isFinite(entry?.y))
    .map(entry => ({
      page: Number(entry.page),
      x: Number(entry.x),
      y: Number(entry.y),
    }))

  if (valid.length === 0) return null
  if (!Number.isFinite(currentPage)) return valid[0]

  return [...valid].sort((left, right) => {
    const delta = Math.abs(left.page - currentPage) - Math.abs(right.page - currentPage)
    if (delta !== 0) return delta
    return left.page - right.page
  })[0] || valid[0]
}

function belongsToRootProject(sourcePath = '', rootPath = '', sourceRootPath = '') {
  const normalizedSource = normalizeFsPath(sourcePath)
  const normalizedRoot = normalizeFsPath(rootPath)
  const normalizedSourceRoot = normalizeFsPath(sourceRootPath)
  if (!normalizedRoot) return false
  if (normalizedSource && normalizedSource === normalizedRoot) return true
  return !!normalizedSourceRoot && normalizedSourceRoot === normalizedRoot
}

async function killPreviewTask(workspacePath = null) {
  if (!previewTaskState.taskId) {
    previewTaskState.rootPath = null
    previewTaskState.workspacePath = workspacePath || null
    previewTaskState.dataPlanePort = null
    previewTaskState.startPromise = null
    return
  }

  try {
    await requestTinymistExecuteCommand('tinymist.doKillPreview', [previewTaskState.taskId], {
      workspacePath: workspacePath || previewTaskState.workspacePath || null,
    })
  } catch {
    // Ignore stale task errors and reset local state.
  } finally {
    previewTaskState.taskId = null
    previewTaskState.rootPath = null
    previewTaskState.workspacePath = workspacePath || null
    previewTaskState.dataPlanePort = null
    previewTaskState.startPromise = null
  }
}

async function startPreviewTask(rootPath, options = {}) {
  const normalizedRoot = normalizeFsPath(rootPath)
  const workspacePath = normalizeFsPath(options.workspacePath || '')
  if (!normalizedRoot) {
    throw new Error('Missing Typst preview root')
  }

  if (
    previewTaskState.taskId === TYPST_PREVIEW_TASK_ID
    && previewTaskState.rootPath === normalizedRoot
    && previewTaskState.dataPlanePort
    && previewTaskState.workspacePath === workspacePath
  ) {
    return {
      taskId: previewTaskState.taskId,
      rootPath: previewTaskState.rootPath,
      workspacePath: previewTaskState.workspacePath,
      dataPlanePort: previewTaskState.dataPlanePort,
    }
  }

  previewTaskState.startToken += 1
  const startToken = previewTaskState.startToken

  await killPreviewTask(workspacePath || null)

  const result = await requestTinymistExecuteCommand(
    'tinymist.doStartPreview',
    [[
      '--task-id',
      TYPST_PREVIEW_TASK_ID,
      '--data-plane-host',
      '127.0.0.1:0',
      normalizedRoot,
    ]],
    { workspacePath },
  )

  if (previewTaskState.startToken !== startToken) {
    throw new Error('Typst preview task was replaced before initialization finished')
  }

  const dataPlanePort = Number(result?.dataPlanePort || 0)
  if (!Number.isInteger(dataPlanePort) || dataPlanePort <= 0) {
    throw new Error('Tinymist preview did not expose a valid data plane port')
  }

  previewTaskState.taskId = TYPST_PREVIEW_TASK_ID
  previewTaskState.rootPath = normalizedRoot
  previewTaskState.workspacePath = workspacePath
  previewTaskState.dataPlanePort = dataPlanePort

  return {
    taskId: previewTaskState.taskId,
    rootPath: previewTaskState.rootPath,
    workspacePath: previewTaskState.workspacePath,
    dataPlanePort: previewTaskState.dataPlanePort,
  }
}

async function ensurePreviewTask(rootPath, options = {}) {
  const normalizedRoot = normalizeFsPath(rootPath)
  const workspacePath = normalizeFsPath(options.workspacePath || '')
  if (!normalizedRoot) {
    throw new Error('Missing Typst preview root')
  }

  if (
    previewTaskState.taskId === TYPST_PREVIEW_TASK_ID
    && previewTaskState.rootPath === normalizedRoot
    && previewTaskState.dataPlanePort
    && previewTaskState.workspacePath === workspacePath
  ) {
    return {
      taskId: previewTaskState.taskId,
      rootPath: previewTaskState.rootPath,
      workspacePath: previewTaskState.workspacePath,
      dataPlanePort: previewTaskState.dataPlanePort,
    }
  }

  if (
    previewTaskState.startPromise
    && previewTaskState.rootPath === normalizedRoot
    && previewTaskState.workspacePath === workspacePath
  ) {
    return previewTaskState.startPromise
  }

  previewTaskState.rootPath = normalizedRoot
  previewTaskState.workspacePath = workspacePath
  previewTaskState.startPromise = startPreviewTask(normalizedRoot, { workspacePath })
    .finally(() => {
      previewTaskState.startPromise = null
    })
  return previewTaskState.startPromise
}

function shouldRetryPreviewSync(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return message.includes('not ready yet') || message.includes('timed out waiting')
}

async function retryPreviewSync(operation) {
  let lastError = null
  for (let attempt = 0; attempt < PREVIEW_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!shouldRetryPreviewSync(error) || attempt >= PREVIEW_RETRY_ATTEMPTS - 1) {
        throw error
      }
      await new Promise(resolve => window.setTimeout(resolve, PREVIEW_RETRY_DELAY_MS))
    }
  }
  throw lastError || new Error('Typst preview sync failed')
}

function waitForScrollSource(timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Typst preview reverse sync timed out'))
    }, timeoutMs)

    const cleanup = subscribeTinymistNotification('tinymist/preview/scrollSource', (payload) => {
      const location = toNotificationJumpLocation(payload)
      if (!location) return
      window.clearTimeout(timer)
      cleanup()
      resolve(location)
    })
  })
}

subscribeTinymistNotification('tinymist/preview/dispose', (payload) => {
  if (String(payload?.taskId || '') !== TYPST_PREVIEW_TASK_ID) return
  previewTaskState.taskId = null
  previewTaskState.rootPath = null
  previewTaskState.dataPlanePort = null
  previewTaskState.startPromise = null
})

export async function ensureTypstPreviewTaskStarted(options = {}) {
  const rootPath = normalizeFsPath(options.rootPath || '')
  const workspacePath = normalizeFsPath(options.workspacePath || '')
  if (!rootPath) return null
  return ensurePreviewTask(rootPath, { workspacePath })
}

export async function requestTypstPreviewForwardSync(options = {}) {
  const sourcePath = normalizeFsPath(options.sourcePath || '')
  const rootPath = normalizeFsPath(options.rootPath || resolveCachedTypstRootPath(sourcePath))
  const workspacePath = normalizeFsPath(options.workspacePath || '')
  const currentPage = Number(options.currentPage || 1)
  const line = Number(options.line ?? 0)
  const character = Number(options.character ?? 0)

  if (!sourcePath || !rootPath) return null

  return retryPreviewSync(async () => {
    const task = await ensurePreviewTask(rootPath, { workspacePath })
    const jumpPromise = invoke('typst_preview_wait_for_jump', {
      port: task.dataPlanePort,
      timeoutMs: Number(options.timeoutMs || DEFAULT_TIMEOUT_MS),
    })

    await requestTinymistExecuteCommand(
      'tinymist.scrollPreview',
      [
        task.taskId,
        {
          event: 'panelScrollTo',
          filepath: sourcePath,
          line,
          character,
        },
      ],
      { workspacePath },
    )

    const positions = await jumpPromise
    return chooseNearestJumpPosition(positions, currentPage)
  })
}

export async function requestTypstPreviewBackwardSync(options = {}) {
  const rootPath = normalizeFsPath(options.rootPath || '')
  const workspacePath = normalizeFsPath(options.workspacePath || '')
  const page = Number(options.page || 0)
  const x = Number(options.x || 0)
  const y = Number(options.y || 0)

  if (!rootPath || !Number.isFinite(page) || page < 1) return null

  return retryPreviewSync(async () => {
    const task = await ensurePreviewTask(rootPath, { workspacePath })
    const waitPromise = waitForScrollSource(Number(options.timeoutMs || DEFAULT_TIMEOUT_MS))

    await invoke('typst_preview_send_src_point', {
      port: task.dataPlanePort,
      page,
      x,
      y,
    })

    return waitPromise
  })
}

export function rememberPendingTypstForwardSync(detail = {}) {
  const sourcePath = normalizeFsPath(detail.sourcePath || '')
  const rootPath = normalizeFsPath(detail.rootPath || '')
  const line = Number(detail.line ?? -1)
  const character = Number(detail.character ?? -1)
  if (!sourcePath || !rootPath || !Number.isInteger(line) || line < 0 || !Number.isInteger(character) || character < 0) {
    return null
  }

  const nextDetail = {
    sourcePath,
    rootPath,
    line,
    character,
  }
  pendingForwardSyncByRoot.set(rootPath, nextDetail)

  return nextDetail
}

export function clearPendingTypstForwardSync(detail = null, rootPath = '') {
  if (!detail && !rootPath) {
    pendingForwardSyncByRoot.clear()
    return
  }

  const normalizedRoot = normalizeFsPath(rootPath || detail?.rootPath || '')
  if (!normalizedRoot) return
  if (!detail) {
    pendingForwardSyncByRoot.delete(normalizedRoot)
    return
  }

  const current = pendingForwardSyncByRoot.get(normalizedRoot)
  if (!current) return
  if (
    current.sourcePath === normalizeFsPath(detail.sourcePath || '')
    && current.rootPath === normalizedRoot
    && current.line === Number(detail.line ?? -1)
    && current.character === Number(detail.character ?? -1)
  ) {
    pendingForwardSyncByRoot.delete(normalizedRoot)
  }
}

export function peekPendingTypstForwardSync(rootPath = '') {
  const normalizedRoot = normalizeFsPath(rootPath)
  if (!normalizedRoot) return null
  return pendingForwardSyncByRoot.get(normalizedRoot) || null
}

export function sourceBelongsToTypstPreviewRoot(sourcePath = '', rootPath = '', sourceRootPath = '') {
  return belongsToRootProject(sourcePath, rootPath, sourceRootPath)
}

export async function resetTypstPreviewSync(workspacePath = null) {
  await killPreviewTask(workspacePath)
}
