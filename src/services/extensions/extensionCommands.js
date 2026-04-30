import { invoke } from '@tauri-apps/api/core'

export async function executeExtensionCommand(payload = {}) {
  return invoke('extension_command_execute', {
    params: {
      globalConfigDir: String(payload.globalConfigDir || ''),
      workspaceRoot: String(payload.workspaceRoot || ''),
      extensionId: String(payload.extensionId || ''),
      commandId: String(payload.commandId || ''),
      target: payload.target || {},
      settings: payload.settings || {},
    },
  })
}
