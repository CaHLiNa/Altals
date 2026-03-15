import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { gitAdd, gitCommit, gitStatus, gitRemoteGetUrl } from '../services/git'
import {
  getDefaultModelsConfig,
  getProviderDefaultUrl,
  mergeRemoteModelsIntoConfig,
  mergeWithDefaultModelsConfig,
  providerSupportsModelSync,
} from '../services/modelCatalog'
import { events } from '../services/telemetry'
import {
  loadWorkspaceUsage,
  openWorkspaceFileInEditor,
  reloadOpenFilesAfterPull,
} from '../services/workspaceStoreEffects'
import DEFAULT_SKILL_CONTENT from './defaultSkillContent.js'
import { removeWorkspaceBookmark } from '../services/workspacePermissions'
import {
  getHomeDirCached,
  hashWorkspacePath,
  resolveClaudeConfigDir,
  resolveSkillPath,
  resolveWorkspaceDataDir,
  normalizePathValue,
} from '../services/workspacePaths'
import {
  initProjectDir as bootstrapProjectDir,
  initWorkspaceDataDir as bootstrapWorkspaceDataDir,
  installEditHooks as installWorkspaceEditHooks,
  logWorkspaceBootstrapWarning,
  pathExists,
} from '../services/workspaceBootstrap'
import {
  loadWorkspaceInstructions,
  migrateAutoInstructionsFile as migrateWorkspaceInstructionsFile,
  resolveInstructionsFileToOpen,
} from '../services/workspaceInstructions'

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    path: null,
    settings: {},
    systemPrompt: '',
    instructions: '',
    apiKey: '',
    apiKeys: {},
    modelsConfig: null,
    gitAutoCommitInterval: 5 * 60 * 1000, // 5 minutes
    gitAutoCommitTimer: null,
    settingsOpen: false,
    settingsSection: null,
    leftSidebarOpen: localStorage.getItem('leftSidebarOpen') !== 'false',
    rightSidebarOpen: localStorage.getItem('rightSidebarOpen') === 'true',
    bottomPanelOpen: localStorage.getItem('bottomPanelOpen') === 'true',
    disabledTools: [],
    selectedModelId: localStorage.getItem('lastModelId') || '',
    ghostModelId: localStorage.getItem('ghostModelId') || '',
    ghostEnabled: localStorage.getItem('ghostEnabled') !== 'false',
    livePreviewEnabled: localStorage.getItem('livePreviewEnabled') !== 'false',
    softWrap: localStorage.getItem('softWrap') !== 'false',
    wrapColumn: parseInt(localStorage.getItem('wrapColumn')) || 0,
    spellcheck: localStorage.getItem('spellcheck') !== 'false',
    editorFontSize: parseInt(localStorage.getItem('editorFontSize')) || 14,
    uiFontSize: parseInt(localStorage.getItem('uiFontSize')) || 13,
    proseFont: localStorage.getItem('proseFont') || 'inter',
    docxZoomPercent: parseInt(localStorage.getItem('docxZoomPercent')) || 100,
    theme: localStorage.getItem('theme') || 'default',
    globalConfigDir: '',
    workspaceId: '',
    workspaceDataDir: '',
    claudeConfigDir: '',
    // GitHub sync
    githubToken: null,   // { token, login, name, email, id, avatarUrl }
    githubUser: null,
    githubInitialized: false,
    _githubInitPromise: null,
    syncStatus: 'disconnected', // idle | syncing | synced | error | conflict | disconnected
    syncError: null,
    syncErrorType: null, // auth | network | conflict | generic
    syncConflictBranch: null,
    lastSyncTime: null,
    remoteUrl: '',
    syncTimer: null,
    // Skills
    skillsManifest: null,  // Array<{ name, description, path }> | null
    _workspaceBootstrapPromise: null,
    _workspaceBootstrapGeneration: 0,
  }),

  getters: {
    isOpen: (state) => !!state.path,
    altalsDir: (state) => state.workspaceDataDir || null,
    shouldersDir: (state) => state.workspaceDataDir || null,
    projectDir: (state) => state.workspaceDataDir ? `${state.workspaceDataDir}/project` : null,
    claudeDir: (state) => state.claudeConfigDir || null,
    claudeHooksDir: (state) => state.globalConfigDir ? `${state.globalConfigDir}/claude-hooks` : null,
    legacyShouldersDir: (state) => state.path ? `${state.path}/.shoulders` : null,
    legacyProjectDir: (state) => state.path ? `${state.path}/.project` : null,
    legacyClaudeDir: (state) => state.path ? `${state.path}/.claude` : null,
    instructionsFilePath: (state) => state.path ? `${state.path}/_instructions.md` : null,
    internalInstructionsPath: (state) => state.workspaceDataDir ? `${state.workspaceDataDir}/project/instructions.md` : null,
  },

  actions: {
    async openWorkspace(path) {
      this.path = path

      // Resolve Altals global storage (~/.altals/)
      try { this.globalConfigDir = await invoke('get_global_config_dir') }
      catch { this.globalConfigDir = '' }
      this.workspaceId = this.globalConfigDir ? await hashWorkspacePath(path) : ''
      this.workspaceDataDir = resolveWorkspaceDataDir(this.globalConfigDir, this.workspaceId)
      this.claudeConfigDir = resolveClaudeConfigDir(this.globalConfigDir)
      this._workspaceBootstrapGeneration += 1
      const bootstrapGeneration = this._workspaceBootstrapGeneration
      this._workspaceBootstrapPromise = this._bootstrapWorkspace(path, bootstrapGeneration)
      this._workspaceBootstrapPromise.catch((error) => {
        if (bootstrapGeneration !== this._workspaceBootstrapGeneration || this.path !== path) return
        console.warn('[workspace] bootstrap failed:', error)
      })

      // Persist last workspace + add to recents
      try {
        localStorage.setItem('lastWorkspace', path)
        this.addRecent(path)
      } catch (e) { /* ignore */ }

      // Telemetry
      events.workspaceOpen()
    },

    async _bootstrapWorkspace(path, generation) {
      const isStale = () => generation !== this._workspaceBootstrapGeneration || this.path !== path
      const runStep = async (label, fn) => {
        if (isStale()) return false
        try {
          await fn()
          return !isStale()
        } catch (error) {
          logWorkspaceBootstrapWarning(label, error)
          return !isStale()
        }
      }

      if (!(await runStep('initWorkspaceDataDir', () => this.initWorkspaceDataDir()))) return
      if (!(await runStep('initProjectDir', () => this.initProjectDir()))) return
      if (!(await runStep('installEditHooks', () => this.installEditHooks()))) return
      if (!(await runStep('loadSettings', () => this.loadSettings()))) return

      let fsWatchReady = false
      if (!isStale()) {
        try {
          await invoke('watch_directory', {
            paths: [path, this.workspaceDataDir].filter(Boolean),
            recursivePaths: [this.workspaceDataDir].filter(Boolean),
          })
          fsWatchReady = true
        } catch (error) {
          logWorkspaceBootstrapWarning('watch_directory', error)
        }
      }

      if (fsWatchReady && !isStale()) {
        try {
          if (this._instructionsUnlisten) {
            this._instructionsUnlisten()
            this._instructionsUnlisten = null
          }
          this._instructionsUnlisten = await listen('fs-change', (event) => {
            const paths = event.payload?.paths || []
            const instructionsPaths = [
              this.instructionsFilePath,
              this.internalInstructionsPath,
            ].filter(Boolean)
            if (paths.some(path => instructionsPaths.includes(path))) {
              this.loadInstructions()
            }
          })
        } catch (error) {
          logWorkspaceBootstrapWarning('listen(fs-change)', error)
        }
      }

      if (!isStale()) {
        loadWorkspaceUsage(isStale)
      }

      if (!isStale()) {
        void this.startAutoCommit()
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

    // Recent workspaces (persisted in localStorage, max 10)
    getRecentWorkspaces() {
      try {
        return JSON.parse(localStorage.getItem('recentWorkspaces') || '[]')
      } catch { return [] }
    },

    addRecent(path) {
      const recents = this.getRecentWorkspaces().filter(r => r.path !== path)
      recents.unshift({ path, name: path.split('/').pop(), lastOpened: new Date().toISOString() })
      if (recents.length > 10) recents.length = 10
      localStorage.setItem('recentWorkspaces', JSON.stringify(recents))
    },

    removeRecent(path) {
      const recents = this.getRecentWorkspaces().filter(r => r.path !== path)
      localStorage.setItem('recentWorkspaces', JSON.stringify(recents))
      removeWorkspaceBookmark(path)
    },

    async closeWorkspace() {
      this._workspaceBootstrapGeneration += 1
      this._workspaceBootstrapPromise = null
      await this.cleanup()
      this.path = null
      this.systemPrompt = ''
      this.instructions = ''
      this.apiKey = ''
      this.apiKeys = {}
      this.modelsConfig = null
      this.skillsManifest = null
      this.workspaceId = ''
      this.workspaceDataDir = ''
      this.claudeConfigDir = ''
      this.githubToken = null
      this.githubUser = null
      this.githubInitialized = false
      this._githubInitPromise = null
      this.syncStatus = 'disconnected'
      this.syncError = null
      this.syncErrorType = null
      this.syncConflictBranch = null
      this.lastSyncTime = null
      this.remoteUrl = ''
      this._workspaceBootstrapPromise = null
      localStorage.removeItem('lastWorkspace')
    },

    async initWorkspaceDataDir() {
      await bootstrapWorkspaceDataDir({
        altalsDir: this.shouldersDir,
        legacyDir: this.legacyShouldersDir,
        globalConfigDir: this.globalConfigDir,
        workspaceId: this.workspaceId,
        workspacePath: this.path,
        defaultModelsConfig: getDefaultModelsConfig(),
      })
    },

    async initProjectDir() {
      await bootstrapProjectDir({
        projectDir: this.projectDir,
        altalsDir: this.shouldersDir,
        legacyShouldersDir: this.legacyShouldersDir,
        legacyProjectDir: this.legacyProjectDir,
        defaultSkillContent: DEFAULT_SKILL_CONTENT,
        migrateAutoInstructions: () => this.migrateAutoInstructionsFile(),
      })
    },

    async installEditHooks() {
      await installWorkspaceEditHooks({
        claudeDir: this.claudeDir,
        hooksDir: this.claudeHooksDir,
        legacyClaudeDir: this.legacyClaudeDir,
        globalConfigDir: this.globalConfigDir,
      })
    },

    async loadSettings() {
      const shouldersDir = this.shouldersDir
      if (!shouldersDir) return

      // Load system prompt
      try {
        this.systemPrompt = await invoke('read_file', {
          path: `${shouldersDir}/system.md`,
        })
      } catch (e) {
        this.systemPrompt = ''
      }

      // Load user instructions (_instructions.md at workspace root)
      await this.loadInstructions()

      // Load API keys from global ~/.altals/keys.env
      this.apiKeys = await this.loadGlobalKeys()

      // Migration: if global is empty, check workspace .env for real keys
      if (Object.keys(this.apiKeys).length === 0) {
        try {
          const envContent = await invoke('read_file', { path: `${shouldersDir}/.env` })
          const workspaceKeys = {}
          for (const line of envContent.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue
            const eqIdx = trimmed.indexOf('=')
            if (eqIdx > 0) {
              const key = trimmed.substring(0, eqIdx).trim()
              const value = trimmed.substring(eqIdx + 1).trim()
              if (value && !value.includes('your-')) {
                workspaceKeys[key] = value
              }
            }
          }
          if (Object.keys(workspaceKeys).length > 0) {
            await this.saveGlobalKeys(workspaceKeys)
            this.apiKeys = workspaceKeys
          }
        } catch { /* no workspace .env — that's fine */ }
      }

      // Backwards-compat alias
      this.apiKey = this.apiKeys.ANTHROPIC_API_KEY || ''

      // Load models config from global directory
      try {
        const modelsPath = this._modelsPath()
        const modelsContent = await invoke('read_file', { path: modelsPath })
        const { config, changed } = mergeWithDefaultModelsConfig(JSON.parse(modelsContent))
        this.modelsConfig = config
        if (changed) {
          await invoke('write_file', {
            path: modelsPath,
            content: JSON.stringify(config, null, 2),
          })
        }
      } catch (e) {
        this.modelsConfig = null
      }

      // Load tool permissions
      await this.loadToolPermissions()

      // Load skills manifest
      await this.loadSkillsManifest()
    },

    async loadSkillsManifest() {
      const projectDir = this.projectDir
      if (!projectDir) { this.skillsManifest = null; return }
      try {
        const skillsPath = `${projectDir}/skills/skills.json`
        const exists = await pathExists(skillsPath)
        if (!exists) { this.skillsManifest = null; return }
        const content = await invoke('read_file', { path: skillsPath })
        const data = JSON.parse(content)
        this.skillsManifest = Array.isArray(data.skills)
          ? data.skills.map(skill => ({
            ...skill,
            path: resolveSkillPath(projectDir, skill.path),
          }))
          : null
      } catch {
        this.skillsManifest = null
      }
    },

    async loadGlobalKeys() {
      if (!this.globalConfigDir) return {}
      const keysPath = `${this.globalConfigDir}/keys.env`
      try {
        const exists = await pathExists(keysPath)
        if (!exists) return {}
        const content = await invoke('read_file', { path: keysPath })
        const keys = {}
        for (const line of content.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const eqIdx = trimmed.indexOf('=')
          if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim()
            const value = trimmed.substring(eqIdx + 1).trim()
            if (value) keys[key] = value
          }
        }
        return keys
      } catch (e) {
        console.warn('Failed to load global keys:', e)
        return {}
      }
    },

    async saveGlobalKeys(keys) {
      if (!this.globalConfigDir) return
      const keysPath = `${this.globalConfigDir}/keys.env`
      const lines = []
      for (const [k, v] of Object.entries(keys)) {
        if (v) lines.push(`${k}=${v}`)
      }
      try {
        await invoke('write_file', {
          path: keysPath,
          content: lines.length > 0 ? lines.join('\n') + '\n' : '',
        })
      } catch (e) {
        console.warn('Failed to save global keys:', e)
      }
    },

    _modelsPath() {
      if (this.globalConfigDir) return `${this.globalConfigDir}/models.json`
      if (this.shouldersDir) return `${this.shouldersDir}/models.json`
      return ''
    },

    async saveModelsConfig(config) {
      const modelsPath = this._modelsPath()
      if (!modelsPath) return null

      const { config: normalized } = mergeWithDefaultModelsConfig(config || {})
      await invoke('write_file', {
        path: modelsPath,
        content: JSON.stringify(normalized, null, 2),
      })
      this.modelsConfig = normalized
      return normalized
    },

    async syncProviderModels({ providerIds = null } = {}) {
      if (!this.modelsConfig) {
        await this.loadSettings()
      }

      const baseConfig = mergeWithDefaultModelsConfig(this.modelsConfig || getDefaultModelsConfig()).config
      let nextConfig = baseConfig
      let addedCount = 0
      const syncedProviders = []
      const failedProviders = []

      const targetIds = (Array.isArray(providerIds) && providerIds.length > 0
        ? providerIds
        : Object.keys(nextConfig.providers || {})
      ).filter(providerSupportsModelSync)

      for (const providerId of targetIds) {
        const providerConfig = nextConfig.providers?.[providerId]
        const keyEnv = providerConfig?.apiKeyEnv
        const apiKey = keyEnv ? this.apiKeys?.[keyEnv] : ''
        if (!apiKey || apiKey.includes('your-')) continue

        const baseUrl = providerConfig?.customUrl || providerConfig?.url || getProviderDefaultUrl(providerId)
        if (!baseUrl) continue

        try {
          const remoteModels = await invoke('model_sync_list_openai_models', {
            baseUrl,
            apiKey,
          })
          const merged = mergeRemoteModelsIntoConfig(
            nextConfig,
            providerId,
            (remoteModels || []).map(entry => entry?.id).filter(Boolean),
          )
          nextConfig = merged.config
          addedCount += merged.addedCount
          syncedProviders.push(providerId)
        } catch (error) {
          failedProviders.push({
            provider: providerId,
            error: error?.message || String(error),
          })
        }
      }

      if (JSON.stringify(nextConfig) !== JSON.stringify(baseConfig)) {
        await this.saveModelsConfig(nextConfig)
      } else {
        this.modelsConfig = nextConfig
      }

      return {
        addedCount,
        syncedProviders,
        failedProviders,
      }
    },

    async migrateAutoInstructionsFile() {
      const rootPath = this.instructionsFilePath
      const internalPath = this.internalInstructionsPath
      if (!rootPath || !internalPath) return

      try {
        await migrateWorkspaceInstructionsFile({
          rootPath,
          internalPath,
        })
      } catch (error) {
        console.warn('Failed to migrate auto-generated instructions file:', error)
      }
    },

    async loadInstructions() {
      this.instructions = await loadWorkspaceInstructions({
        rootPath: this.instructionsFilePath,
        internalPath: this.internalInstructionsPath,
      })
    },

    async openInstructionsFile() {
      const filePath = await resolveInstructionsFileToOpen({
        rootPath: this.instructionsFilePath,
        internalPath: this.internalInstructionsPath,
      })
      if (!filePath) return

      openWorkspaceFileInEditor(filePath)
    },

    async loadToolPermissions() {
      if (!this.globalConfigDir) return
      const globalPath = `${this.globalConfigDir}/tools.json`
      try {
        const raw = await invoke('read_file', { path: globalPath })
        const data = JSON.parse(raw)
        this.disabledTools = Array.isArray(data.disabled) ? data.disabled : []
      } catch {
        // Global file doesn't exist — try migrating from workspace-local
        if (this.shouldersDir) {
          try {
            const localRaw = await invoke('read_file', { path: `${this.shouldersDir}/tools.json` })
            const localData = JSON.parse(localRaw)
            this.disabledTools = Array.isArray(localData.disabled) ? localData.disabled : []
            // Migrate to global
            await this.saveToolPermissions()
          } catch {
            this.disabledTools = []
          }
        } else {
          this.disabledTools = []
        }
      }
    },

    async saveToolPermissions() {
      if (!this.globalConfigDir) return
      try {
        await invoke('write_file', {
          path: `${this.globalConfigDir}/tools.json`,
          content: JSON.stringify({ version: 1, disabled: this.disabledTools }, null, 2),
        })
      } catch (e) {
        console.warn('Failed to save tool permissions:', e)
      }
    },

    toggleTool(name) {
      const idx = this.disabledTools.indexOf(name)
      if (idx >= 0) {
        this.disabledTools.splice(idx, 1)
      } else {
        this.disabledTools.push(name)
      }
      this.saveToolPermissions()
    },

    toggleLeftSidebar() {
      this.leftSidebarOpen = !this.leftSidebarOpen
      localStorage.setItem('leftSidebarOpen', String(this.leftSidebarOpen))
    },

    toggleRightSidebar() {
      this.rightSidebarOpen = !this.rightSidebarOpen
      localStorage.setItem('rightSidebarOpen', String(this.rightSidebarOpen))
    },

    toggleBottomPanel() {
      this.bottomPanelOpen = !this.bottomPanelOpen
      localStorage.setItem('bottomPanelOpen', String(this.bottomPanelOpen))
    },

    openBottomPanel() {
      if (!this.bottomPanelOpen) {
        this.bottomPanelOpen = true
        localStorage.setItem('bottomPanelOpen', 'true')
      }
    },

    openSettings(section = null) {
      this.settingsSection = section
      this.settingsOpen = true
    },

    closeSettings() {
      this.settingsOpen = false
      this.settingsSection = null
    },

    setSelectedModelId(id) {
      this.selectedModelId = id
      localStorage.setItem('lastModelId', id)
    },

    setGhostModelId(modelId) {
      this.ghostModelId = modelId
      localStorage.setItem('ghostModelId', modelId)
    },

    setGhostEnabled(val) {
      this.ghostEnabled = val
      localStorage.setItem('ghostEnabled', String(val))
    },

    toggleLivePreview() {
      this.livePreviewEnabled = !this.livePreviewEnabled
      localStorage.setItem('livePreviewEnabled', String(this.livePreviewEnabled))
    },

    toggleSoftWrap() {
      this.softWrap = !this.softWrap
      localStorage.setItem('softWrap', String(this.softWrap))
    },

    setWrapColumn(n) {
      this.wrapColumn = Math.max(0, parseInt(n) || 0)
      localStorage.setItem('wrapColumn', String(this.wrapColumn))
    },

    toggleSpellcheck() {
      this.spellcheck = !this.spellcheck
      localStorage.setItem('spellcheck', String(this.spellcheck))
    },

    zoomIn() {
      this.editorFontSize = Math.min(24, this.editorFontSize + 1)
      this.uiFontSize = Math.min(20, this.uiFontSize + 1)
      this.applyFontSizes()
    },

    zoomOut() {
      this.editorFontSize = Math.max(10, this.editorFontSize - 1)
      this.uiFontSize = Math.max(9, this.uiFontSize - 1)
      this.applyFontSizes()
    },

    resetZoom() {
      this.editorFontSize = 14
      this.uiFontSize = 13
      this.applyFontSizes()
    },

    setZoomPercent(pct) {
      this.editorFontSize = Math.round(14 * pct / 100)
      this.uiFontSize = Math.round(13 * pct / 100)
      this.editorFontSize = Math.max(10, Math.min(24, this.editorFontSize))
      this.uiFontSize = Math.max(9, Math.min(20, this.uiFontSize))
      this.applyFontSizes()
    },

    setDocxZoom(pct) {
      this.docxZoomPercent = Math.max(50, Math.min(200, Math.round(pct)))
      localStorage.setItem('docxZoomPercent', String(this.docxZoomPercent))
    },

    docxZoomIn() {
      this.setDocxZoom(this.docxZoomPercent + 10)
    },

    docxZoomOut() {
      this.setDocxZoom(this.docxZoomPercent - 10)
    },

    resetDocxZoom() {
      this.setDocxZoom(100)
    },

    applyFontSizes() {
      document.documentElement.style.setProperty('--editor-font-size', this.editorFontSize + 'px')
      document.documentElement.style.setProperty('--ui-font-size', this.uiFontSize + 'px')
      localStorage.setItem('editorFontSize', String(this.editorFontSize))
      localStorage.setItem('uiFontSize', String(this.uiFontSize))
    },

    setProseFont(name) {
      this.proseFont = name
      localStorage.setItem('proseFont', name)
      const stacks = {
        inter: "'Inter', system-ui, sans-serif",
        stix:  "'STIX Two Text', Georgia, serif",
        mono:  "'JetBrains Mono', 'Menlo', 'Consolas', monospace",
      }
      document.documentElement.style.setProperty('--font-prose', stacks[name] || stacks.geist)
    },

    restoreProseFont() {
      this.setProseFont(this.proseFont)
    },

    setTheme(name) {
      this.theme = name
      localStorage.setItem('theme', name)
      events.themeChange(name)
      // Remove any existing theme class, apply new one
      const el = document.documentElement
      el.classList.remove('theme-light', 'theme-monokai', 'theme-nord', 'theme-solarized', 'theme-humane', 'theme-one-light', 'theme-dracula')
      if (name !== 'default') {
        el.classList.add(`theme-${name}`)
      }
    },

    restoreTheme() {
      const saved = localStorage.getItem('theme')
      if (!saved) {
        // First launch — pick based on OS preference
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
        this.setTheme(prefersDark ? 'monokai' : 'humane')
      } else if (this.theme !== 'default') {
        document.documentElement.classList.add(`theme-${this.theme}`)
      }
    },

    async startAutoCommit() {
      this.stopAutoCommit()
      if (!(await this._canAutoCommitWorkspace())) return

      this.gitAutoCommitTimer = setInterval(async () => {
        await this.autoCommit()
      }, this.gitAutoCommitInterval)
    },

    stopAutoCommit() {
      if (this.gitAutoCommitTimer) {
        clearInterval(this.gitAutoCommitTimer)
        this.gitAutoCommitTimer = null
      }
    },

    async _canAutoCommitWorkspace(path = this.path) {
      if (!path) return false
      const normalizedPath = normalizePathValue(path)
      const normalizedHome = await getHomeDirCached()
      if (normalizedHome && normalizedPath === normalizedHome) {
        return false
      }
      return pathExists(`${normalizedPath}/.git`)
    },

    async autoCommit() {
      if (!(await this._canAutoCommitWorkspace())) return
      try {
        // Stage all changes
        await gitAdd(this.path)

        // Check if there are changes to commit
        const status = await gitStatus(this.path)
        if (status.trim()) {
          const now = new Date()
          const timestamp = now.toISOString().replace('T', ' ').substring(0, 16)
          await gitCommit(this.path, `Auto: ${timestamp}`)

          // Auto-push if GitHub is connected
          await this.autoSync()
        }
      } catch (e) {
        console.warn('Auto-commit failed:', e)
      }
    },

    // ── GitHub Sync ──

    async ensureGitHubInitialized(options = {}) {
      const force = options?.force === true
      if (this.githubInitialized && !force) return this.githubToken
      if (this._githubInitPromise && !force) return this._githubInitPromise

      this._githubInitPromise = (async () => {
        if (force) {
          this.githubToken = null
          this.githubUser = null
          this.syncStatus = 'disconnected'
          this.syncError = null
          this.syncErrorType = null
          this.syncConflictBranch = null
          this.lastSyncTime = null
        }

        try {
          const { loadGitHubToken, getGitHubUser } = await import('../services/githubSync')
          const stored = await loadGitHubToken()
          if (!stored?.token) {
            this.githubToken = null
            this.githubUser = null
            return null
          }

          this.githubToken = stored
          try {
            const user = await getGitHubUser(stored.token)
            this.githubUser = {
              login: user.login,
              name: user.name,
              email: user.email,
              id: user.id,
              avatarUrl: user.avatar_url,
            }
          } catch {
            this.githubToken = null
            this.githubUser = null
            return null
          }

          if (this.path) {
            this.remoteUrl = await gitRemoteGetUrl(this.path)
            if (this.remoteUrl) {
              this.syncStatus = 'idle'
              this.startSyncTimer()
            } else {
              this.syncStatus = 'disconnected'
            }
          }

          return stored
        } catch (e) {
          console.warn('[github] Init failed:', e)
          return null
        } finally {
          this.githubInitialized = true
          this._githubInitPromise = null
        }
      })()

      return this._githubInitPromise
    },

    async initGitHub(options = {}) {
      return this.ensureGitHubInitialized(options)
    },

    startSyncTimer() {
      this.stopSyncTimer()
      if (!this.githubToken?.token || !this.remoteUrl) return

      // Fetch from remote every 5 minutes
      this.syncTimer = setInterval(async () => {
        await this.fetchRemoteChanges()
      }, 5 * 60 * 1000)
    },

    stopSyncTimer() {
      if (this.syncTimer) {
        clearInterval(this.syncTimer)
        this.syncTimer = null
      }
    },

    async autoSync() {
      if (!this.path) return
      const remote = await gitRemoteGetUrl(this.path)
      if (!remote) return
      this.remoteUrl = remote

      await this.ensureGitHubInitialized()
      if (!this.githubToken?.token) return

      // Use the full sync cycle (fetch→check→pull/merge→push)
      const { syncNow, syncState } = await import('../services/githubSync')
      await syncNow(this.path, this.githubToken.token)
      this._applySyncState(syncState)
    },

    async fetchRemoteChanges() {
      await this.ensureGitHubInitialized()
      if (!this.path || !this.githubToken?.token) return
      const remote = await gitRemoteGetUrl(this.path)
      if (!remote) return

      const { fetchAndPull, syncState } = await import('../services/githubSync')
      const result = await fetchAndPull(this.path, this.githubToken.token)
      this._applySyncState(syncState)

      // If files were pulled, reload open files
      if (result.pulled) {
        try {
          await reloadOpenFilesAfterPull()
        } catch {}
      }

      return result
    },

    async syncNow() {
      await this.ensureGitHubInitialized()
      if (!this.path || !this.githubToken?.token) return
      const { syncNow, syncState } = await import('../services/githubSync')
      await syncNow(this.path, this.githubToken.token)
      this._applySyncState(syncState)
    },

    _applySyncState(syncState) {
      this.syncStatus = syncState.status
      this.syncError = syncState.error
      this.syncErrorType = syncState.errorType || null
      this.syncConflictBranch = syncState.conflictBranch
      this.lastSyncTime = syncState.lastSyncTime
      this.remoteUrl = syncState.remoteUrl || this.remoteUrl
    },

    async connectGitHub(tokenData) {
      const { storeGitHubToken, getGitHubUser, configureGitUser, ensureGitignore } = await import('../services/githubSync')
      await storeGitHubToken(tokenData)
      this.githubToken = tokenData
      this.githubInitialized = true

      // Use user data from OAuth callback if available, otherwise fetch from GitHub
      let user
      if (tokenData.login) {
        user = tokenData
      } else {
        const ghUser = await getGitHubUser(tokenData.token)
        user = {
          login: ghUser.login,
          name: ghUser.name,
          email: ghUser.email,
          id: ghUser.id,
          avatarUrl: ghUser.avatar_url,
        }
      }

      this.githubUser = {
        login: user.login,
        name: user.name,
        email: user.email,
        id: user.id,
        avatarUrl: user.avatarUrl || user.avatar_url,
      }

      // Set git user identity from GitHub profile
      if (this.path) {
        await configureGitUser(this.path, this.githubUser)
        await ensureGitignore(this.path)
      }
    },

    async disconnectGitHub() {
      const { clearGitHubToken } = await import('../services/githubSync')
      await clearGitHubToken()
      this.stopSyncTimer()
      this.githubToken = null
      this.githubUser = null
      this.githubInitialized = true
      this._githubInitPromise = null
      this.syncStatus = 'disconnected'
      this.syncError = null
      this.syncErrorType = null
      this.syncConflictBranch = null
    },

    async linkRepo(cloneUrl) {
      if (!this.path) return
      const { setupRemote, ensureGitignore, syncState } = await import('../services/githubSync')
      await setupRemote(this.path, cloneUrl)
      await ensureGitignore(this.path)
      this.remoteUrl = cloneUrl
      this.syncStatus = 'idle'
      this.startSyncTimer()

      // Initial push
      await this.autoSync()
    },

    async unlinkRepo() {
      if (!this.path) return
      const { removeRemote } = await import('../services/githubSync')
      await removeRemote(this.path)
      this.stopSyncTimer()
      this.remoteUrl = ''
      this.syncStatus = 'disconnected'
      this.syncConflictBranch = null
    },

    async cleanup() {
      this._workspaceBootstrapGeneration += 1
      this._workspaceBootstrapPromise = null
      this.stopAutoCommit()
      this.stopSyncTimer()
      if (this._instructionsUnlisten) {
        this._instructionsUnlisten()
        this._instructionsUnlisten = null
      }
      if (this.path) {
        await invoke('unwatch_directory').catch((error) => {
          console.warn('[workspace] unwatch_directory failed:', error)
        })
      }
    },
  },
})
