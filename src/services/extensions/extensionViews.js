import { invoke } from '@tauri-apps/api/core'

export async function resolveExtensionView(payload = {}) {
  return invoke('extension_view_resolve', {
    params: {
      globalConfigDir: String(payload.globalConfigDir || ''),
      workspaceRoot: String(payload.workspaceRoot || ''),
      extensionId: String(payload.extensionId || ''),
      viewId: String(payload.viewId || ''),
      parentItemId: String(payload.parentItemId || ''),
      commandId: String(payload.commandId || ''),
      targetKind: String(payload.targetKind || ''),
      targetPath: String(payload.targetPath || ''),
      settings: payload.settings || {},
    },
  })
}

export async function notifyExtensionViewSelection(payload = {}) {
  return invoke('extension_host_notify_view_selection', {
    params: {
      globalConfigDir: String(payload.globalConfigDir || ''),
      workspaceRoot: String(payload.workspaceRoot || ''),
      extensionId: String(payload.extensionId || ''),
      viewId: String(payload.viewId || ''),
      itemHandle: String(payload.itemHandle || ''),
    },
  })
}
