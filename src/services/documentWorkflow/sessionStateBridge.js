import { invoke } from '@tauri-apps/api/core'
import { isBrowserPreviewRuntime } from '../../app/browserPreview/routes.js'

const PREFS_KEY = 'documentWorkflow.previewPrefs'

export function createDocumentWorkflowPersistentState() {
  return {
    previewPrefs: {
      markdown: {
        preferredPreview: 'html',
      },
    },
    session: {
      activeFile: '',
      activeKind: '',
      sourcePaneId: '',
      previewPaneId: '',
      previewKind: '',
      previewSourcePath: '',
      state: 'inactive',
      detachedSources: {},
    },
    previewBindings: [],
    workspacePreviewVisibility: {},
    workspacePreviewRequests: {},
  }
}

function readLegacyPreviewPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) {
      return createDocumentWorkflowPersistentState().previewPrefs
    }
    return {
      ...createDocumentWorkflowPersistentState().previewPrefs,
      ...JSON.parse(raw),
    }
  } catch {
    return createDocumentWorkflowPersistentState().previewPrefs
  }
}

function clearLegacyPreviewPrefs() {
  try {
    localStorage.removeItem(PREFS_KEY)
  } catch {
    // Ignore localStorage failures.
  }
}

function hasTauriInvoke() {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__?.invoke === 'function'
}

function loadBrowserPreviewState() {
  const base = createDocumentWorkflowPersistentState()
  return {
    ...base,
    previewPrefs: readLegacyPreviewPrefs(),
  }
}

export async function loadDocumentWorkflowSessionState(workspaceDataDir = '') {
  if (isBrowserPreviewRuntime() || !hasTauriInvoke()) {
    return loadBrowserPreviewState()
  }

  const state = await invoke('document_workflow_session_load', {
    params: {
      workspaceDataDir: String(workspaceDataDir || ''),
      legacyState: {
        ...createDocumentWorkflowPersistentState(),
        previewPrefs: readLegacyPreviewPrefs(),
      },
    },
  })

  clearLegacyPreviewPrefs()
  return {
    ...createDocumentWorkflowPersistentState(),
    ...state,
  }
}

export async function saveDocumentWorkflowSessionState(workspaceDataDir = '', state = {}) {
  if (isBrowserPreviewRuntime() || !hasTauriInvoke()) {
    return {
      ...createDocumentWorkflowPersistentState(),
      ...state,
    }
  }

  const normalized = await invoke('document_workflow_session_save', {
    params: {
      workspaceDataDir: String(workspaceDataDir || ''),
      state,
    },
  })

  clearLegacyPreviewPrefs()
  return {
    ...createDocumentWorkflowPersistentState(),
    ...normalized,
  }
}
