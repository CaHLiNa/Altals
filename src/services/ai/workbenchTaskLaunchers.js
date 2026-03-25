import {
  createNotebookAssistantTask,
  createReferenceCompareTask,
  createReferenceMaintenanceTask,
} from './taskCatalog.js'

function resolvePaneId(editorStore, fallbackPaneId = null) {
  return fallbackPaneId || editorStore?.activePaneId || null
}

export function buildNotebookAssistantLaunchRequest({
  editorStore,
  chatStore,
  filePath,
  paneId = null,
}) {
  return {
    editorStore,
    chatStore,
    paneId: resolvePaneId(editorStore, paneId),
    beside: true,
    task: createNotebookAssistantTask({
      filePath,
      source: 'notebook-toolbar',
      entryContext: 'notebook-toolbar',
    }),
  }
}

export function buildReferenceMaintenanceLaunchRequest({
  editorStore,
  chatStore,
  focusKeys = [],
  paneId = null,
}) {
  return {
    editorStore,
    chatStore,
    paneId: resolvePaneId(editorStore, paneId),
    beside: true,
    task: createReferenceMaintenanceTask({
      source: 'reference-list',
      entryContext: 'reference-list',
      focusKeys,
    }),
  }
}

export function buildReferenceCompareLaunchRequest({
  editorStore,
  chatStore,
  refKeys = [],
  paneId = null,
}) {
  return {
    editorStore,
    chatStore,
    paneId: resolvePaneId(editorStore, paneId),
    beside: true,
    task: createReferenceCompareTask({
      refKeys,
      source: 'reference-list',
      entryContext: 'reference-list',
    }),
  }
}

export function launchNotebookAssistantTask(options) {
  return import('./launch.js').then(({ launchAiTask }) =>
    launchAiTask(buildNotebookAssistantLaunchRequest(options))
  )
}

export function launchReferenceMaintenanceTask(options) {
  return import('./launch.js').then(({ launchAiTask }) =>
    launchAiTask(buildReferenceMaintenanceLaunchRequest(options))
  )
}

export function launchReferenceCompareTask(options) {
  return import('./launch.js').then(({ launchAiTask }) =>
    launchAiTask(buildReferenceCompareLaunchRequest(options))
  )
}
