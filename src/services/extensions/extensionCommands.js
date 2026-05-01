import { invoke } from '@tauri-apps/api/core'

export async function executeExtensionCommand(payload = {}) {
  return invoke('extension_command_execute', {
    params: {
      globalConfigDir: String(payload.globalConfigDir || ''),
      workspaceRoot: String(payload.workspaceRoot || ''),
      extensionId: String(payload.extensionId || ''),
      commandId: String(payload.commandId || ''),
      itemId: String(payload.itemId || ''),
      itemHandle: String(payload.itemHandle || ''),
      target: payload.target || {},
      settings: payload.settings || {},
    },
  })
}

export async function invokeExtensionCapability(payload = {}) {
  return invoke('extension_capability_invoke', {
    params: {
      globalConfigDir: String(payload.globalConfigDir || ''),
      workspaceRoot: String(payload.workspaceRoot || ''),
      extensionId: String(payload.extensionId || ''),
      capabilityId: String(payload.capabilityId || ''),
      itemId: String(payload.itemId || ''),
      itemHandle: String(payload.itemHandle || ''),
      target: payload.target || {},
      settings: payload.settings || {},
    },
  })
}
