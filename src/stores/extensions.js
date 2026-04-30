import { defineStore } from 'pinia'
import { useWorkspaceStore } from './workspace'
import {
  listExtensions,
  loadExtensionSettings,
  saveExtensionSettings,
} from '../services/extensions/extensionRegistry'
import {
  cancelExtensionTask as cancelExtensionTaskWithBackend,
  getExtensionTask,
  listExtensionTasks,
  startExtensionTask,
} from '../services/extensions/extensionTasks'
import {
  openExtensionArtifact as openExtensionArtifactWithBackend,
  revealExtensionArtifact as revealExtensionArtifactWithBackend,
} from '../services/extensions/extensionArtifacts'

function normalizeExtensionId(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeCapability(value = '') {
  return String(value || '').trim()
}

function normalizeExtension(extension = {}) {
  const manifest = extension?.manifest && typeof extension.manifest === 'object' ? extension.manifest : {}
  const canonicalMenus = manifest?.contributes?.menus && typeof manifest.contributes.menus === 'object'
    ? manifest.contributes.menus
    : {}
  const canonicalCommands = Array.isArray(manifest?.contributes?.commands) ? manifest.contributes.commands : []
  const canonicalCapabilities = Array.isArray(manifest?.contributes?.capabilities) ? manifest.contributes.capabilities : []
  const capabilityByCommand = new Map()
  for (const command of canonicalCommands) {
    const commandId = String(command?.command || '').trim()
    if (!commandId) continue
    const matchedCapability = canonicalCapabilities.find((capability) => {
      const capabilityId = normalizeCapability(capability?.id)
      return capabilityId && (
        commandId === capabilityId ||
        commandId.endsWith(`.${capabilityId}`) ||
        commandId.includes(capabilityId.replace(/\./g, ''))
      )
    })
    if (matchedCapability) {
      capabilityByCommand.set(commandId, normalizeCapability(matchedCapability.id))
    }
  }
  const contributedActions = Object.entries(canonicalMenus)
    .flatMap(([surface, entries]) =>
      (Array.isArray(entries) ? entries : []).map((entry) => ({
        id: String(entry?.command || '').trim(),
        extensionId: normalizeExtensionId(extension.id),
        surface: String(surface || '').trim(),
        capability: capabilityByCommand.get(String(entry?.command || '').trim()) || '',
        label: String(entry?.title || entry?.command || '').trim(),
        icon: '',
        command: String(entry?.command || '').trim(),
        when: String(entry?.when || '').trim(),
      }))
    )
    .filter((action) => action.id && action.surface && action.capability)

  return {
    ...extension,
    id: normalizeExtensionId(extension.id),
    name: String(extension.name || extension.id || ''),
    version: String(extension.version || ''),
    description: String(extension.description || ''),
    scope: String(extension.scope || ''),
    status: String(extension.status || 'invalid'),
    manifestFormat: String(extension.manifestFormat || ''),
    main: String(manifest?.main || ''),
    activationEvents: Array.isArray(manifest?.activationEvents) ? manifest.activationEvents : [],
    extensionKind: Array.isArray(manifest?.extensionKind) ? manifest.extensionKind : [],
    capabilities: Array.isArray(extension.capabilities) ? extension.capabilities.map(normalizeCapability).filter(Boolean) : [],
    warnings: Array.isArray(extension.warnings) ? extension.warnings : [],
    errors: Array.isArray(extension.errors) ? extension.errors : [],
    settingsSchema:
      manifest?.contributes?.configuration?.properties && typeof manifest.contributes.configuration.properties === 'object'
        ? Object.fromEntries(
            Object.entries(manifest.contributes.configuration.properties).map(([key, definition]) => [
              key.split('.').pop() || key,
              {
                type: String(definition?.type || ''),
                default: Object.prototype.hasOwnProperty.call(definition || {}, 'default')
                  ? definition.default
                  : '',
                label: key.split('.').pop() || key,
                description: String(definition?.description || ''),
                options: Array.isArray(definition?.enum)
                  ? definition.enum.map((value, index) => ({
                      value,
                      label: Array.isArray(definition?.enumItemLabels) ? String(definition.enumItemLabels[index] || value) : String(value),
                    }))
                  : [],
              },
            ])
          )
        : {},
    uiActions: contributedActions,
  }
}

function normalizeTask(task = {}) {
  return {
    ...task,
    id: String(task.id || ''),
    extensionId: normalizeExtensionId(task.extensionId),
    capability: normalizeCapability(task.capability),
    state: String(task.state || ''),
    artifacts: Array.isArray(task.artifacts) ? task.artifacts : [],
    error: String(task.error || ''),
  }
}

export const useExtensionsStore = defineStore('extensions', {
  state: () => ({
    registry: [],
    tasks: [],
    enabledExtensionIds: [],
    extensionConfig: {},
    loadingRegistry: false,
    loadingTasks: false,
    settingsHydrated: false,
    settingsFileExists: false,
    lastError: '',
  }),

  getters: {
    enabledExtensions(state) {
      const enabled = new Set(state.enabledExtensionIds.map(normalizeExtensionId))
      return state.registry.filter((extension) => enabled.has(extension.id))
    },
    actionsForSurface: (state) => (surface = '') => {
      const normalizedSurface = String(surface || '').trim()
      if (!normalizedSurface) return []
      const enabled = new Set(state.enabledExtensionIds.map(normalizeExtensionId))
      return state.registry
        .filter((extension) => enabled.has(extension.id) && extension.status === 'available')
        .flatMap((extension) =>
          (extension.uiActions || [])
            .filter((action) => action.surface === normalizedSurface)
            .map((action) => ({
              ...action,
              extensionId: extension.id,
              extensionName: extension.name,
            }))
        )
    },
    recentTasks(state) {
      return [...state.tasks].slice(0, 8)
    },
    defaultConfigForExtension: () => (extension = {}) => {
      const defaults = {}
      const schema = extension.settingsSchema || {}
      for (const [key, definition] of Object.entries(schema)) {
        if (definition && Object.prototype.hasOwnProperty.call(definition, 'default')) {
          defaults[key] = definition.default
        }
      }
      return defaults
    },
    configForExtension: (state) => (extension = {}) => {
      const defaults = {}
      const schema = extension.settingsSchema || {}
      for (const [key, definition] of Object.entries(schema)) {
        if (definition && Object.prototype.hasOwnProperty.call(definition, 'default')) {
          defaults[key] = definition.default
        }
      }
      const saved = state.extensionConfig?.[normalizeExtensionId(extension.id)]
      return {
        ...defaults,
        ...(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}),
      }
    },
  },

  actions: {
    snapshotSettings() {
      return {
        enabledExtensionIds: [...this.enabledExtensionIds],
        extensionConfig: { ...this.extensionConfig },
      }
    },

    async hydrateSettings(force = false) {
      if (!force && this.settingsHydrated) return this.snapshotSettings()
      const workspace = useWorkspaceStore()
      const globalConfigDir = await workspace.ensureGlobalConfigDir()
      const settings = await loadExtensionSettings(globalConfigDir)
      this.enabledExtensionIds = Array.isArray(settings?.enabledExtensionIds)
        ? settings.enabledExtensionIds.map(normalizeExtensionId).filter(Boolean)
        : []
      this.extensionConfig = settings?.extensionConfig && typeof settings.extensionConfig === 'object'
        ? { ...settings.extensionConfig }
        : {}
      this.settingsFileExists = Boolean(settings?.settingsExists)
      this.settingsHydrated = true
      return this.snapshotSettings()
    },

    async persistSettings(patch = {}) {
      const workspace = useWorkspaceStore()
      const globalConfigDir = await workspace.ensureGlobalConfigDir()
      const next = {
        ...this.snapshotSettings(),
        ...patch,
      }
      const saved = await saveExtensionSettings(globalConfigDir, next)
      this.enabledExtensionIds = Array.isArray(saved?.enabledExtensionIds)
        ? saved.enabledExtensionIds.map(normalizeExtensionId).filter(Boolean)
        : []
      this.extensionConfig = saved?.extensionConfig && typeof saved.extensionConfig === 'object'
        ? { ...saved.extensionConfig }
        : {}
      this.settingsFileExists = true
      this.settingsHydrated = true
      return this.snapshotSettings()
    },

    async refreshRegistry() {
      const workspace = useWorkspaceStore()
      const globalConfigDir = await workspace.ensureGlobalConfigDir()
      this.loadingRegistry = true
      this.lastError = ''
      try {
        const extensions = await listExtensions(globalConfigDir, workspace.path || '')
        this.registry = extensions.map(normalizeExtension)
        if (!this.settingsHydrated) {
          await this.hydrateSettings()
        }
        if (!this.settingsFileExists && this.enabledExtensionIds.length === 0) {
          const availableIds = this.registry
            .filter((extension) => extension.status === 'available')
            .map((extension) => extension.id)
          if (availableIds.length > 0) {
            await this.persistSettings({ enabledExtensionIds: availableIds })
          }
        }
        return this.registry
      } catch (error) {
        this.lastError = error?.message || String(error || '')
        throw error
      } finally {
        this.loadingRegistry = false
      }
    },

    async refreshTasks() {
      this.loadingTasks = true
      try {
        this.tasks = []
        this.tasks = (await listExtensionTasks()).map(normalizeTask)
        return this.tasks
      } finally {
        this.loadingTasks = false
      }
    },

    async setExtensionEnabled(extensionId = '', enabled = true) {
      const id = normalizeExtensionId(extensionId)
      const ids = new Set(this.enabledExtensionIds.map(normalizeExtensionId))
      if (enabled) {
        ids.add(id)
      } else {
        ids.delete(id)
      }
      return this.persistSettings({ enabledExtensionIds: [...ids] })
    },

    async setExtensionConfigValue(extensionId = '', key = '', value = '') {
      const id = normalizeExtensionId(extensionId)
      const configKey = String(key || '').trim()
      if (!id || !configKey) return this.snapshotSettings()
      const current = this.extensionConfig?.[id] && typeof this.extensionConfig[id] === 'object'
        ? this.extensionConfig[id]
        : {}
      const nextExtensionConfig = {
        ...this.extensionConfig,
        [id]: {
          ...current,
          [configKey]: value,
        },
      }
      return this.persistSettings({ extensionConfig: nextExtensionConfig })
    },
    async startExtensionAction(action = {}, target = {}, settings = {}) {
      const extensionId = normalizeExtensionId(action.extensionId)
      const capability = normalizeCapability(action.capability)
      const extension = this.registry.find((extension) => extension.id === extensionId)
      if (!extension || extension.status !== 'available') {
        throw new Error(`Extension action is not available: ${extensionId || capability}`)
      }
      if (!extension.capabilities.includes(capability)) {
        throw new Error(`Extension ${extensionId} does not provide ${capability}`)
      }
      const workspace = useWorkspaceStore()
      const globalConfigDir = await workspace.ensureGlobalConfigDir()
      const extensionSettings = this.configForExtension(extension)
      const task = normalizeTask(await startExtensionTask({
        globalConfigDir,
        workspaceRoot: workspace.path || '',
        extensionId,
        capability,
        target,
        settings: {
          ...extensionSettings,
          ...(settings && typeof settings === 'object' ? settings : {}),
        },
      }))
      await this.refreshTasks().catch(() => {})
      return task
    },

    async cancelTask(taskId = '') {
      const task = normalizeTask(await cancelExtensionTaskWithBackend(taskId))
      await this.refreshTasks().catch(() => {})
      return task
    },

    async refreshTask(taskId = '') {
      const task = normalizeTask(await getExtensionTask(taskId))
      const index = this.tasks.findIndex((item) => item.id === task.id)
      if (index >= 0) {
        this.tasks.splice(index, 1, task)
      } else {
        this.tasks.unshift(task)
      }
      return task
    },

    openArtifact(artifact = {}) {
      return openExtensionArtifactWithBackend(artifact)
    },

    revealArtifact(artifact = {}) {
      return revealExtensionArtifactWithBackend(artifact)
    },
  },
})
