import { invoke } from '@tauri-apps/api/core'
import { isMac } from '../platform'
import {
  clearStorageKeys,
  hasDesktopInvoke,
  readStorageJson,
  writeStorageJson,
} from './bridgeStorage.js'

const BOOKMARKS_KEY = 'workspaceBookmarks'

function normalizeWorkspacePath(path = '') {
  const trimmed = String(path || '').trim().replace(/\/+$/, '')
  return trimmed || '/'
}

function readBookmarks() {
  const parsed = readStorageJson(BOOKMARKS_KEY, {})
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

function writeBookmarks(bookmarks) {
  writeStorageJson(BOOKMARKS_KEY, bookmarks)
}

function clearLegacyBookmarks() {
  clearStorageKeys([BOOKMARKS_KEY])
}

function getWorkspaceBookmark(path) {
  if (!path) return ''
  const bookmarks = readBookmarks()
  return bookmarks[normalizeWorkspacePath(path)] || ''
}

function moveWorkspaceBookmark(oldPath, newPath, fallbackBookmark = '') {
  const bookmarks = readBookmarks()
  const oldKey = normalizeWorkspacePath(oldPath)
  const newKey = normalizeWorkspacePath(newPath)
  const bookmark = bookmarks[oldKey] || fallbackBookmark
  if (oldKey !== newKey) {
    delete bookmarks[oldKey]
  }
  if (bookmark) {
    bookmarks[newKey] = bookmark
  }
  writeBookmarks(bookmarks)
}

export function removeWorkspaceBookmark(path) {
  if (!path) return
  if (hasDesktopInvoke()) {
    void invoke('workspace_bookmark_remove', {
      params: {
        path: normalizeWorkspacePath(path),
      },
    }).then(clearLegacyBookmarks).catch((error) => {
      console.warn('[workspace-permissions] Failed to remove workspace bookmark:', error)
    })
    return
  }

  const bookmarks = readBookmarks()
  delete bookmarks[normalizeWorkspacePath(path)]
  writeBookmarks(bookmarks)
}

export async function captureWorkspaceBookmark(path) {
  if (!isMac || !path) return path
  try {
    const normalizedPath = normalizeWorkspacePath(path)
    if (!hasDesktopInvoke()) {
      return normalizedPath
    }

    const result = await invoke('macos_capture_workspace_bookmark', {
      params: {
        path: normalizedPath,
        legacyBookmarks: readBookmarks(),
      },
    })
    clearLegacyBookmarks()
    return normalizeWorkspacePath(result?.path || normalizedPath)
  } catch (error) {
    console.warn('[workspace-permissions] Failed to create workspace bookmark:', error)
    return normalizeWorkspacePath(path)
  }
}

export async function activateWorkspaceBookmark(path) {
  const normalizedPath = normalizeWorkspacePath(path)
  if (!isMac || !normalizedPath) return normalizedPath

  if (hasDesktopInvoke()) {
    try {
      const result = await invoke('macos_activate_workspace_bookmark_for_path', {
        params: {
          path: normalizedPath,
          legacyBookmarks: readBookmarks(),
        },
      })
      clearLegacyBookmarks()
      return normalizeWorkspacePath(result?.path || normalizedPath)
    } catch (error) {
      console.warn('[workspace-permissions] Failed to activate workspace bookmark:', error)
      return normalizedPath
    }
  }

  const bookmark = getWorkspaceBookmark(normalizedPath)
  if (!bookmark) return normalizedPath

  try {
    const result = await invoke('macos_activate_workspace_bookmark', { bookmark })
    const resolvedPath = normalizeWorkspacePath(result?.path || normalizedPath)
    const refreshedBookmark = result?.bookmark || bookmark
    moveWorkspaceBookmark(normalizedPath, resolvedPath, refreshedBookmark)
    return resolvedPath
  } catch (error) {
    console.warn('[workspace-permissions] Failed to activate workspace bookmark:', error)
    return normalizedPath
  }
}

export async function releaseWorkspaceBookmark(path) {
  if (!isMac || !path) return
  try {
    await invoke('macos_release_workspace_access', { path: normalizeWorkspacePath(path) })
  } catch (error) {
    console.warn('[workspace-permissions] Failed to release workspace bookmark:', error)
  }
}
