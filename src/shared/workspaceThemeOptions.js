export const WORKSPACE_THEME_IDS = ['system', 'light', 'dark']

export const WORKSPACE_THEME_OPTIONS = [
  {
    id: 'system',
    label: 'System',
    description: 'Follow your device appearance automatically.',
    colors: {
      bgPrimary: 'linear-gradient(135deg, #1c1c1e 0%, #1c1c1e 48%, #ffffff 52%, #ffffff 100%)',
      bgSecondary: 'linear-gradient(135deg, #242426 0%, #242426 48%, #f5f6f8 52%, #f5f6f8 100%)',
      fgMuted: '#8e8e93',
      accent: '#4f8cff',
      accentSecondary: '#5f9ea0',
      success: '#32d74b',
      error: '#ff7575',
    },
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Bright canvas for daylight drafting.',
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f5f6f8',
      fgMuted: '#999999',
      accent: '#5f9ea0',
      accentSecondary: '#4a7c7e',
      success: '#2e7d32',
      error: '#c62828',
    },
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Low-glare canvas for focused writing.',
    colors: {
      bgPrimary: '#1c1c1e',
      bgSecondary: '#242426',
      fgMuted: '#8e8e93',
      accent: '#4f8cff',
      accentSecondary: '#7aa2ff',
      success: '#32d74b',
      error: '#ff7575',
    },
  },
]

const LEGACY_THEME_MAPPINGS = {
  system: 'system',
  light: 'light',
  solarized: 'light',
  humane: 'light',
  'one-light': 'light',
  dark: 'dark',
  default: 'dark',
  dracula: 'dark',
  monokai: 'dark',
  nord: 'dark',
}

export function normalizeWorkspaceThemeId(value) {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase()
  return LEGACY_THEME_MAPPINGS[normalizedValue] || 'system'
}
