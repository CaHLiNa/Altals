import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export function pathExists(path) {
  return invoke('path_exists', { path })
}

export async function revealPathInFileManager(entry) {
  const isMacOS = /Mac|iPhone|iPad/.test(navigator.platform)
  const isWin = /Win/.test(navigator.platform)
  const dir = entry.is_dir ? entry.path : entry.path.substring(0, entry.path.lastIndexOf('/'))

  let command
  if (isMacOS) {
    command = entry.is_dir ? `open "${entry.path}"` : `open -R "${entry.path}"`
  } else if (isWin) {
    command = entry.is_dir ? `explorer "${entry.path}"` : `explorer /select,"${entry.path}"`
  } else {
    command = `xdg-open "${dir}"`
  }

  return invoke('run_shell_command', { cwd: dir, command })
}

export async function listenNativeFileDropEvents(handlers) {
  const stopOver = await listen('tauri://drag-over', (event) => {
    handlers.onOver?.(event.payload)
  })
  const stopDrop = await listen('tauri://drag-drop', (event) => {
    handlers.onDrop?.(event.payload)
  })
  const stopLeave = await listen('tauri://drag-leave', (event) => {
    handlers.onLeave?.(event.payload)
  })

  return () => {
    stopOver?.()
    stopDrop?.()
    stopLeave?.()
  }
}
