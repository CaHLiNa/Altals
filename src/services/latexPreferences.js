import { invoke } from '@tauri-apps/api/core'

const LEGACY_LATEX_PREFERENCE_KEYS = [
  'latex.compilerPreference',
  'latex.enginePreference',
  'latex.autoCompile',
  'latex.formatOnSave',
  'latex.buildRecipe',
  'latex.buildExtraArgs',
  'latex.customSystemTexPath',
  'latex.customLatexmkPath',
]

export function createLatexPreferenceState() {
  return {
    compilerPreference: 'auto',
    enginePreference: 'auto',
    autoCompile: false,
    formatOnSave: false,
    buildRecipe: 'default',
    buildExtraArgs: '',
    customSystemTexPath: '',
  }
}

function hasTauriInvoke() {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__?.invoke === 'function'
}

function readLegacyLatexPreferenceSnapshot() {
  const snapshot = {}

  try {
    for (const key of LEGACY_LATEX_PREFERENCE_KEYS) {
      const value = localStorage.getItem(key)
      if (value !== null) {
        snapshot[key] = value
      }
    }
  } catch {
    // Ignore localStorage failures.
  }

  return snapshot
}

function clearLegacyLatexPreferenceStorage() {
  try {
    for (const key of LEGACY_LATEX_PREFERENCE_KEYS) {
      localStorage.removeItem(key)
    }
  } catch {
    // Ignore localStorage failures.
  }
}

function readBrowserPreviewValue(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value == null ? fallback : value
  } catch {
    return fallback
  }
}

function readBrowserPreviewBoolean(key, fallback = false) {
  const fallbackValue = fallback ? 'true' : 'false'
  const value = String(readBrowserPreviewValue(key, fallbackValue)).trim().toLowerCase()
  return value === 'true' || value === '1' || value === 'yes' || value === 'on'
}

function normalizeCompilerPreference(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return ['auto', 'system', 'tectonic'].includes(normalized) ? normalized : 'auto'
}

function normalizeEnginePreference(compilerPreference, value) {
  if (compilerPreference === 'tectonic') return 'auto'
  const normalized = String(value || '').trim().toLowerCase()
  return ['auto', 'xelatex', 'pdflatex', 'lualatex'].includes(normalized) ? normalized : 'auto'
}

function normalizeBuildRecipe(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return ['default', 'shell-escape', 'clean-build', 'shell-escape-clean'].includes(normalized)
    ? normalized
    : 'default'
}

function normalizeBrowserPreviewPreferences(preferences = {}) {
  const compilerPreference = normalizeCompilerPreference(preferences.compilerPreference)
  return {
    ...createLatexPreferenceState(),
    ...preferences,
    compilerPreference,
    enginePreference: normalizeEnginePreference(compilerPreference, preferences.enginePreference),
    autoCompile: preferences.autoCompile === true,
    formatOnSave: preferences.formatOnSave === true,
    buildRecipe: normalizeBuildRecipe(preferences.buildRecipe),
    buildExtraArgs: String(preferences.buildExtraArgs || '').trim(),
    customSystemTexPath: String(preferences.customSystemTexPath || '').trim(),
  }
}

function loadBrowserPreviewLatexPreferences() {
  const preferences = normalizeBrowserPreviewPreferences({
    compilerPreference: readBrowserPreviewValue('latex.compilerPreference', 'auto'),
    enginePreference: readBrowserPreviewValue('latex.enginePreference', 'auto'),
    autoCompile: readBrowserPreviewBoolean('latex.autoCompile', false),
    formatOnSave: readBrowserPreviewBoolean('latex.formatOnSave', false),
    buildRecipe: readBrowserPreviewValue('latex.buildRecipe', 'default'),
    buildExtraArgs: readBrowserPreviewValue('latex.buildExtraArgs', ''),
    customSystemTexPath: readBrowserPreviewValue('latex.customSystemTexPath', ''),
  })

  clearLegacyLatexPreferenceStorage()
  return preferences
}

function saveBrowserPreviewLatexPreferences(preferences = {}) {
  const normalized = normalizeBrowserPreviewPreferences(preferences)

  try {
    localStorage.setItem('latex.compilerPreference', normalized.compilerPreference)
    localStorage.setItem('latex.enginePreference', normalized.enginePreference)
    localStorage.setItem('latex.autoCompile', normalized.autoCompile ? 'true' : 'false')
    localStorage.setItem('latex.formatOnSave', normalized.formatOnSave ? 'true' : 'false')
    localStorage.setItem('latex.buildRecipe', normalized.buildRecipe)
    if (normalized.buildExtraArgs) {
      localStorage.setItem('latex.buildExtraArgs', normalized.buildExtraArgs)
    } else {
      localStorage.removeItem('latex.buildExtraArgs')
    }
    if (normalized.customSystemTexPath) {
      localStorage.setItem('latex.customSystemTexPath', normalized.customSystemTexPath)
    } else {
      localStorage.removeItem('latex.customSystemTexPath')
    }
    localStorage.removeItem('latex.customLatexmkPath')
  } catch {
    // Ignore browser preview storage failures.
  }

  return normalized
}

export async function loadLatexPreferences(globalConfigDir = '') {
  if (!hasTauriInvoke()) {
    return loadBrowserPreviewLatexPreferences()
  }

  const preferences = await invoke('latex_preferences_load', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      legacyPreferences: readLegacyLatexPreferenceSnapshot(),
    },
  })

  clearLegacyLatexPreferenceStorage()
  return {
    ...createLatexPreferenceState(),
    ...preferences,
  }
}

export async function saveLatexPreferences(globalConfigDir = '', preferences = {}) {
  if (!hasTauriInvoke()) {
    return saveBrowserPreviewLatexPreferences(preferences)
  }

  const normalized = await invoke('latex_preferences_save', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      preferences,
    },
  })

  clearLegacyLatexPreferenceStorage()
  return {
    ...createLatexPreferenceState(),
    ...normalized,
  }
}
