import { invoke } from '@tauri-apps/api/core'

export async function listPlugins(globalConfigDir = '', workspaceRoot = '') {
  const plugins = await invoke('plugin_registry_list', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      workspaceRoot: String(workspaceRoot || ''),
    },
  })
  return Array.isArray(plugins) ? plugins : []
}

export async function validatePluginManifest(manifest = {}) {
  return invoke('plugin_registry_validate_manifest', {
    manifest,
  })
}

export async function detectPluginRuntime(globalConfigDir = '', workspaceRoot = '', pluginId = '') {
  return invoke('plugin_runtime_detect', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      workspaceRoot: String(workspaceRoot || ''),
      pluginId: String(pluginId || ''),
    },
  })
}

export async function loadPluginSettings(globalConfigDir = '') {
  return invoke('plugin_settings_load', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
    },
  })
}

export async function savePluginSettings(globalConfigDir = '', settings = {}) {
  return invoke('plugin_settings_save', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      settings,
    },
  })
}
