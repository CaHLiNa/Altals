import {
  IconBooks,
  IconCpu,
  IconEdit,
  IconPalette,
  IconRefresh,
  IconSparkles,
} from '@tabler/icons-vue'

export const SETTINGS_SECTION_DEFINITIONS = [
  {
    id: 'theme',
    labelKey: 'Appearance',
    descriptionKey: 'Themes, reading surfaces, and PDF viewing.',
    icon: IconPalette,
  },
  {
    id: 'editor',
    labelKey: 'Writing',
    descriptionKey: 'Writing defaults, editor behavior, and drafting tools.',
    icon: IconEdit,
  },
  {
    id: 'agent',
    labelKey: 'Agent',
    descriptionKey: 'Codex runtime, skills, research defaults, and built-in tools.',
    icon: IconSparkles,
  },
  {
    id: 'zotero',
    labelKey: 'References',
    descriptionKey: 'Reference sync, citations, and Zotero connection.',
    icon: IconBooks,
  },
  {
    id: 'system',
    labelKey: 'Environment',
    descriptionKey: 'LaTeX compilers, engines, downloads, and diagnostics.',
    icon: IconCpu,
  },
  {
    id: 'updates',
    labelKey: 'About',
    descriptionKey: 'Application version, release notes, and downloads.',
    icon: IconRefresh,
  },
]

export function normalizeSettingsSectionId(sectionId = '') {
  const normalized = String(sectionId || '').trim()
  if (normalized === 'ai' || normalized === 'skills') return 'agent'
  return normalized || 'theme'
}
