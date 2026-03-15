const THEME_CLASSES = [
  'theme-light',
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

function readString(key, fallback = '') {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function readBoolean(key, fallback = false, falseValue = 'false') {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw !== falseValue
  } catch {
    return fallback
  }
}

function readTrueOnlyBoolean(key, fallback = false) {
  try {
    return localStorage.getItem(key) === 'true' || fallback
  } catch {
    return fallback
  }
}

function readNumber(key, fallback) {
  try {
    const parsed = parseInt(localStorage.getItem(key) || '', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  } catch {
    return fallback
  }
}

function writeValue(key, value) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Ignore localStorage failures.
  }
}

export function createWorkspacePreferenceState() {
  return {
    leftSidebarOpen: readBoolean('leftSidebarOpen', true),
    rightSidebarOpen: readTrueOnlyBoolean('rightSidebarOpen'),
    bottomPanelOpen: readTrueOnlyBoolean('bottomPanelOpen'),
    selectedModelId: readString('lastModelId'),
    ghostModelId: readString('ghostModelId'),
    ghostEnabled: readBoolean('ghostEnabled', true),
    livePreviewEnabled: readBoolean('livePreviewEnabled', true),
    softWrap: readBoolean('softWrap', true),
    wrapColumn: readNumber('wrapColumn', 0),
    spellcheck: readBoolean('spellcheck', true),
    editorFontSize: readNumber('editorFontSize', 14),
    uiFontSize: readNumber('uiFontSize', 13),
    proseFont: readString('proseFont', 'inter'),
    docxZoomPercent: readNumber('docxZoomPercent', 100),
    theme: readString('theme', 'default'),
  }
}

export function toggleStoredBoolean(currentValue, key) {
  const nextValue = !currentValue
  writeValue(key, nextValue)
  return nextValue
}

export function persistStoredString(key, value) {
  writeValue(key, value)
  return value
}

export function setWrapColumnPreference(value) {
  const nextValue = Math.max(0, parseInt(value, 10) || 0)
  writeValue('wrapColumn', nextValue)
  return nextValue
}

export function setDocxZoomPreference(value) {
  const nextValue = Math.max(50, Math.min(200, Math.round(value)))
  writeValue('docxZoomPercent', nextValue)
  return nextValue
}

export function increaseWorkspaceZoom(editorFontSize, uiFontSize) {
  return {
    editorFontSize: Math.min(24, editorFontSize + 1),
    uiFontSize: Math.min(20, uiFontSize + 1),
  }
}

export function decreaseWorkspaceZoom(editorFontSize, uiFontSize) {
  return {
    editorFontSize: Math.max(10, editorFontSize - 1),
    uiFontSize: Math.max(9, uiFontSize - 1),
  }
}

export function resetWorkspaceZoom() {
  return {
    editorFontSize: 14,
    uiFontSize: 13,
  }
}

export function setWorkspaceZoomPercent(percent) {
  return {
    editorFontSize: Math.max(10, Math.min(24, Math.round(14 * percent / 100))),
    uiFontSize: Math.max(9, Math.min(20, Math.round(13 * percent / 100))),
  }
}

export function applyWorkspaceFontSizes(editorFontSize, uiFontSize) {
  document.documentElement.style.setProperty('--editor-font-size', `${editorFontSize}px`)
  document.documentElement.style.setProperty('--ui-font-size', `${uiFontSize}px`)
  writeValue('editorFontSize', editorFontSize)
  writeValue('uiFontSize', uiFontSize)
}

export function setWorkspaceProseFont(name) {
  writeValue('proseFont', name)
  document.documentElement.style.setProperty('--font-prose', PROSE_FONT_STACKS[name] || PROSE_FONT_STACKS.inter)
}

export function setWorkspaceTheme(name) {
  writeValue('theme', name)
  const root = document.documentElement
  root.classList.remove(...THEME_CLASSES)
  if (name !== 'default') {
    root.classList.add(`theme-${name}`)
  }
}

export function restoreWorkspaceTheme(currentTheme) {
  const savedTheme = readString('theme')
  if (!savedTheme) {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'monokai' : 'humane'
  }

  if (currentTheme !== 'default') {
    document.documentElement.classList.add(`theme-${currentTheme}`)
  }
  return null
}
