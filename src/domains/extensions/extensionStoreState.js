import {
  normalizeExtensionContributions,
} from './extensionContributionRegistry.js'
import { buildExtensionHostDiagnostics } from './extensionHostDiagnostics.js'
import {
  buildExtensionCommandHostState,
  buildExtensionRuntimeBlockDescriptor,
} from './extensionCommandHostState.js'

export function normalizeExtensionId(value = '') {
  return String(value || '').trim().toLowerCase()
}

export function normalizeCapability(value = '') {
  return String(value || '').trim()
}

export function normalizeWorkspaceRoot(value = '') {
  return String(value || '').trim()
}

export function normalizeTarget(target = {}) {
  return {
    kind: String(target?.kind || '').trim(),
    referenceId: String(target?.referenceId || '').trim(),
    path: String(target?.path || '').trim(),
  }
}

export function targetHasValue(target = {}) {
  const normalized = normalizeTarget(target)
  return Boolean(normalized.kind || normalized.referenceId || normalized.path)
}

export function normalizeExtension(extension = {}) {
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
    settingsSchema: contributions.configuration?.properties || {},
    settingsActions: Array.isArray(contributions.configuration?.actions) ? contributions.configuration.actions : [],
  }
}

export function runtimeCapabilityIds(entry = {}) {
  const ids = new Set()
  const runtimeEntry = normalizeRuntimeEntry(entry)
  for (const capability of Array.isArray(runtimeEntry?.registeredCapabilities) ? runtimeEntry.registeredCapabilities : []) {
    const id = normalizeCapability(capability)
    if (id) ids.add(id)
  }
  return ids
}

export function normalizeTask(task = {}) {
  return {
    ...task,
    id: String(task.id || ''),
    extensionId: normalizeExtensionId(task.extensionId),
    workspaceRoot: normalizeWorkspaceRoot(task.workspaceRoot || task.workspace_root || ''),
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

export function recentTasksForExtensionList(tasks = [], extensionId = '', workspaceRoot = '') {
  const normalizedExtensionId = normalizeExtensionId(extensionId)
  const normalizedWorkspaceRoot = normalizeWorkspaceRoot(workspaceRoot)
  const filtered = normalizedExtensionId
    ? tasks.filter((task) => {
        if (task.extensionId !== normalizedExtensionId) return false
        if (!normalizedWorkspaceRoot) return true
        return normalizeWorkspaceRoot(task.workspaceRoot) === normalizedWorkspaceRoot
      })
    : tasks
  return [...filtered].slice(0, 8)
}

export function viewKeyMatchesExtension(viewKey = '', extensionId = '') {
  const normalizedViewKey = String(viewKey || '').trim()
  const normalizedExtensionId = normalizeExtensionId(extensionId)
  return Boolean(
    normalizedViewKey &&
    normalizedExtensionId &&
    normalizedViewKey.startsWith(`${normalizedExtensionId}:`),
  )
}

export function panelIdMatchesExtension(registry = [], panelId = '', extensionId = '') {
  const normalizedPanelId = String(panelId || '').trim()
  const normalizedExtensionId = normalizeExtensionId(extensionId)
  if (!normalizedPanelId || !normalizedExtensionId) return false
  const extension = Array.isArray(registry)
    ? registry.find((entry) => normalizeExtensionId(entry?.id) === normalizedExtensionId)
    : null
  if (!extension) return false
  return (extension.contributedViewContainers || []).some(
    (container) => String(container?.panelId || '').trim() === normalizedPanelId,
  )
}

export function buildTaskTimeline(tasks = []) {
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

export function normalizeResolvedViewItem(item = {}) {
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

export function normalizeArtifactEntry(entry = {}) {
  return {
    id: String(entry?.id || '').trim(),
    extensionId: normalizeExtensionId(entry?.extensionId || entry?.extension_id || ''),
    taskId: String(entry?.taskId || entry?.task_id || '').trim(),
    capability: normalizeCapability(entry?.capability),
    kind: String(entry?.kind || '').trim(),
    mediaType: String(entry?.mediaType || entry?.media_type || '').trim(),
    path: String(entry?.path || '').trim(),
    sourcePath: String(entry?.sourcePath || entry?.source_path || '').trim(),
    sourceHash: String(entry?.sourceHash || entry?.source_hash || '').trim(),
    createdAt: String(entry?.createdAt || entry?.created_at || '').trim(),
  }
}

export function normalizeSidebarSection(entry = {}, index = 0) {
  return {
    id: String(entry?.id || `section:${index}`).trim(),
    kind: String(entry?.kind || '').trim(),
    title: String(entry?.title || '').trim(),
    value: String(entry?.value || '').trim(),
    tone: String(entry?.tone || '').trim(),
  }
}

export function normalizeViewPresentation(entry = {}) {
  const source = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {}
  const target = source?.target && typeof source.target === 'object' && !Array.isArray(source.target)
    ? source.target
    : {}
  const action = source?.action && typeof source.action === 'object' && !Array.isArray(source.action)
    ? source.action
    : {}
  const progress = source?.progress && typeof source.progress === 'object' && !Array.isArray(source.progress)
    ? source.progress
    : {}
  return {
    mode: String(source.mode || '').trim(),
    target: {
      label: String(target.label || '').trim(),
      path: String(target.path || '').trim(),
      emptyLabel: String(target.emptyLabel || '').trim(),
    },
    action: {
      label: String(action.label || '').trim(),
      commandId: String(action.commandId || action.command || '').trim(),
      disabled: Boolean(action.disabled),
    },
    progress: {
      label: String(progress.label || '').trim(),
      state: String(progress.state || '').trim(),
      current: Number.isFinite(Number(progress.current)) ? Number(progress.current) : 0,
      total: Number.isFinite(Number(progress.total)) ? Number(progress.total) : 0,
    },
  }
}

export function normalizeResultEntry(entry = {}, index = 0) {
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

export function mergeResolvedViewState(current = {}, resolved = {}, parentItemId = '') {
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

export function normalizeRuntimeEntry(entry = {}) {
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

export function normalizeHostSummary(summary = {}) {
  return {
    available: summary?.available !== false,
    runtime: String(summary?.runtime || ''),
    activatedExtensions: Array.isArray(summary?.activatedExtensions)
      ? summary.activatedExtensions.map(normalizeExtensionId).filter(Boolean)
      : [],
    activeRuntimeSlots: Array.isArray(summary?.activeRuntimeSlots)
      ? summary.activeRuntimeSlots
        .map((entry) => ({
          extensionId: normalizeExtensionId(entry?.extensionId || entry?.extension_id || ''),
          workspaceRoot: normalizeWorkspaceRoot(entry?.workspaceRoot || entry?.workspace_root || ''),
        }))
        .filter((entry) => entry.extensionId)
      : [],
    pendingPromptOwner:
      summary?.pendingPromptOwner && typeof summary.pendingPromptOwner === 'object'
        ? {
          extensionId: normalizeExtensionId(
            summary.pendingPromptOwner.extensionId || summary.pendingPromptOwner.extension_id || '',
          ),
          workspaceRoot: normalizeWorkspaceRoot(
            summary.pendingPromptOwner.workspaceRoot || summary.pendingPromptOwner.workspace_root || '',
          ),
        }
        : null,
  }
}

export function runtimeCommandIds(entry = {}) {
  const normalized = normalizeRuntimeEntry(entry)
  const commandIds = new Set(normalized.registeredCommands)
  for (const command of normalized.registeredCommandDetails) {
    if (command.commandId) {
      commandIds.add(command.commandId)
    }
  }
  return commandIds
}

export function contributedViewForId(extension = {}, viewId = '') {
  const normalizedViewId = String(viewId || '').trim()
  if (!normalizedViewId) return null
  return (extension?.contributedViews || []).find(
    (view) => String(view?.id || '').trim() === normalizedViewId,
  ) || null
}

export function isPromptIsolationError(error) {
  const message = String(error?.message || error || '').trim()
  return message.includes('Extension host is waiting for UI input from')
}

export function commandHostStateFor({
  extensionId = '',
  workspaceRoot = '',
  hostSummary = {},
  runtimeEntry = {},
} = {}) {
  return buildExtensionCommandHostState(
    buildExtensionHostDiagnostics({
      extensionId,
      workspaceRoot,
      hostStatus: normalizeHostSummary(hostSummary),
      runtimeEntry: normalizeRuntimeEntry(runtimeEntry),
    })
  )
}

export function runtimeBlockDescriptorFor({
  extensionId = '',
  workspaceRoot = '',
  hostSummary = {},
  runtimeEntry = {},
} = {}) {
  return buildExtensionRuntimeBlockDescriptor(
    commandHostStateFor({
      extensionId,
      workspaceRoot,
      hostSummary,
      runtimeEntry,
    })
  )
}

export function deferredViewRequestKey(payload = {}) {
  return [
    String(payload?.kind || '').trim(),
    normalizeExtensionId(payload?.extensionId),
    normalizeWorkspaceRoot(payload?.workspaceRoot),
    String(payload?.viewId || '').trim(),
    String(payload?.parentItemId || '').trim(),
    String(payload?.itemHandle || '').trim(),
    String(payload?.target?.kind || '').trim(),
    String(payload?.target?.referenceId || '').trim(),
    String(payload?.target?.path || '').trim(),
  ].join('::')
}
