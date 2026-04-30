import { invoke } from '@tauri-apps/api/core'

export async function listExtensions(globalConfigDir = '', workspaceRoot = '') {
  const extensions = await invoke('extension_registry_list', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      workspaceRoot: String(workspaceRoot || ''),
    },
  })
  return Array.isArray(extensions) ? extensions : []
}

export async function validateExtensionManifest(manifest = {}) {
  return invoke('extension_registry_validate_manifest', {
    manifest,
  })
}

export async function detectExtensionRuntime(globalConfigDir = '', workspaceRoot = '', extensionId = '') {
  return invoke('extension_runtime_detect', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      workspaceRoot: String(workspaceRoot || ''),
      extensionId: String(extensionId || ''),
    },
  })
}

export async function loadExtensionSettings(globalConfigDir = '') {
  return invoke('extension_settings_load', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
    },
  })
}

export async function saveExtensionSettings(globalConfigDir = '', settings = {}) {
  return invoke('extension_settings_save', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      settings,
    },
  })
}
