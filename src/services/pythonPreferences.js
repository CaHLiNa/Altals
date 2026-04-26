import { invoke } from '@tauri-apps/api/core'

export function createPythonPreferenceState() {
  return {
    interpreterPreference: 'auto',
  }
}

function normalizeInterpreterPreference(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed || trimmed.toLowerCase() === 'auto') {
    return 'auto'
  }
  return trimmed
}

function normalizePythonPreferences(preferences = {}) {
  return {
    ...createPythonPreferenceState(),
    ...preferences,
    interpreterPreference: normalizeInterpreterPreference(preferences.interpreterPreference),
  }
}

export async function loadPythonPreferences(globalConfigDir = '') {
  const preferences = await invoke('python_preferences_load', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
    },
  })

  return normalizePythonPreferences(preferences)
}

export async function savePythonPreferences(globalConfigDir = '', preferences = {}) {
  const normalized = await invoke('python_preferences_save', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      preferences,
    },
  })

  return normalizePythonPreferences(normalized)
}
