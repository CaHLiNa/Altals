import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

const WORKSPACE_TREE_CHANGED_EVENT = 'workspace-tree-changed'

function isTauriDesktopRuntime() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
}

export async function startWorkspaceTreeWatch(path = '') {
  if (!isTauriDesktopRuntime() || !path) return
  await invoke('workspace_tree_watch_start', { path })
}

export async function stopWorkspaceTreeWatch() {
  if (!isTauriDesktopRuntime()) return
  await invoke('workspace_tree_watch_stop').catch(() => {})
}

export async function listenForWorkspaceTreeChanges(handler = () => {}) {
  if (!isTauriDesktopRuntime()) return () => {}

  return listen(WORKSPACE_TREE_CHANGED_EVENT, (event) => {
    handler(event.payload || {})
  }).catch(() => () => {})
}
