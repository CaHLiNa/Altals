import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { removeWorkspaceBookmark } from '../services/workspacePermissions'
import {
  hashWorkspacePath,
  resolveClaudeConfigDir,
  resolveWorkspaceDataDir,
} from '../services/workspacePaths'
import {
  applyWorkspaceAppZoom,
  applyWorkspaceFontSizes,
  createWorkspacePreferenceState,
  decreaseWorkspaceZoom,
  increaseWorkspaceZoom,
  loadWorkspacePreferences as loadWorkspacePreferencesFromRust,
  normalizeAppZoomPercent,
  normalizeEditorFontSize,
  resetWorkspaceZoom,
  restoreWorkspaceTheme,
  saveWorkspacePreferences as saveWorkspacePreferencesToRust,
  setWorkspaceEditorFontSize,
  setWorkspacePdfCustomPageBackground,
  setWorkspacePdfPageBackgroundFollowsTheme,
  setWorkspaceProseFont,
  setWorkspaceZoomPercent,
  setWrapColumnPreference,
} from '../services/workspacePreferences'
import {
  normalizeWorkbenchSidebarPanel,
  normalizeWorkbenchSurface,
} from '../shared/workbenchSidebarPanels'
import { normalizeWorkbenchInspectorPanel } from '../shared/workbenchInspectorPanels.js'
import {
  addRecentWorkspace,
  clearLastWorkspace,
  getRecentWorkspaces as readRecentWorkspaces,
  removeRecentWorkspace,
  setLastWorkspace,
} from '../services/workspaceRecents'
import { basenamePath } from '../utils/path'

async function ensureDir(path) {
  if (!path) return
  await invoke('create_dir', { path }).catch(() => {})
}

async function bootstrapWorkspaceDirs(store) {
  await ensureDir(store.workspaceDataDir)
  await ensureDir(store.projectDir)

  await invoke('write_file', {
    path: `${store.workspaceDataDir}/workspace.json`,
    content: JSON.stringify(
        {
          id: store.workspaceId,
          path: store.path,
          name: basenamePath(store.path) || '',
          lastOpenedAt: new Date().toISOString(),
        },
      null,
      2
    ),
  }).catch(() => {})
}

const WORKSPACE_PREFERENCE_KEYS = [
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
  'theme',
]

function snapshotWorkspacePreferences(store) {
  return Object.fromEntries(WORKSPACE_PREFERENCE_KEYS.map((key) => [key, store[key]]))
}

function normalizeSettingsSectionValue(section = '') {
  const normalized = String(section || '').trim()
  return normalized || 'theme'
}

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    path: null,
    settingsOpen: false,
    settingsSection: null,
    globalConfigDir: '',
    workspaceId: '',
    workspaceDataDir: '',
    claudeConfigDir: '',
    _workspaceBootstrapPromise: null,
    _workspaceBootstrapGeneration: 0,
    _lastAppZoomInteractionAt: 0,
    _preferencesHydrated: false,
    ...createWorkspacePreferenceState(),
  }),

  getters: {
    isOpen: (state) => !!state.path,
    isWorkspaceSurface: (state) => normalizeWorkbenchSurface(state.primarySurface) === 'workspace',
    isSettingsSurface: (state) => normalizeWorkbenchSurface(state.primarySurface) === 'settings',
    scribeflowDir: (state) => state.workspaceDataDir || null,
    projectDir: (state) => (state.workspaceDataDir ? `${state.workspaceDataDir}/project` : null),
    claudeDir: (state) => state.claudeConfigDir || null,
    claudeHooksDir: (state) =>
      state.globalConfigDir ? `${state.globalConfigDir}/claude-hooks` : null,
    legacyProjectDir: (state) => (state.path ? `${state.path}/.project` : null),
    legacyClaudeDir: (state) => (state.path ? `${state.path}/.claude` : null),
  },

  actions: {
    applyWorkspacePreferenceState(preferences = {}) {
      const next = {
        ...createWorkspacePreferenceState(),
        ...preferences,
      }

      for (const key of WORKSPACE_PREFERENCE_KEYS) {
        this[key] = next[key]
      }

      this.settingsOpen = this.primarySurface === 'settings'
      if (!this.settingsOpen) {
        this.settingsSection = null
      } else if (!this.settingsSection) {
        this.settingsSection = normalizeSettingsSectionValue('theme')
      }
    },

    async ensureGlobalConfigDir() {
      if (this.globalConfigDir) return this.globalConfigDir

      try {
        this.globalConfigDir = await invoke('get_global_config_dir')
      } catch {
        this.globalConfigDir = ''
      }

      return this.globalConfigDir
    },

    async hydratePreferences(force = false) {
      if (!force && this._preferencesHydrated) return snapshotWorkspacePreferences(this)

      const globalConfigDir = await this.ensureGlobalConfigDir()
      const preferences = await loadWorkspacePreferencesFromRust(globalConfigDir)
      this.applyWorkspacePreferenceState(preferences)
      this._preferencesHydrated = true
      return preferences
    },

    async persistPreferences(patch = {}) {
      const globalConfigDir = await this.ensureGlobalConfigDir()
      const previous = snapshotWorkspacePreferences(this)
      const optimistic = {
        ...previous,
        ...patch,
      }

      this.applyWorkspacePreferenceState(optimistic)
      this._preferencesHydrated = true

      try {
        const preferences = await saveWorkspacePreferencesToRust(globalConfigDir, optimistic)
        this.applyWorkspacePreferenceState(preferences)
        this._preferencesHydrated = true
        return preferences
      } catch (error) {
        this.applyWorkspacePreferenceState(previous)
        throw error
      }
    },

    async openWorkspace(path) {
      this.path = path
      await this.ensureGlobalConfigDir()

      this.workspaceId = this.globalConfigDir ? await hashWorkspacePath(path) : ''
      this.workspaceDataDir = resolveWorkspaceDataDir(this.globalConfigDir, this.workspaceId)
      this.claudeConfigDir = resolveClaudeConfigDir(this.globalConfigDir)

      this._workspaceBootstrapGeneration += 1
      const generation = this._workspaceBootstrapGeneration
      this._workspaceBootstrapPromise = bootstrapWorkspaceDirs(this).catch((error) => {
        if (generation !== this._workspaceBootstrapGeneration) return
        console.warn('[workspace] bootstrap failed:', error)
      })

      try {
        setLastWorkspace(path)
        this.addRecent(path)
      } catch {
        // Ignore local storage failures.
      }
    },

    async ensureWorkspaceBootstrapReady(path = this.path) {
      if (!path) return
      const promise = this._workspaceBootstrapPromise
      if (!promise) return
      await promise
      if (path !== this.path) {
        throw new Error('Workspace changed during bootstrap')
      }
    },

    getRecentWorkspaces() {
      return readRecentWorkspaces()
    },

    addRecent(path) {
      addRecentWorkspace(path)
    },

    removeRecent(path) {
      removeRecentWorkspace(path)
      removeWorkspaceBookmark(path)
    },

    async closeWorkspace() {
      this._workspaceBootstrapGeneration += 1
      this._workspaceBootstrapPromise = null
      await this.cleanup()
      await this.openWorkspaceSurface()
      this.path = null
      this.globalConfigDir = ''
      this.workspaceId = ''
      this.workspaceDataDir = ''
      this.claudeConfigDir = ''
      clearLastWorkspace()
    },

    applyBrowserPreviewState(options = {}) {
      const isOpen = options.isOpen !== false
      this._workspaceBootstrapGeneration += 1
      this._workspaceBootstrapPromise = null

      this.path = isOpen ? String(options.path || this.path || '') : null
      this.globalConfigDir = isOpen ? String(options.globalConfigDir || this.globalConfigDir || '') : ''
      this.workspaceId = isOpen ? String(options.workspaceId || this.workspaceId || '') : ''
      this.workspaceDataDir = isOpen
        ? String(options.workspaceDataDir || this.workspaceDataDir || '')
        : ''
      this.claudeConfigDir = isOpen ? String(options.claudeConfigDir || this.claudeConfigDir || '') : ''

      const primarySurface = normalizeWorkbenchSurface(options.primarySurface || this.primarySurface || 'workspace')
      this.primarySurface = primarySurface
      this.settingsOpen = primarySurface === 'settings'
      this.settingsSection =
        primarySurface === 'settings'
          ? normalizeSettingsSectionValue(options.settingsSection || this.settingsSection || 'theme')
          : null

      this.leftSidebarOpen = isOpen ? options.leftSidebarOpen !== false : false
      this.leftSidebarPanel = normalizeWorkbenchSidebarPanel(
        primarySurface,
        options.leftSidebarPanel || this.leftSidebarPanel || 'files'
      )
      this.rightSidebarOpen = isOpen ? options.rightSidebarOpen === true : false
      this.rightSidebarPanel = normalizeWorkbenchInspectorPanel(
        primarySurface,
        options.rightSidebarPanel || this.rightSidebarPanel || 'outline'
      )
    },

    toggleLeftSidebar() {
      return this.persistPreferences({
        leftSidebarOpen: !this.leftSidebarOpen,
      })
    },

    setLeftSidebarPanel(panel) {
      return this.persistPreferences({
        leftSidebarPanel: String(panel || ''),
      })
    },

    setRightSidebarPanel(panel) {
      return this.persistPreferences({
        rightSidebarPanel: String(panel || ''),
      })
    },

    async setPrimarySurface(surface) {
      const nextSurface = String(surface || '').trim() || 'workspace'
      const preferences = await this.persistPreferences({
        primarySurface: nextSurface,
      })
      this.settingsOpen = preferences.primarySurface === 'settings'
      if (!this.settingsOpen) {
        this.settingsSection = null
      }
    },

    openWorkspaceSurface() {
      return this.setPrimarySurface('workspace')
    },

    toggleRightSidebar() {
      return this.persistPreferences({
        rightSidebarOpen: !this.rightSidebarOpen,
      })
    },

    openRightSidebar() {
      if (this.rightSidebarOpen) return
      return this.persistPreferences({
        rightSidebarOpen: true,
      })
    },

    closeRightSidebar() {
      if (!this.rightSidebarOpen) return
      return this.persistPreferences({
        rightSidebarOpen: false,
      })
    },

    toggleAutoSave() {
      return this.persistPreferences({
        autoSave: !this.autoSave,
      })
    },

    openSettings(section = null) {
      this.settingsSection = normalizeSettingsSectionValue(
        section || this.settingsSection || 'theme'
      )
      return this.setPrimarySurface('settings')
    },

    closeSettings() {
      return this.openWorkspaceSurface()
    },

    setSettingsSection(section) {
      this.settingsSection = normalizeSettingsSectionValue(section)
    },

    toggleSoftWrap() {
      return this.persistPreferences({
        softWrap: !this.softWrap,
      })
    },

    setWrapColumn(value) {
      return this.persistPreferences({
        wrapColumn: setWrapColumnPreference(value),
      })
    },

    setPdfCustomPageBackground(value) {
      return this.persistPreferences({
        pdfCustomPageBackground: setWorkspacePdfCustomPageBackground(value),
      })
    },

    setPdfPageBackgroundFollowsTheme(value) {
      return this.persistPreferences({
        pdfPageBackgroundFollowsTheme: setWorkspacePdfPageBackgroundFollowsTheme(value),
      })
    },

    async zoomIn() {
      this._lastAppZoomInteractionAt = Date.now()
      await this.setZoomPercent(increaseWorkspaceZoom(this.appZoomPercent))
    },

    async zoomOut() {
      this._lastAppZoomInteractionAt = Date.now()
      await this.setZoomPercent(decreaseWorkspaceZoom(this.appZoomPercent))
    },

    async resetZoom() {
      this._lastAppZoomInteractionAt = Date.now()
      await this.setZoomPercent(resetWorkspaceZoom())
    },

    async setZoomPercent(percent) {
      this._lastAppZoomInteractionAt = Date.now()
      await this.persistPreferences({
        appZoomPercent: setWorkspaceZoomPercent(percent),
      })
      await this.applyAppZoom()
    },

    applyFontSizes() {
      applyWorkspaceFontSizes(this.editorFontSize, this.uiFontSize)
    },

    async setEditorFontSize(value) {
      await this.persistPreferences({
        editorFontSize: setWorkspaceEditorFontSize(value),
      })
      this.applyFontSizes()
    },

    async applyAppZoom() {
      this.appZoomPercent = normalizeAppZoomPercent(this.appZoomPercent)
      await applyWorkspaceAppZoom(this.appZoomPercent)
    },

    async setProseFont(name) {
      await this.persistPreferences({
        proseFont: name,
      })
      this.restoreProseFont()
    },

    restoreProseFont() {
      this.proseFont = setWorkspaceProseFont(this.proseFont)
    },

    normalizeEditorFontSize() {
      this.editorFontSize = normalizeEditorFontSize(this.editorFontSize)
    },

    async setTheme(name) {
      await this.persistPreferences({
        theme: name,
      })
      this.restoreTheme()
    },

    restoreTheme() {
      this.theme = restoreWorkspaceTheme(this.theme)
    },

    async cleanup() {
      this._workspaceBootstrapGeneration += 1
      this._workspaceBootstrapPromise = null
    },
  },
})
