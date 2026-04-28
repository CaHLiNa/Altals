import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export const WORKSPACE_TREE_REFRESH_REQUESTED_EVENT = 'workspace-tree-refresh-requested'

export async function startWorkspaceTreeWatch(path = '') {
  return invoke('workspace_tree_watch_start', { path: String(path || '') })
}

export async function stopWorkspaceTreeWatch() {
  return invoke('workspace_tree_watch_stop')
}

export async function setWorkspaceTreeVisibility(params = {}) {
  return invoke('workspace_tree_watch_set_visibility', {
    params: {
      path: String(params.path || ''),
      visible: params.visible === true,
    },
  })
}

export async function noteWorkspaceTreeActivity(path = '') {
  return invoke('workspace_tree_watch_note_activity', {
    params: {
      path: String(path || ''),
    },
  })
}

export async function listenWorkspaceTreeRefreshRequested(handler = () => {}) {
  return listen(WORKSPACE_TREE_REFRESH_REQUESTED_EVENT, (event) => {
    handler(event.payload || {})
  }).catch(() => () => {})
}
