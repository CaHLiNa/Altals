import { invoke } from '@tauri-apps/api/core'

export async function activateExtensionHost(payload = {}) {
  return invoke('extension_host_activate', {
    params: {
      globalConfigDir: String(payload.globalConfigDir || ''),
      workspaceRoot: String(payload.workspaceRoot || ''),
      extensionId: String(payload.extensionId || ''),
      activationEvent: String(payload.activationEvent || ''),
    },
  })
}
