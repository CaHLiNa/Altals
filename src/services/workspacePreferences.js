import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { normalizeWorkspaceThemeId } from '../shared/workspaceThemeOptions.js'

const THEME_CLASSES = [
  'theme-light',
  'theme-dark',
  'theme-system',
  'theme-monokai',
  'theme-nord',
  'theme-solarized',
  'theme-humane',
  'theme-one-light',
  'theme-dracula',
]

const PROSE_FONT_STACKS = {
  inter: "'Inter', system-ui, sans-serif",
  stix: "'STIX Two Text', Georgia, serif",
  mono: "'JetBrains Mono', 'Menlo', 'Consolas', monospace",
}

const DEFAULT_EDITOR_FONT_SIZE = 14
const DEFAULT_UI_FONT_SIZE = 13
const MIN_EDITOR_FONT_SIZE = 12
const MAX_EDITOR_FONT_SIZE = 20
const DEFAULT_APP_ZOOM_PERCENT = 100
const DEFAULT_PDF_PAGE_BACKGROUND_FOLLOWS_THEME = true
const DEFAULT_PDF_CUSTOM_PAGE_BACKGROUND = '#1e1e1e'
const DEFAULT_PDF_CUSTOM_PAGE_FOREGROUND_DARK = '#1f2a1f'
const DEFAULT_PDF_CUSTOM_PAGE_FOREGROUND_LIGHT = '#f5faef'
const SYSTEM_THEME_MEDIA = '(prefers-color-scheme: dark)'

const LEGACY_WORKSPACE_PREFERENCE_KEYS = [
  'primarySurface',
  'leftSidebarOpen',
  'leftSidebarPanel',
  'rightSidebarOpen',
  'rightSidebarPanel',
  'autoSave',
  'softWrap',
  'wrapColumn',
  'editorFontSize',
  'uiFontSize',
  'appZoomPercent',
  'proseFont',
  'pdfPageBackgroundFollowsTheme',
  'pdfCustomPageBackground',
  'pdfCustomPageForegroundMode',
  'pdfCustomPageForeground',
  'theme',
]

export const EDITOR_FONT_SIZE_PRESETS = [12, 13, 14, 15, 16, 18]
export const APP_ZOOM_PRESETS = [100]

let activeWorkspaceTheme = 'system'
let systemThemeQuery = null
let removeSystemThemeListener = null

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeHexColor(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (/^#[0-9a-f]{6}$/.test(normalized)) {
    return normalized
  }

  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    const [, r, g, b] = normalized
    return `#${r}${r}${g}${g}${b}${b}`
  }

  return fallback
}

function parseHexColor(value, fallback) {
  const normalized = normalizeHexColor(value, fallback)
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  }
}

function removeLegacyValue(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore localStorage failures.
  }
}

function readLegacyWorkspacePreferenceSnapshot() {
  const snapshot = {}

  try {
    for (const key of LEGACY_WORKSPACE_PREFERENCE_KEYS) {
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

export function clearLegacyWorkspacePreferenceStorage() {
  for (const key of LEGACY_WORKSPACE_PREFERENCE_KEYS) {
    removeLegacyValue(key)
  }
}

export function createWorkspacePreferenceState() {
  return {
    primarySurface: 'workspace',
    leftSidebarOpen: true,
    leftSidebarPanel: 'files',
    rightSidebarOpen: false,
    rightSidebarPanel: 'outline',
    autoSave: true,
    softWrap: true,
    wrapColumn: 0,
    editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
    uiFontSize: DEFAULT_UI_FONT_SIZE,
    appZoomPercent: DEFAULT_APP_ZOOM_PERCENT,
    proseFont: 'inter',
    pdfPageBackgroundFollowsTheme: DEFAULT_PDF_PAGE_BACKGROUND_FOLLOWS_THEME,
    pdfCustomPageBackground: DEFAULT_PDF_CUSTOM_PAGE_BACKGROUND,
    theme: 'system',
  }
}

export async function loadWorkspacePreferences(globalConfigDir = '') {
  const preferences = await invoke('workspace_preferences_load', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      legacyPreferences: readLegacyWorkspacePreferenceSnapshot(),
    },
  })

  clearLegacyWorkspacePreferenceStorage()
  return {
    ...createWorkspacePreferenceState(),
    ...preferences,
  }
}

export async function saveWorkspacePreferences(globalConfigDir = '', preferences = {}) {
  const normalized = await invoke('workspace_preferences_save', {
    params: {
      globalConfigDir: String(globalConfigDir || ''),
      preferences,
    },
  })

  clearLegacyWorkspacePreferenceStorage()
  return {
    ...createWorkspacePreferenceState(),
    ...normalized,
  }
}

export async function normalizeWorkbenchState(state = {}) {
  return invoke('workbench_state_normalize', {
    params: {
      primarySurface: String(state.primarySurface || ''),
      leftSidebarOpen: state.leftSidebarOpen !== false,
      leftSidebarPanel: String(state.leftSidebarPanel || ''),
      rightSidebarOpen: state.rightSidebarOpen === true,
      rightSidebarPanel: String(state.rightSidebarPanel || ''),
    },
  })
}

export function normalizeWorkspacePdfCustomPageBackground(value) {
  return normalizeHexColor(value, DEFAULT_PDF_CUSTOM_PAGE_BACKGROUND)
}

export function resolvePdfCustomPageForeground(value) {
  const { r, g, b } = parseHexColor(value, DEFAULT_PDF_CUSTOM_PAGE_BACKGROUND)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62
    ? DEFAULT_PDF_CUSTOM_PAGE_FOREGROUND_DARK
    : DEFAULT_PDF_CUSTOM_PAGE_FOREGROUND_LIGHT
}

export function normalizeAppZoomPercent(value) {
  const parsed = Math.round(Number(value) || DEFAULT_APP_ZOOM_PERCENT)
  return clamp(parsed, APP_ZOOM_PRESETS[0], APP_ZOOM_PRESETS[APP_ZOOM_PRESETS.length - 1])
}

export function normalizeEditorFontSize(value) {
  const parsed = Math.round(Number(value) || DEFAULT_EDITOR_FONT_SIZE)
  return clamp(parsed, MIN_EDITOR_FONT_SIZE, MAX_EDITOR_FONT_SIZE)
}

export function setWrapColumnPreference(value) {
  return Math.max(0, parseInt(value, 10) || 0)
}

export function setWorkspacePdfCustomPageBackground(value) {
  return normalizeWorkspacePdfCustomPageBackground(value)
}

export function setWorkspacePdfPageBackgroundFollowsTheme(value) {
  return value !== false
}

export function increaseWorkspaceZoom(currentPercent) {
  const normalized = normalizeAppZoomPercent(currentPercent)
  return (
    APP_ZOOM_PRESETS.find((preset) => preset > normalized) ||
    APP_ZOOM_PRESETS[APP_ZOOM_PRESETS.length - 1]
  )
}

export function decreaseWorkspaceZoom(currentPercent) {
  const normalized = normalizeAppZoomPercent(currentPercent)
  for (let idx = APP_ZOOM_PRESETS.length - 1; idx >= 0; idx -= 1) {
    if (APP_ZOOM_PRESETS[idx] < normalized) {
      return APP_ZOOM_PRESETS[idx]
    }
  }
  return APP_ZOOM_PRESETS[0]
}

export function resetWorkspaceZoom() {
  return DEFAULT_APP_ZOOM_PERCENT
}

export function setWorkspaceZoomPercent(percent) {
  return normalizeAppZoomPercent(percent)
}

export async function applyWorkspaceAppZoom(percent) {
  const nextValue = normalizeAppZoomPercent(percent)

  if (typeof document === 'undefined') return nextValue

  const root = document.documentElement
  root.style.removeProperty('zoom')

  const isTauriWebview =
    typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__?.metadata?.currentWebview
  if (isTauriWebview) {
    try {
      await getCurrentWebview().setZoom(1)
    } catch (error) {
      console.warn('[workspace] failed to reset native app zoom:', error)
    }
  }

  return nextValue
}

export function applyWorkspaceFontSizes(editorFontSize, uiFontSize) {
  if (typeof document === 'undefined') return

  document.documentElement.style.setProperty(
    '--editor-font-size',
    `${normalizeEditorFontSize(editorFontSize)}px`
  )
  document.documentElement.style.setProperty(
    '--ui-font-size',
    `${Math.max(1, Number(uiFontSize) || DEFAULT_UI_FONT_SIZE)}px`
  )
}

export function setWorkspaceEditorFontSize(editorFontSize) {
  const nextValue = normalizeEditorFontSize(editorFontSize)
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--editor-font-size', `${nextValue}px`)
  }
  return nextValue
}

export function setWorkspaceProseFont(name) {
  const nextFont = PROSE_FONT_STACKS[name] ? name : 'inter'
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty(
      '--font-prose',
      PROSE_FONT_STACKS[nextFont] || PROSE_FONT_STACKS.inter
    )
  }
  return nextFont
}

function resolveSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark'
  }
  return window.matchMedia(SYSTEM_THEME_MEDIA).matches ? 'dark' : 'light'
}

function applyWorkspaceThemeClasses(theme) {
  if (typeof document === 'undefined') return

  const normalizedTheme = normalizeWorkspaceThemeId(theme)
  const resolvedTheme = normalizedTheme === 'system' ? resolveSystemTheme() : normalizedTheme

  const root = document.documentElement
  root.classList.remove(...THEME_CLASSES)
  root.classList.add(`theme-${resolvedTheme}`)
  if (normalizedTheme === 'system') {
    root.classList.add('theme-system')
  }
  root.dataset.themePreference = normalizedTheme
  root.dataset.themeResolved = resolvedTheme

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('workspace-theme-updated', {
        detail: {
          themePreference: normalizedTheme,
          resolvedTheme,
        },
      })
    )
  }
}

function detachSystemThemeListener() {
  if (typeof removeSystemThemeListener === 'function') {
    removeSystemThemeListener()
  }
  removeSystemThemeListener = null
  systemThemeQuery = null
}

function attachSystemThemeListener() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  if (systemThemeQuery) return

  systemThemeQuery = window.matchMedia(SYSTEM_THEME_MEDIA)
  const handleChange = () => {
    if (activeWorkspaceTheme === 'system') {
      applyWorkspaceThemeClasses('system')
    }
  }

  if (typeof systemThemeQuery.addEventListener === 'function') {
    systemThemeQuery.addEventListener('change', handleChange)
    removeSystemThemeListener = () => systemThemeQuery?.removeEventListener('change', handleChange)
    return
  }

  if (typeof systemThemeQuery.addListener === 'function') {
    systemThemeQuery.addListener(handleChange)
    removeSystemThemeListener = () => systemThemeQuery?.removeListener(handleChange)
  }
}

function syncSystemThemeListener(theme) {
  activeWorkspaceTheme = normalizeWorkspaceThemeId(theme)
  if (activeWorkspaceTheme === 'system') {
    attachSystemThemeListener()
    return
  }
  detachSystemThemeListener()
}

export function setWorkspaceTheme(name) {
  const nextTheme = normalizeWorkspaceThemeId(name)
  syncSystemThemeListener(nextTheme)
  applyWorkspaceThemeClasses(nextTheme)
  return nextTheme
}

export function restoreWorkspaceTheme(currentTheme) {
  return setWorkspaceTheme(currentTheme || 'system')
}
