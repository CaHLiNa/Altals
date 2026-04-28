import { invoke } from '@tauri-apps/api/core'

export async function loadI18nRuntime(preferredLocale = 'system') {
  return invoke('i18n_runtime_load', {
    params: {
      preferredLocale: String(preferredLocale || 'system'),
    },
  })
}

export async function loadSavedLocalePreference(defaultPreference = 'system') {
  const globalConfigDir = await invoke('get_global_config_dir')
  const preferences = await invoke('workspace_preferences_load', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      legacyPreferences: {},
    },
  })
  return preferences?.preferredLocale || defaultPreference
}
