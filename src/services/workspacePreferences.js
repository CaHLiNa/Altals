import { invoke } from '@tauri-apps/api/core'
import {
  EDITOR_FONT_SIZE_PRESETS,
  FALLBACK_SYSTEM_FONT_FAMILIES,
  WORKSPACE_FONT_PRESETS,
  createWorkspacePreferenceState,
  decodeWorkspaceSystemFontFamily,
  encodeWorkspaceSystemFontFamily,
  getWorkspaceFontKind,
  normalizeEditorFontSize,
  normalizeWorkspacePdfViewerLastScale,
  normalizeWorkspacePdfViewerSpreadMode,
  normalizeWorkspacePdfViewerZoomMode,
} from '../domains/settings/workspacePreferencePresentation.js'
export {
  applyWorkspaceFontSizes,
  setWorkspaceEditorFontSize,
  setWorkspaceLatexFont,
  setWorkspaceMarkdownFont,
  setWorkspaceUiFont,
} from './workspaceFonts.js'
export { restoreWorkspaceTheme, setWorkspaceTheme } from './workspaceTheme.js'

export {
  EDITOR_FONT_SIZE_PRESETS,
  FALLBACK_SYSTEM_FONT_FAMILIES,
  WORKSPACE_FONT_PRESETS,
  createWorkspacePreferenceState,
  decodeWorkspaceSystemFontFamily,
  encodeWorkspaceSystemFontFamily,
  getWorkspaceFontKind,
  normalizeEditorFontSize,
  normalizeWorkspacePdfViewerLastScale,
  normalizeWorkspacePdfViewerSpreadMode,
  normalizeWorkspacePdfViewerZoomMode,
}

export async function loadWorkspacePreferences(globalConfigDir = '') {
  return invoke('workspace_preferences_load', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
    },
  })
}

export async function saveWorkspacePreferences(globalConfigDir = '', preferences = {}) {
  const normalized = await invoke('workspace_preferences_save', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      preferences,
    },
  })

  return normalized
}

export async function normalizeWorkbenchState(state = {}) {
  return invoke('workbench_state_normalize', {
    params: {
      primarySurface: String(state.primarySurface || ''),
      leftSidebarOpen: state.leftSidebarOpen !== false,
      leftSidebarPanel: String(state.leftSidebarPanel || ''),
      rightSidebarOpen: state.rightSidebarOpen === true,
      rightSidebarPanel: String(state.rightSidebarPanel || ''),
      documentDockOpen: state.documentDockOpen === true,
      referenceDockOpen: state.referenceDockOpen === true,
      documentDockActivePage: String(state.documentDockActivePage || ''),
      referenceDockActivePage: String(state.referenceDockActivePage || ''),
    },
  })
}

export async function loadWorkspaceSystemFontFamilies() {
  try {
    const fonts = await invoke('workspace_preferences_list_system_fonts')
    const normalized = Array.isArray(fonts)
      ? fonts
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      : []
    return normalized.length > 0 ? normalized : [...FALLBACK_SYSTEM_FONT_FAMILIES]
  } catch {
    return [...FALLBACK_SYSTEM_FONT_FAMILIES]
  }
}
