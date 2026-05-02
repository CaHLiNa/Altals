import { invoke } from '@tauri-apps/api/core'

export async function loadExtensionHostStatus() {
  return invoke('extension_host_status')
}

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

export async function deactivateExtensionHost(payload = {}) {
  return invoke('extension_host_deactivate', {
    params: {
      extensionId: String(payload.extensionId || ''),
      workspaceRoot: String(payload.workspaceRoot || ''),
    },
  })
}

export async function cancelExtensionWindowInputs(payload = {}) {
  return invoke('extension_host_cancel_window_inputs', {
    params: {
      extensionId: String(payload.extensionId || ''),
      workspaceRoot: String(payload.workspaceRoot || ''),
    },
  })
}

export async function updateExtensionHostSettings(payload = {}) {
  return invoke('extension_host_update_settings', {
    params: {
      globalConfigDir: String(payload.globalConfigDir || ''),
      workspaceRoot: String(payload.workspaceRoot || ''),
      extensionId: String(payload.extensionId || ''),
      settings: payload.settings || {},
    },
  })
}

export async function resolveExtensionHostCall(payload = {}) {
  return invoke('extension_host_resolve_host_call', {
    params: {
      requestId: String(payload.requestId || ''),
      accepted: payload.accepted !== false,
      result: payload.result,
      error: String(payload.error || ''),
    },
  })
}
