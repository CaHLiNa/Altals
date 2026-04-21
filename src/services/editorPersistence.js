import { invoke } from '@tauri-apps/api/core'
import { isBrowserPreviewRuntime } from '../app/browserPreview/routes.js'

const STATE_VERSION = 1

function isPreviewPath(path = '') {
  return path.startsWith('preview:')
}

function isVirtualNewTab(path = '') {
  return path.startsWith('newtab:')
}

function isContextCandidatePath(path = '') {
  return !!path && !isVirtualNewTab(path) && !isPreviewPath(path)
}

function createEmptyState() {
  return {
    version: STATE_VERSION,
    paneTree: {
      type: 'leaf',
      id: 'pane-root',
      tabs: [],
      activeTab: null,
    },
    activePaneId: 'pane-root',
    legacyPreviewPaths: [],
    lastContextPath: '',
  }
}

export async function saveState(workspaceDataDir, paneTree, activePaneId, options = {}) {
  if (!workspaceDataDir) return null
  if (isBrowserPreviewRuntime()) {
    return {
      ...createEmptyState(),
      paneTree,
      activePaneId,
      legacyPreviewPaths: Array.isArray(options.legacyPreviewPaths) ? options.legacyPreviewPaths : [],
      lastContextPath: String(options.lastContextPath || ''),
    }
  }

  return invoke('editor_session_save', {
    params: {
      workspaceDataDir,
      paneTree,
      activePaneId,
      legacyPreviewPaths: Array.isArray(options.legacyPreviewPaths)
        ? options.legacyPreviewPaths
        : Array.from(options.legacyPreviewPaths || []),
      lastContextPath: String(options.lastContextPath || ''),
    },
  })
}

export async function loadState(workspaceDataDir) {
  if (!workspaceDataDir) return null
  if (isBrowserPreviewRuntime()) return null

  const loaded = await invoke('editor_session_load', {
    params: {
      workspaceDataDir,
    },
  })
  return loaded && typeof loaded === 'object' ? loaded : null
}

export async function findInvalidTabs(_workspaceDataDir, paneTree) {
  if (!paneTree || typeof paneTree !== 'object') return new Set()

  const tabs = []
  const walk = (node) => {
    if (!node) return
    if (node.type === 'leaf') {
      for (const tab of node.tabs || []) tabs.push(tab)
      return
    }
    for (const child of node.children || []) walk(child)
  }
  walk(paneTree)

  const openTabs = new Set(tabs.filter((tab) => typeof tab === 'string' && tab))
  return new Set(
    tabs.filter((tab) => typeof tab === 'string' && isContextCandidatePath(tab) && !openTabs.has(tab))
  )
}
