import { invoke } from '@tauri-apps/api/core'
import {
  isBrowserPreviewWorkspacePath,
  readBrowserPreviewWorkspaceSnapshot,
} from '../app/browserPreview/state.js'
import { isBrowserPreviewRuntime } from '../app/browserPreview/routes.js'

export async function readWorkspaceTreeSnapshot(path, loadedDirs = [], options = {}) {
  if (isBrowserPreviewRuntime() && isBrowserPreviewWorkspacePath(path)) {
    return readBrowserPreviewWorkspaceSnapshot(path)
  }
  return invoke('read_workspace_tree_snapshot', {
    path,
    loadedDirs,
    includeHidden: options.includeHidden !== false,
  })
}

export async function readWorkspaceFlatFiles(path, options = {}) {
  const snapshot = await readWorkspaceTreeSnapshot(path, [], options)
  return Array.isArray(snapshot?.flatFiles) ? snapshot.flatFiles : []
}
