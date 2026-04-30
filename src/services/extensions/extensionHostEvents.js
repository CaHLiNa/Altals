import { listen } from '@tauri-apps/api/event'

export function listenExtensionViewChanged(handler) {
  return listen('extension-view-changed', handler)
}
