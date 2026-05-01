import { defineStore } from 'pinia'
import { useWorkspaceStore } from './workspace'
import {
  listExtensions,
  loadExtensionSettings,
  saveExtensionSettings,
} from '../services/extensions/extensionRegistry'
import {
  executeExtensionCommand,
  invokeExtensionCapability,
} from '../services/extensions/extensionCommands'
import {
  cancelExtensionTask as cancelExtensionTaskWithBackend,
  getExtensionTask,
  listExtensionTasks,
} from '../services/extensions/extensionTasks'
import {
  openExtensionArtifact as openExtensionArtifactWithBackend,
  revealExtensionArtifact as revealExtensionArtifactWithBackend,
} from '../services/extensions/extensionArtifacts'
import { writeNativeClipboardText } from '../services/nativeClipboard'
import {
  resolveExtensionView,
  notifyExtensionViewSelection,
} from '../services/extensions/extensionViews'
import {
  activateExtensionHost,
  updateExtensionHostSettings,
} from '../services/extensions/extensionHost'
import {
  listenExtensionTaskChanged,
  listenExtensionViewChanged,
  listenExtensionViewRevealRequested,
  listenExtensionViewStateChanged,
} from '../services/extensions/extensionHostEvents'
import {
  matchesWhenClause,
  normalizeExtensionContributions,
} from '../domains/extensions/extensionContributionRegistry'
import { buildExtensionContext } from '../domains/extensions/extensionContext.js'
import { mergeDefaultResultEntries } from '../services/extensions/extensionResultEntries'

function normalizeExtensionId(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeCapability(value = '') {
  return String(value || '').trim()
}

function normalizeTarget(target = {}) {
  return {
    kind: String(target?.kind || '').trim(),
    referenceId: String(target?.referenceId || '').trim(),
    path: String(target?.path || '').trim(),
  }
}

function targetHasValue(target = {}) {
  const normalized = normalizeTarget(target)
  return Boolean(normalized.kind || normalized.referenceId || normalized.path)
}

function normalizeExtension(extension = {}) {
  const manifest = extension?.manifest && typeof extension.manifest === 'object' ? extension.manifest : {}
  const contributions = normalizeExtensionContributions(extension)

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
    contributedCommands: contributions.commands,
    contributedMenus: contributions.menus,
    contributedKeybindings: contributions.keybindings,
    contributedViewContainers: contributions.viewContainers,
    contributedViews: contributions.views,
    contributedViewTitleMenus: contributions.viewTitleMenus,
    contributedViewItemMenus: contributions.viewItemMenus,
    contributedCapabilities: contributions.capabilities,
    warnings: Array.isArray(extension.warnings) ? extension.warnings : [],
    errors: Array.isArray(extension.errors) ? extension.errors : [],
    settingsSchema: contributions.configuration,
  }
}

function runtimeCapabilityIds(entry = {}) {
  const ids = new Set()
  const runtimeEntry = normalizeRuntimeEntry(entry)
  for (const capability of Array.isArray(runtimeEntry?.registeredCapabilities) ? runtimeEntry.registeredCapabilities : []) {
    const id = normalizeCapability(capability)
    if (id) ids.add(id)
  }
  return ids
}

function normalizeTask(task = {}) {
  return {
    ...task,
    id: String(task.id || ''),
    extensionId: normalizeExtensionId(task.extensionId),
    capability: normalizeCapability(task.capability),
    commandId: String(task.commandId || ''),
    state: String(task.state || ''),
    progress: task?.progress && typeof task.progress === 'object'
      ? {
          label: String(task.progress.label || ''),
          current: Number.isFinite(Number(task.progress.current)) ? Number(task.progress.current) : 0,
          total: Number.isFinite(Number(task.progress.total)) ? Number(task.progress.total) : 0,
        }
      : { label: '', current: 0, total: 0 },
    createdAt: String(task.createdAt || task.created_at || ''),
    startedAt: String(task.startedAt || task.started_at || ''),
    finishedAt: String(task.finishedAt || task.finished_at || ''),
    target: normalizeTarget(task?.target || {}),
    artifacts: Array.isArray(task.artifacts) ? task.artifacts : [],
    outputs: Array.isArray(task.outputs) ? task.outputs : [],
    error: String(task.error || ''),
    logPath: String(task.logPath || task.log_path || ''),
  }
}

function recentTasksForExtensionList(tasks = [], extensionId = '') {
  const normalizedExtensionId = normalizeExtensionId(extensionId)
  const filtered = normalizedExtensionId
    ? tasks.filter((task) => task.extensionId === normalizedExtensionId)
    : tasks
  return [...filtered].slice(0, 8)
}

function buildTaskTimeline(tasks = []) {
  const running = []
  const recent = []
  for (const task of tasks) {
    if (task.state === 'running' || task.state === 'queued') {
      running.push(task)
    } else {
      recent.push(task)
    }
  }
  return { running, recent }
}

function normalizeResolvedViewItem(item = {}) {
  const id = String(item?.id || '').trim()
  const handle = String(item?.handle || id).trim()
  return {
    ...item,
    id,
    handle,
    label: String(item?.label || item?.title || id || handle || ''),
    description: String(item?.description || ''),
    tooltip: String(item?.tooltip || ''),
    contextValue: String(item?.contextValue || item?.context_value || ''),
    icon: String(item?.icon || ''),
    commandId: String(item?.commandId || item?.command || ''),
    commandArguments: Array.isArray(item?.commandArguments) ? item.commandArguments : [],
    collapsibleState: String(item?.collapsibleState || ''),
    children: Array.isArray(item?.children) ? item.children.map(normalizeResolvedViewItem) : [],
  }
}

function normalizeSidebarSection(entry = {}, index = 0) {
  return {
    id: String(entry?.id || `section:${index}`).trim(),
    kind: String(entry?.kind || '').trim(),
    title: String(entry?.title || '').trim(),
    value: String(entry?.value || '').trim(),
    tone: String(entry?.tone || '').trim(),
  }
}

function normalizeResultEntry(entry = {}, index = 0) {
  return {
    id: String(entry?.id || `result:${index}`).trim(),
    label: String(entry?.label || entry?.title || '').trim(),
    description: String(entry?.description || '').trim(),
    path: String(entry?.path || '').trim(),
    action: String(entry?.action || '').trim(),
    commandId: String(entry?.commandId || entry?.command_id || '').trim(),
    targetPath: String(entry?.targetPath || entry?.target_path || '').trim(),
    referenceId: String(entry?.referenceId || entry?.reference_id || '').trim(),
    targetKind: String(entry?.targetKind || entry?.target_kind || '').trim(),
    extensionId: normalizeExtensionId(entry?.extensionId || entry?.extension_id || ''),
    payload: entry?.payload && typeof entry.payload === 'object' && !Array.isArray(entry.payload)
      ? entry.payload
      : {},
    previewMode: String(entry?.previewMode || entry?.preview_mode || '').trim(),
    previewPath: String(entry?.previewPath || entry?.preview_path || '').trim(),
    previewTitle: String(entry?.previewTitle || entry?.preview_title || '').trim(),
    mediaType: String(entry?.mediaType || entry?.media_type || '').trim(),
  }
}

function mergeResolvedViewState(current = {}, resolved = {}, parentItemId = '') {
  const normalizedParentItemId = String(parentItemId || '').trim()
  const items = Array.isArray(resolved?.items)
    ? resolved.items.map(normalizeResolvedViewItem)
    : []
  const currentParentItems = current?.parentItems && typeof current.parentItems === 'object'
    ? current.parentItems
    : {}
  return {
    ...(current && typeof current === 'object' ? current : {}),
    viewId: String(resolved?.viewId || current?.viewId || ''),
    title: String(resolved?.title || current?.title || ''),
    parentItems: {
      ...currentParentItems,
      [normalizedParentItemId]: items,
    },
    items,
  }
}

function normalizeRuntimeEntry(entry = {}) {
  return {
    activated: Boolean(entry?.activated),
    reason: String(entry?.reason || ''),
    registeredCommands: Array.isArray(entry?.registeredCommands)
      ? entry.registeredCommands.map((value) => String(value || '').trim()).filter(Boolean)
      : [],
    registeredCapabilities: Array.isArray(entry?.registeredCapabilities)
      ? entry.registeredCapabilities.map((value) => String(value || '').trim()).filter(Boolean)
      : [],
    registeredViews: Array.isArray(entry?.registeredViews)
      ? entry.registeredViews.map((value) => String(value || '').trim()).filter(Boolean)
      : [],
    registeredCommandDetails: Array.isArray(entry?.registeredCommandDetails)
      ? entry.registeredCommandDetails.map((item) => ({
        commandId: String(item?.commandId || '').trim(),
        title: String(item?.title || '').trim(),
        category: String(item?.category || '').trim(),
        when: String(item?.when || '').trim(),
      })).filter((item) => item.commandId)
      : [],
    registeredMenuActions: Array.isArray(entry?.registeredMenuActions)
      ? entry.registeredMenuActions.map((item) => ({
        commandId: String(item?.commandId || '').trim(),
        surface: String(item?.surface || '').trim(),
        title: String(item?.title || '').trim(),
        category: String(item?.category || '').trim(),
        when: String(item?.when || '').trim(),
        group: String(item?.group || '').trim(),
      })).filter((item) => item.commandId && item.surface)
      : [],
    registeredViewDetails: Array.isArray(entry?.registeredViewDetails)
      ? entry.registeredViewDetails.map((item) => ({
        id: String(item?.id || '').trim(),
        title: String(item?.title || '').trim(),
        when: String(item?.when || '').trim(),
      })).filter((item) => item.id)
      : [],
  }
}

function runtimeCommandIds(entry = {}) {
  const normalized = normalizeRuntimeEntry(entry)
  const commandIds = new Set(normalized.registeredCommands)
  for (const command of normalized.registeredCommandDetails) {
    if (command.commandId) {
      commandIds.add(command.commandId)
    }
  }
  return commandIds
}

function contributedViewForId(extension = {}, viewId = '') {
  const normalizedViewId = String(viewId || '').trim()
  if (!normalizedViewId) return null
  return (extension?.contributedViews || []).find(
    (view) => String(view?.id || '').trim() === normalizedViewId,
  ) || null
}

export const useExtensionsStore = defineStore('extensions', {
  state: () => ({
    registry: [],
    tasks: [],
    enabledExtensionIds: [],
    extensionConfig: {},
    resolvedViews: {},
    viewState: {},
    viewControllerState: {},
    runtimeRegistry: {},
    sidebarTargets: {},
    changedViewTicks: {},
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
    actionsForSurface() {
      return (surface = '', context = {}) => this.menuActionsForSurface(surface, context)
    },
    menuActionsForSurface: (state) => (surface = '', context = {}) => {
      const normalizedSurface = String(surface || '').trim()
      if (!normalizedSurface) return []
      const enabled = new Set(state.enabledExtensionIds.map(normalizeExtensionId))
      return state.registry
        .filter((extension) => enabled.has(extension.id) && extension.status === 'available')
        .flatMap((extension) => {
          const runtimeEntry = normalizeRuntimeEntry(state.runtimeRegistry?.[extension.id])
          const runtimeActions = runtimeEntry.registeredMenuActions
            .filter((action) => action.surface === normalizedSurface)
          const sourceActions = runtimeActions.length > 0
            ? runtimeActions
            : (extension.contributedMenus || []).filter((action) => action.surface === normalizedSurface)
          return sourceActions
            .filter((action) => matchesWhenClause(action.when, context))
            .map((action) => ({
              ...action,
              extensionId: extension.id,
              extensionName: extension.name,
            }))
        })
    },
    keybindingsForContext: (state) => (context = {}) => {
      const enabled = new Set(state.enabledExtensionIds.map(normalizeExtensionId))
      return state.registry
        .filter((extension) => enabled.has(extension.id) && extension.status === 'available')
        .flatMap((extension) =>
          (extension.contributedKeybindings || [])
            .filter((keybinding) => matchesWhenClause(keybinding.when, context))
            .map((keybinding) => ({
              ...keybinding,
              extensionId: extension.id,
              extensionName: extension.name,
            }))
        )
    },
    commandPaletteCommandsForContext: (state) => (context = {}) => {
      const enabled = new Set(state.enabledExtensionIds.map(normalizeExtensionId))
      return state.registry
        .filter((extension) => enabled.has(extension.id) && extension.status === 'available')
        .flatMap((extension) => {
          const runtimeEntry = normalizeRuntimeEntry(state.runtimeRegistry?.[extension.id])
          const runtimeCommandDetails = runtimeEntry.registeredCommandDetails
          const runtimeCommands = new Set(runtimeEntry.registeredCommands)
          const paletteMenus = runtimeEntry.registeredMenuActions
            .filter((menu) => menu.surface === 'commandPalette')
          const fallbackPaletteMenus = (extension.contributedMenus || [])
            .filter((menu) => menu.surface === 'commandPalette')
          const useRuntimePalette = runtimeEntry.registeredMenuActions.length > 0
          const sourceCommands = runtimeCommandDetails.length > 0
            ? runtimeCommandDetails.map((command) => ({
                ...command,
                id: command.commandId,
                extensionId: extension.id,
                extensionName: extension.name,
              }))
            : (extension.contributedCommands || []).map((command) => ({
                ...command,
                extensionId: extension.id,
                extensionName: extension.name,
            }))
          return sourceCommands
            .filter((command) => {
              const commandMenus = (paletteMenus.length > 0 ? paletteMenus : fallbackPaletteMenus)
                .filter((menu) => menu.commandId === command.commandId)
              if (useRuntimePalette && commandMenus.length === 0) {
                return false
              }
              if (runtimeCommands.size > 0 && !runtimeCommands.has(command.commandId)) {
                return false
              }
              if (commandMenus.length === 0) return true
              return commandMenus.some((menu) => matchesWhenClause(menu.when, context))
            })
        })
    },
    sidebarViewContainers(state) {
      const enabled = new Set(state.enabledExtensionIds.map(normalizeExtensionId))
      return state.registry
        .filter((extension) => enabled.has(extension.id) && extension.status === 'available')
        .flatMap((extension) =>
          (extension.contributedViewContainers || []).map((container) => ({
            ...container,
            extensionId: extension.id,
            extensionName: extension.name,
          }))
        )
    },
    viewsForContainer: (state) => (containerId = '', context = {}) => {
      const normalizedContainerId = String(containerId || '').trim()
      if (!normalizedContainerId) return []
      const enabled = new Set(state.enabledExtensionIds.map(normalizeExtensionId))
      return state.registry
        .filter((extension) => enabled.has(extension.id) && extension.status === 'available')
        .flatMap((extension) =>
          {
            const runtimeEntry = normalizeRuntimeEntry(state.runtimeRegistry?.[extension.id])
            const runtimeViewDetails = runtimeEntry.registeredViewDetails
            const manifestViews = extension.contributedViews || []
            const manifestViewById = new Map(
              manifestViews.map((view) => [String(view?.id || '').trim(), view]),
            )
            const sourceViews = runtimeViewDetails.length > 0
              ? runtimeViewDetails.map((view) => ({
                  ...(manifestViewById.get(String(view?.id || '').trim()) || {}),
                  id: String(view?.id || '').trim(),
                  title: String(
                    view?.title ||
                    manifestViewById.get(String(view?.id || '').trim())?.title ||
                    view?.id ||
                    '',
                  ).trim(),
                  contextualTitle: String(
                    manifestViewById.get(String(view?.id || '').trim())?.contextualTitle || '',
                  ).trim(),
                  when: String(
                    view?.when ||
                    manifestViewById.get(String(view?.id || '').trim())?.when ||
                    '',
                  ).trim(),
                  containerId: String(
                    manifestViewById.get(String(view?.id || '').trim())?.containerId || '',
                  ).trim(),
                  panelId: String(
                    manifestViewById.get(String(view?.id || '').trim())?.panelId || '',
                  ).trim(),
                }))
                .filter((view) => view.id && view.containerId && view.panelId)
              : manifestViews
            return sourceViews
            .filter((view) =>
              view.containerId === normalizedContainerId &&
              matchesWhenClause(view.when, context) &&
              (
                normalizeRuntimeEntry(state.runtimeRegistry?.[extension.id]).registeredViews.length === 0 ||
                normalizeRuntimeEntry(state.runtimeRegistry?.[extension.id]).registeredViews.includes(view.id)
              )
            )
            .map((view) => ({
              ...view,
              extensionId: extension.id,
              extensionName: extension.name,
            }))
          }
        )
    },
    viewTitleActionsForView: (state) => (view = {}, context = {}) => {
      const extensionId = normalizeExtensionId(view.extensionId)
      const enabled = new Set(state.enabledExtensionIds.map(normalizeExtensionId))
      return state.registry
        .filter((extension) => enabled.has(extension.id) && extension.status === 'available' && extension.id === extensionId)
        .flatMap((extension) => {
          const runtimeActions = normalizeRuntimeEntry(state.runtimeRegistry?.[extension.id]).registeredMenuActions
            .filter((action) => action.surface === 'view/title')
          const sourceActions = runtimeActions.length > 0 ? runtimeActions : (extension.contributedViewTitleMenus || [])
          return sourceActions
            .filter((action) => matchesWhenClause(action.when, context))
            .map((action) => ({
              ...action,
              viewId: String(view?.id || ''),
              containerId: String(view?.containerId || ''),
              panelId: String(view?.panelId || ''),
              extensionId: extension.id,
              extensionName: extension.name,
            }))
        })
    },
    viewItemActionsForItem: (state) => (view = {}, item = {}, context = {}) => {
      const extensionId = normalizeExtensionId(view.extensionId)
      const enabled = new Set(state.enabledExtensionIds.map(normalizeExtensionId))
      const mergedContext = {
        ...context,
        viewItem: {
          id: String(item?.id || ''),
          handle: String(item?.handle || ''),
          label: String(item?.label || ''),
          commandId: String(item?.commandId || ''),
          contextValue: String(item?.contextValue || ''),
        },
      }
      return state.registry
        .filter((extension) => enabled.has(extension.id) && extension.status === 'available' && extension.id === extensionId)
        .flatMap((extension) => {
          const runtimeActions = normalizeRuntimeEntry(state.runtimeRegistry?.[extension.id]).registeredMenuActions
            .filter((action) => action.surface === 'view/item/context')
          const sourceActions = runtimeActions.length > 0 ? runtimeActions : (extension.contributedViewItemMenus || [])
          return sourceActions
            .filter((action) => matchesWhenClause(action.when, mergedContext))
            .map((action) => ({
              ...action,
              viewId: String(view?.id || ''),
              containerId: String(view?.containerId || ''),
              panelId: String(view?.panelId || ''),
              extensionId: extension.id,
              extensionName: extension.name,
            }))
        })
    },
    resolvedViewFor: (state) => (viewKey = '') => state.resolvedViews[String(viewKey || '').trim()] || null,
    viewStateFor: (state) => (viewKey = '') => state.viewState[String(viewKey || '').trim()] || null,
    viewControllerStateFor: (state) => (viewKey = '') => state.viewControllerState[String(viewKey || '').trim()] || null,
    resolvedViewChildrenFor: (state) => (viewKey = '', parentItemId = '') => {
      const record = state.resolvedViews[String(viewKey || '').trim()]
      const parentItems = record?.parentItems && typeof record.parentItems === 'object'
        ? record.parentItems
        : {}
      const items = parentItems[String(parentItemId || '').trim()]
      return Array.isArray(items) ? items : []
    },
    viewRefreshTickFor: (state) => (viewKey = '') => state.changedViewTicks[String(viewKey || '').trim()] || 0,
    recentTasks(state) {
      return [...state.tasks].slice(0, 8)
    },
    recentTasksForExtension(state) {
      return (extensionId = '') => {
        return recentTasksForExtensionList(state.tasks, extensionId)
      }
    },
    taskTimelineForExtension(state) {
      return (extensionId = '') => {
        return buildTaskTimeline(recentTasksForExtensionList(state.tasks, extensionId))
      }
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
    runtimeEntryFor: (state) => (extensionId = '') =>
      normalizeRuntimeEntry(state.runtimeRegistry?.[normalizeExtensionId(extensionId)]),
    sidebarTargetForPanel: (state) => (panelId = '', fallbackTarget = {}) => {
      const normalizedPanelId = String(panelId || '').trim()
      const storedTarget = state.sidebarTargets?.[normalizedPanelId]
      return targetHasValue(storedTarget)
        ? normalizeTarget(storedTarget)
        : normalizeTarget(fallbackTarget)
    },
    containerForPanelId() {
      return (panelId = '') => {
        const normalizedPanelId = String(panelId || '').trim()
        if (!normalizedPanelId) return null
        return this.sidebarViewContainers.find((container) => container.panelId === normalizedPanelId) || null
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

    setSidebarTarget(panelId = '', target = {}) {
      const normalizedPanelId = String(panelId || '').trim()
      const normalizedTarget = normalizeTarget(target)
      if (!normalizedPanelId || !targetHasValue(normalizedTarget)) return null
      this.sidebarTargets = {
        ...this.sidebarTargets,
        [normalizedPanelId]: normalizedTarget,
      }
      return normalizedTarget
    },

    resolveContainerForViewId(extensionId = '', viewId = '') {
      const normalizedExtensionId = normalizeExtensionId(extensionId)
      const normalizedViewId = String(viewId || '').trim()
      if (!normalizedExtensionId || !normalizedViewId) return null
      const extension = this.registry.find((entry) => entry.id === normalizedExtensionId)
      if (!extension) return null
      const contributedView = contributedViewForId(extension, normalizedViewId)
      if (!contributedView?.containerId) return null
      return this.sidebarViewContainers.find((container) =>
        container.extensionId === normalizedExtensionId &&
        container.id === String(contributedView.containerId || '').trim()
      ) || null
    },

    resolveContainerForAction(action = {}, target = {}) {
      const extensionId = normalizeExtensionId(action.extensionId)
      if (!extensionId) return null

      const explicitPanelId = String(action.panelId || '').trim()
      if (explicitPanelId) {
        return this.containerForPanelId(explicitPanelId)
      }

      const explicitContainerId = String(action.containerId || '').trim()
      if (explicitContainerId) {
        return this.sidebarViewContainers.find((container) =>
          container.extensionId === extensionId && container.id === explicitContainerId
        ) || null
      }

      const resolvedFromView = this.resolveContainerForViewId(extensionId, action.viewId)
      if (resolvedFromView) return resolvedFromView

      const candidateContainers = this.sidebarViewContainers.filter(
        (container) => container.extensionId === extensionId,
      )
      if (candidateContainers.length <= 1) {
        return candidateContainers[0] || null
      }

      const workspace = useWorkspaceStore()
      for (const container of candidateContainers) {
        const context = buildExtensionContext(normalizeTarget(target), {
          workbench: {
            surface: workspace.isSettingsSurface ? 'settings' : 'workspace',
            panel: 'documentDock',
            activeView: container.panelId,
            hasWorkspace: workspace.isOpen,
            workspaceFolder: workspace.path || '',
          },
        })
        if (this.viewsForContainer(container.id, context).length > 0) {
          return container
        }
      }

      return candidateContainers[0] || null
    },

    async focusSidebarContainer(panelId = '', target = {}) {
      const normalizedPanelId = String(panelId || '').trim()
      if (!normalizedPanelId) return ''
      const workspace = useWorkspaceStore()
      if (workspace.isSettingsSurface) {
        await workspace.openWorkspaceSurface().catch(() => {})
      }
      if (workspace.leftSidebarPanel === 'references') {
        await workspace.setLeftSidebarPanel('files').catch(() => {})
      }
      this.setSidebarTarget(normalizedPanelId, target)
      await workspace.openDocumentDock().catch(() => {})
      await workspace.setDocumentDockActivePage(normalizedPanelId).catch(() => {})
      return normalizedPanelId
    },

    async routeActionToSidebar(action = {}, target = {}) {
      const container = this.resolveContainerForAction(action, target)
      if (!container?.panelId) return null
      await this.focusSidebarContainer(container.panelId, target)
      return container
    },

    async hydrateSettings(force = false) {
      if (!force && this.settingsHydrated) return this.snapshotSettings()
      const workspace = useWorkspaceStore()
      const globalConfigDir = await workspace.ensureGlobalConfigDir()
      const settings = await loadExtensionSettings(globalConfigDir, workspace.path || '')
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
      const saved = await saveExtensionSettings(globalConfigDir, workspace.path || '', next)
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
        await this.activateEnabledExtensions().catch(() => {})
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
      const snapshot = await this.persistSettings({ extensionConfig: nextExtensionConfig })
      const extension = this.registry.find((entry) => entry.id === id)
      if (extension && this.runtimeRegistry[id]?.activated) {
        const workspace = useWorkspaceStore()
        const globalConfigDir = await workspace.ensureGlobalConfigDir()
        await updateExtensionHostSettings({
          globalConfigDir,
          workspaceRoot: workspace.path || '',
          extensionId: id,
          settings: this.configForExtension(extension),
        }).catch(() => {})
      }
      return snapshot
    },
    async activateExtension(extensionId = '', activationEvent = '*') {
      const id = normalizeExtensionId(extensionId)
      if (!id) return null
      const extension = this.registry.find((entry) => entry.id === id)
      if (!extension || extension.status !== 'available') return null
      const workspace = useWorkspaceStore()
      const globalConfigDir = await workspace.ensureGlobalConfigDir()
      const result = await activateExtensionHost({
        globalConfigDir,
        workspaceRoot: workspace.path || '',
        extensionId: id,
        activationEvent,
      })
      this.runtimeRegistry[id] = normalizeRuntimeEntry(result)
      return this.runtimeRegistry[id]
    },
    async activateEnabledExtensions() {
      const enabled = new Set(this.enabledExtensionIds.map(normalizeExtensionId))
      for (const extension of this.registry) {
        if (!enabled.has(extension.id) || extension.status !== 'available') continue
        await this.activateExtension(extension.id, '').catch(() => {})
      }
    },
    async executeCommand(action = {}, target = {}, settings = {}) {
      const extensionId = normalizeExtensionId(action.extensionId)
      const commandId = String(action.commandId || action.command || action.id || '').trim()
      const extension = this.registry.find((extension) => extension.id === extensionId)
      if (!extension || extension.status !== 'available') {
        throw new Error(`Extension command is not available: ${extensionId || commandId}`)
      }
      await this.routeActionToSidebar(action, target).catch(() => {})
      await this.activateExtension(extensionId, `onCommand:${commandId}`).catch(() => {})
      const runtimeCommands = runtimeCommandIds(this.runtimeRegistry?.[extensionId])
      const manifestCommands = new Set(
        (extension.contributedCommands || []).map((command) => String(command.commandId || '').trim()).filter(Boolean),
      )
      if (runtimeCommands.size > 0) {
        if (!runtimeCommands.has(commandId)) {
          throw new Error(`Extension ${extensionId} does not register command ${commandId} at runtime`)
        }
      } else if (!manifestCommands.has(commandId)) {
        throw new Error(`Extension ${extensionId} does not contribute command ${commandId}`)
      }
      const workspace = useWorkspaceStore()
      const globalConfigDir = await workspace.ensureGlobalConfigDir()
      const extensionSettings = this.configForExtension(extension)
      const result = await executeExtensionCommand({
        globalConfigDir,
        workspaceRoot: workspace.path || '',
        extensionId,
        commandId,
        itemId: String(action.itemId || ''),
        itemHandle: String(action.itemHandle || ''),
        target,
        settings: {
          ...extensionSettings,
          ...(settings && typeof settings === 'object' ? settings : {}),
        },
      })
      const task = this.upsertTask(result?.task || {})
      this.markViewsChanged(result?.changedViews, extensionId)
      return task
    },
    async invokeCapability(action = {}, target = {}, settings = {}) {
      const extensionId = normalizeExtensionId(action.extensionId)
      const capabilityId = normalizeCapability(action.capabilityId || action.capability || action.id || '')
      const extension = this.registry.find((entry) => entry.id === extensionId)
      if (!extension || extension.status !== 'available') {
        throw new Error(`Extension capability is not available: ${extensionId || capabilityId}`)
      }
      if (!capabilityId) {
        throw new Error('Extension capability id is required')
      }
      await this.activateExtension(extensionId, `onCapability:${capabilityId}`).catch(() => {})
      const runtimeCapabilities = runtimeCapabilityIds(this.runtimeRegistry?.[extensionId])
      const manifestCapabilities = new Set(
        (extension.contributedCapabilities || [])
          .map((capability) => normalizeCapability(capability?.id))
          .filter(Boolean),
      )
      if (runtimeCapabilities.size > 0) {
        if (!runtimeCapabilities.has(capabilityId)) {
          throw new Error(`Extension ${extensionId} does not register capability ${capabilityId} at runtime`)
        }
      } else if (!manifestCapabilities.has(capabilityId)) {
        throw new Error(`Extension ${extensionId} does not contribute capability ${capabilityId}`)
      }
      const workspace = useWorkspaceStore()
      const globalConfigDir = await workspace.ensureGlobalConfigDir()
      const extensionSettings = this.configForExtension(extension)
      const result = await invokeExtensionCapability({
        globalConfigDir,
        workspaceRoot: workspace.path || '',
        extensionId,
        capabilityId,
        itemId: String(action.itemId || ''),
        itemHandle: String(action.itemHandle || ''),
        target,
        settings: {
          ...extensionSettings,
          ...(settings && typeof settings === 'object' ? settings : {}),
        },
      })
      const task = this.upsertTask(result?.task || {})
      this.markViewsChanged(result?.changedViews, extensionId)
      return task
    },
    async resolveView(view = {}, target = {}, settings = {}, parentItemId = '') {
      const extensionId = normalizeExtensionId(view.extensionId)
      const viewId = String(view.id || '').trim()
      if (!extensionId || !viewId) {
        throw new Error('Extension view is incomplete')
      }
      const workspace = useWorkspaceStore()
      const globalConfigDir = await workspace.ensureGlobalConfigDir()
      const extension = this.registry.find((entry) => entry.id === extensionId)
      await this.activateExtension(extensionId, `onView:${viewId}`).catch(() => {})
      const extensionSettings = extension ? this.configForExtension(extension) : {}
      const resolved = await resolveExtensionView({
        globalConfigDir,
        workspaceRoot: workspace.path || '',
        extensionId,
        viewId,
        parentItemId: String(parentItemId || ''),
        commandId: String(view.commandId || ''),
        targetKind: String(target?.kind || ''),
        referenceId: String(target?.referenceId || ''),
        targetPath: String(target?.path || ''),
        settings: {
          ...extensionSettings,
          ...(settings && typeof settings === 'object' ? settings : {}),
        },
      })
      const viewKey = `${extensionId}:${viewId}`
      this.resolvedViews[viewKey] = mergeResolvedViewState(
        this.resolvedViews[viewKey],
        resolved,
        parentItemId,
      )
      this.viewState[viewKey] = {
        title: String(resolved?.title || ''),
        description: String(resolved?.description || ''),
        message: String(resolved?.message || ''),
        badgeValue: Number.isInteger(resolved?.badgeValue) ? resolved.badgeValue : null,
        badgeTooltip: String(resolved?.badgeTooltip || ''),
        statusLabel: String(resolved?.statusLabel || ''),
        statusTone: String(resolved?.statusTone || ''),
        actionLabel: String(resolved?.actionLabel || ''),
        sections: Array.isArray(resolved?.sections)
          ? resolved.sections.map((entry, index) => normalizeSidebarSection(entry, index))
          : [],
        resultEntries: mergeDefaultResultEntries({
          existingEntries: Array.isArray(resolved?.resultEntries)
            ? resolved.resultEntries.map((entry, index) => normalizeResultEntry(entry, index))
            : [],
          outputs: resolved?.outputs,
        }),
      }
      return resolved
    },
    async notifyViewSelection(view = {}, itemHandle = '') {
      const extensionId = normalizeExtensionId(view.extensionId)
      const viewId = String(view.id || '').trim()
      if (!extensionId || !viewId) return null
      const workspace = useWorkspaceStore()
      const globalConfigDir = await workspace.ensureGlobalConfigDir()
      return notifyExtensionViewSelection({
        globalConfigDir,
        workspaceRoot: workspace.path || '',
        extensionId,
        viewId,
        itemHandle: String(itemHandle || ''),
      })
    },
    setViewControllerState(viewKey = '', patch = {}) {
      const key = String(viewKey || '').trim()
      if (!key) return
      const current = this.viewControllerState[key] && typeof this.viewControllerState[key] === 'object'
        ? this.viewControllerState[key]
        : {
            selectedHandle: '',
            focusedHandle: '',
            revealedPathHandles: [],
          }
      this.viewControllerState[key] = {
        ...current,
        ...(patch && typeof patch === 'object' ? patch : {}),
      }
    },
    requestViewReveal(payload = {}) {
      const extensionId = normalizeExtensionId(payload.extensionId)
      const viewId = String(payload.viewId || '').trim()
      const itemHandle = String(payload.itemHandle || '').trim()
      if (!extensionId || !viewId || !itemHandle) return
      const viewKey = `${extensionId}:${viewId}`
      const parentHandles = Array.isArray(payload.parentHandles)
        ? payload.parentHandles.map((entry) => String(entry || '').trim()).filter(Boolean)
        : []
      this.setViewControllerState(viewKey, {
        selectedHandle: payload.select === false ? '' : itemHandle,
        focusedHandle: payload.focus ? itemHandle : '',
        revealedPathHandles: payload.expand === false ? [] : parentHandles,
      })
      const container = this.resolveContainerForViewId(extensionId, viewId)
      if (container?.panelId) {
        void this.focusSidebarContainer(
          container.panelId,
          this.sidebarTargetForPanel(container.panelId),
        ).catch(() => {})
      }
    },
    markViewsChanged(changedViews = [], defaultExtensionId = '') {
      const extensionId = normalizeExtensionId(defaultExtensionId)
      if (!Array.isArray(changedViews) || changedViews.length === 0) return
      for (const rawViewId of changedViews) {
        const viewId = String(rawViewId || '').trim()
        if (!viewId) continue
        const key = viewId.includes(':')
          ? viewId
          : `${extensionId}:${viewId}`
        const normalizedKey = String(key || '').trim()
        if (!normalizedKey) continue
        this.changedViewTicks[normalizedKey] = (this.changedViewTicks[normalizedKey] || 0) + 1
      }
    },
    requestViewRefresh(viewKeys = []) {
      this.markViewsChanged(viewKeys)
    },
    upsertTask(task = {}) {
      const normalized = normalizeTask(task)
      if (!normalized.id) return null
      const index = this.tasks.findIndex((item) => item.id === normalized.id)
      if (index >= 0) {
        this.tasks.splice(index, 1, normalized)
      } else {
        this.tasks.unshift(normalized)
      }
      return normalized
    },
    async startHostEventBridge() {
      if (this._extensionHostUnlisten) return
      this._extensionHostUnlisten = await listenExtensionViewChanged((event) => {
        const payload = event?.payload || {}
        const activeWorkspaceRoot = String(useWorkspaceStore().path || '')
        const workspaceRoot = String(payload.workspaceRoot || '')
        if (workspaceRoot && activeWorkspaceRoot && workspaceRoot !== activeWorkspaceRoot) return
        this.markViewsChanged(payload.viewIds, payload.extensionId)
      }).catch(() => null)
      this._extensionHostViewStateUnlisten = await listenExtensionViewStateChanged((event) => {
        const payload = event?.payload || {}
        const activeWorkspaceRoot = String(useWorkspaceStore().path || '')
        const workspaceRoot = String(payload.workspaceRoot || '')
        if (workspaceRoot && activeWorkspaceRoot && workspaceRoot !== activeWorkspaceRoot) return
        const viewKey = `${normalizeExtensionId(payload.extensionId)}:${String(payload.viewId || '').trim()}`
        this.viewState[viewKey] = {
          title: String(payload.title || ''),
          description: String(payload.description || ''),
          message: String(payload.message || ''),
          badgeValue: Number.isInteger(payload.badgeValue) ? payload.badgeValue : null,
          badgeTooltip: String(payload.badgeTooltip || ''),
          statusLabel: String(payload.statusLabel || ''),
          statusTone: String(payload.statusTone || ''),
          actionLabel: String(payload.actionLabel || ''),
          sections: Array.isArray(payload.sections)
            ? payload.sections.map((entry, index) => normalizeSidebarSection(entry, index))
            : [],
          resultEntries: mergeDefaultResultEntries({
            existingEntries: Array.isArray(payload.resultEntries)
              ? payload.resultEntries.map((entry, index) => normalizeResultEntry(entry, index))
              : [],
            outputs: payload.outputs,
          }),
        }
      }).catch(() => null)
      this._extensionTaskChangedUnlisten = await listenExtensionTaskChanged((event) => {
        this.upsertTask(event?.payload || {})
      }).catch(() => null)
      this._extensionHostViewRevealUnlisten = await listenExtensionViewRevealRequested((event) => {
        const payload = event?.payload || {}
        const activeWorkspaceRoot = String(useWorkspaceStore().path || '')
        const workspaceRoot = String(payload.workspaceRoot || '')
        if (workspaceRoot && activeWorkspaceRoot && workspaceRoot !== activeWorkspaceRoot) return
        this.requestViewReveal(payload)
      }).catch(() => null)
      await this.refreshTasks().catch(() => {})
    },
    stopHostEventBridge() {
      this._extensionHostUnlisten?.()
      this._extensionHostUnlisten = null
      this._extensionHostViewStateUnlisten?.()
      this._extensionHostViewStateUnlisten = null
      this._extensionTaskChangedUnlisten?.()
      this._extensionTaskChangedUnlisten = null
      this._extensionHostViewRevealUnlisten?.()
      this._extensionHostViewRevealUnlisten = null
    },
    async cancelTask(taskId = '') {
      return this.upsertTask(await cancelExtensionTaskWithBackend(taskId))
    },

    async refreshTask(taskId = '') {
      return this.upsertTask(await getExtensionTask(taskId))
    },

    openArtifact(artifact = {}) {
      return openExtensionArtifactWithBackend(artifact)
    },

    revealArtifact(artifact = {}) {
      return revealExtensionArtifactWithBackend(artifact)
    },

    async runResultEntryAction(entry = {}, fallbackTarget = {}) {
      const action = String(entry?.action || '').trim().toLowerCase()
      const path = String(entry?.path || '').trim()
      const mediaType = String(entry?.mediaType || '').trim()
      const commandId = String(entry?.commandId || '').trim()
      const target = {
        kind: String(entry?.targetKind || fallbackTarget?.kind || '').trim(),
        referenceId: String(entry?.referenceId || fallbackTarget?.referenceId || '').trim(),
        path: String(entry?.targetPath || path || fallbackTarget?.path || '').trim(),
      }

      if (action === 'reveal' && path) {
        return this.revealArtifact({ path })
      }

      if (action === 'copy-text') {
        const text = String(entry?.payload?.text || path || '').trim()
        if (!text) return null
        return writeNativeClipboardText(text)
      }

      if (action === 'open-tab' && target.path) {
        const { useEditorStore } = await import('./editor')
        return useEditorStore().openFile(target.path)
      }

      if (action === 'execute-command' && commandId) {
        return this.executeCommand({
          extensionId: normalizeExtensionId(
            entry?.extensionId ||
            entry?.extension_id ||
            entry?.payload?.extensionId ||
            entry?.payload?.extension_id,
          ),
          commandId,
        }, target, entry?.payload?.settings || {})
      }

      if (action === 'open-reference' && target.referenceId) {
        const { useWorkspaceStore } = await import('./workspace')
        const { useReferencesStore } = await import('./references')
        const workspaceStore = useWorkspaceStore()
        const referencesStore = useReferencesStore()
        referencesStore.selectReference(target.referenceId)
        await workspaceStore.openWorkspaceSurface().catch(() => {})
        await workspaceStore.setLeftSidebarPanel('references').catch(() => {})
        await workspaceStore.openReferenceDock().catch(() => {})
        return target.referenceId
      }

      if (action === 'copy-path') {
        const text = String(path || target.path || '').trim()
        if (!text) return null
        return writeNativeClipboardText(text)
      }

      if ((action === 'open' || !action) && path) {
        return this.openArtifact({ path, mediaType })
      }

      if (path) {
        return this.openArtifact({ path, mediaType })
      }

      return null
    },
  },
})
