import { invoke } from '@tauri-apps/api/core'
import { t } from '../i18n/index.js'
import { useLatexStore } from '../stores/latex.js'
import { useToastStore } from '../stores/toast.js'
import { useTypstStore } from '../stores/typst.js'
import { useUxStatusStore } from '../stores/uxStatus.js'
import { useWorkspaceStore } from '../stores/workspace.js'

const COMMAND_CACHE_MS = 5 * 60 * 1000
const commandCache = new Map()

async function resolveCommandAvailable(command) {
  const cached = commandCache.get(command)
  if (cached && Date.now() - cached.checkedAt < COMMAND_CACHE_MS) {
    return cached.available
  }

  let available = false
  try {
    const path = await invoke('resolve_command_path', { command })
    available = !!String(path || '').trim()
  } catch {
    available = false
  }

  commandCache.set(command, {
    checkedAt: Date.now(),
    available,
  })
  return available
}

function openSettingsFooterAction(section = 'environment') {
  return {
    type: 'open-settings',
    section,
    label: t('Open Settings'),
  }
}

function showBlockedFeedback(key, message, { section = 'environment', type = 'warning', cooldown = 6000 } = {}) {
  const workspace = useWorkspaceStore()
  const toastStore = useToastStore()
  const uxStatusStore = useUxStatusStore()

  uxStatusStore.showOnce(`ux:${key}`, message, {
    type,
    duration: 5000,
    action: openSettingsFooterAction(section),
  }, cooldown)

  toastStore.showOnce(`toast:${key}`, message, {
    type,
    duration: 8000,
    action: {
      label: t('Settings'),
      onClick: () => workspace.openSettings(section),
    },
  }, cooldown)

  return false
}

export async function ensureLatexCompileReady() {
  const latexStore = useLatexStore()
  await latexStore.checkCompilers()

  if (latexStore.hasAvailableCompiler) return true

  if (latexStore.compilerPreference === 'system') {
    return showBlockedFeedback('missing-system-tex', t('System TeX is not available. Install latexmk or switch compiler in Environment settings.'))
  }

  if (latexStore.compilerPreference === 'tectonic') {
    return showBlockedFeedback('missing-tectonic', t('Tectonic is not installed. Download it from Environment settings.'))
  }

  return showBlockedFeedback('missing-latex', t('No LaTeX compiler found. Install System TeX or Tectonic in Environment settings.'))
}

export async function ensureTypstCompileReady() {
  const typstStore = useTypstStore()
  await typstStore.checkCompiler()
  if (typstStore.available) return true
  return showBlockedFeedback('missing-typst', t('Typst CLI not found. Install or download it in Environment settings.'))
}

export async function ensureGitHubSyncReady() {
  if (await resolveCommandAvailable('git')) return true
  return showBlockedFeedback('missing-git-sync', t('Git is not installed. Install Git, then retry GitHub sync.'))
}
