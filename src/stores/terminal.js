import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { t } from '../i18n'
import { defaultShell } from '../platform'
import { getLanguageConfig } from '../services/codeRunner'
import { useWorkspaceStore } from './workspace'
import {
  clearTerminalSnapshot,
  loadTerminalSnapshot,
  saveTerminalSnapshot,
} from '../services/terminal/terminalPersistence'
import {
  disposeTerminalSession,
  killTerminalSession,
  spawnTerminalSession,
  writeTerminalSession,
} from '../services/terminal/terminalSessions'
import { buildShellIntegrationBootstrap } from '../services/terminal/terminalShellIntegration'
import { createTerminalExecutionRuntime } from '../domains/terminal/terminalExecutionRuntime'
import { createTerminalHydrationRuntime } from '../domains/terminal/terminalHydrationRuntime'
import { createTerminalLifecycleRuntime } from '../domains/terminal/terminalLifecycleRuntime'
import { createTerminalLogRuntime } from '../domains/terminal/terminalLogRuntime'
import { createTerminalSessionRuntime } from '../domains/terminal/terminalSessionRuntime'

const SHARED_SHELL_KEY = 'shared-shell-terminal'
const SHARED_LOG_KEY = 'shared-build-terminal'
const TOOL_LOG_TERMINALS = Object.freeze({
  'latex-log': {
    terminalKey: 'tool-latex-terminal',
    labelKey: 'LaTeX',
    preserveText: true,
  },
  'typst-log': {
    terminalKey: 'tool-typst-terminal',
    labelKey: 'Typst',
    preserveText: true,
  },
})
const MAX_COMMAND_MARKERS = 200

function nextLabelNumber(instances) {
  const numbers = instances
    .filter((instance) => instance.kind === 'shell' && !instance.key && !instance.language && !instance.customLabel)
    .map((instance) => {
      const match = /(\d+)\s*$/.exec(instance.label || '')
      return match ? Number(match[1]) : 0
    })
    .filter(Boolean)
  return numbers.length ? Math.max(...numbers) + 1 : 1
}

function buildLabel() {
  return t('Build')
}

function shellLabel() {
  return t('Shell')
}

function terminalLabel(number = null) {
  return number ? t('Terminal {number}', { number }) : t('Terminal')
}

function translateLabel(label, fallback = '') {
  return t(label || fallback)
}

function defaultLabelForInstance(instance) {
  if (instance.key === SHARED_SHELL_KEY) return shellLabel()
  if (instance.key === SHARED_LOG_KEY) return buildLabel()

  const toolDefinition = Object.values(TOOL_LOG_TERMINALS)
    .find((definition) => definition.terminalKey === instance.key)
  if (toolDefinition) return t(toolDefinition.labelKey)

  if (instance.kind === 'repl' && instance.language) {
    return translateLabel(getLanguageConfig(instance.language)?.label, instance.label || terminalLabel())
  }

  if (instance.kind === 'shell' && !instance.key) {
    const numericSuffix = /(\d+)\s*$/.exec(instance.label || '')
    const number = numericSuffix ? Number(numericSuffix[1]) : null
    return terminalLabel(number)
  }

  if (instance.kind === 'log') {
    return translateLabel(instance.label, 'Build')
  }

  return translateLabel(instance.label, 'Terminal')
}

function createEmptyFindState() {
  return {
    visible: false,
    query: '',
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  }
}

function createEmptyState() {
  return {
    hydratedWorkspacePath: '',
    nextInstanceId: 1,
    nextGroupId: 1,
    nextMarkerId: 1,
    groups: [],
    instances: [],
    tabOrder: [],
    activeGroupId: null,
    activeInstanceId: null,
    find: createEmptyFindState(),
  }
}

function cloneArgs(args = []) {
  return Array.isArray(args) ? [...args] : []
}

function createGroup(id) {
  return {
    id,
    activeInstanceId: null,
  }
}

function resolveLogTerminalDefinition(logKey, fallbackLabel = buildLabel()) {
  const toolDefinition = TOOL_LOG_TERMINALS[logKey]
  if (toolDefinition) {
    return {
      ...toolDefinition,
      label: t(toolDefinition.labelKey),
    }
  }
  return {
    terminalKey: SHARED_LOG_KEY,
    label: translateLabel(fallbackLabel, 'Build'),
    preserveText: false,
  }
}

function normalizeSerializedGroup(group) {
  return {
    id: Number(group?.id) || 0,
    activeInstanceId: Number(group?.activeInstanceId) || null,
  }
}

function normalizeSerializedInstance(instance) {
  return {
    id: Number(instance?.id) || 0,
    key: instance?.key || null,
    groupId: Number(instance?.groupId) || null,
    kind: instance?.kind || 'shell',
    mode: instance?.mode || (instance?.kind === 'log' ? 'log' : 'shell'),
    label: instance?.label || terminalLabel(),
    customLabel: instance?.customLabel || null,
    title: instance?.title || '',
    language: instance?.language || null,
    spawnCmd: instance?.spawnCmd || null,
    spawnArgs: cloneArgs(instance?.spawnArgs),
    cwd: '',
    status: 'idle',
    lastExitCode: null,
    lastCols: 120,
    lastRows: 32,
    sessionId: null,
    shellIntegrationReady: false,
    commandMarkers: [],
    activeCommandMarkerId: null,
    logChunks: [],
    logRevision: 0,
    logResetToken: 0,
  }
}

export const useTerminalStore = defineStore('terminal', {
  state: () => createEmptyState(),

  getters: {
    orderedInstances(state) {
      return state.tabOrder
        .map((id) => state.instances.find((instance) => instance.id === id))
        .filter(Boolean)
    },
    activeInstance(state) {
      return state.instances.find((instance) => instance.id === state.activeInstanceId) || null
    },
    activeGroup(state) {
      return state.groups.find((group) => group.id === state.activeGroupId) || null
    },
    groupEntries(state) {
      return state.groups.map((group) => {
        const instances = state.tabOrder
          .map((id) => state.instances.find((instance) => instance.id === id && instance.groupId === group.id))
          .filter(Boolean)
        const activeInstanceId = instances.some((instance) => instance.id === group.activeInstanceId)
          ? group.activeInstanceId
          : instances[0]?.id || null
        return {
          ...group,
          activeInstanceId,
          instances,
        }
      })
    },
  },

  actions: {
    _workspace() {
      return useWorkspaceStore()
    },

    _getTerminalExecutionRuntime() {
      if (!this._terminalExecutionRuntime) {
        this._terminalExecutionRuntime = createTerminalExecutionRuntime({
          getWorkspacePath: () => this._workspace().path,
          getInstance: (instanceId) => this._findInstance(instanceId),
          getSessionId: (instanceId) => this._findInstance(instanceId)?.sessionId ?? null,
          defaultShell,
          spawnTerminalSession,
          writeTerminalSession,
          buildShellIntegrationBootstrap,
          writeFile: (path, content) => invoke('write_file', { path, content }),
          ensureSharedShellTerminal: (options = {}) => this.ensureSharedShellTerminal(options),
          ensureLanguageTerminal: (language, options = {}) => this.ensureLanguageTerminal(language, options),
          findLanguageTerminalInstanceId: (language) => (
            this.instances.find((instance) => instance.language === language && instance.kind === 'repl')?.id ?? null
          ),
          activateInstance: (instanceId) => this.activateInstance(instanceId),
          openBottomPanel: () => this._workspace().openBottomPanel(),
          markSessionStarted: (instanceId, sessionId, options = {}) => {
            const instance = this._findInstance(instanceId)
            if (!instance) return
            instance.sessionId = sessionId
            instance.status = 'running'
            instance.lastExitCode = null
            instance.shellIntegrationReady = options.shellIntegrationReady === true
          },
        })
      }
      return this._terminalExecutionRuntime
    },

    _getTerminalHydrationRuntime() {
      if (!this._terminalHydrationRuntime) {
        this._terminalHydrationRuntime = createTerminalHydrationRuntime({
          createEmptyState,
          createGroup,
          cloneArgs,
          getWorkspacePath: () => this._workspace().path,
          getHydratedWorkspacePath: () => this.hydratedWorkspacePath,
          getStateSnapshot: () => ({
            nextInstanceId: this.nextInstanceId,
            nextGroupId: this.nextGroupId,
            nextMarkerId: this.nextMarkerId,
            activeGroupId: this.activeGroupId,
            activeInstanceId: this.activeInstanceId,
            groups: this.groups,
            tabOrder: this.tabOrder,
            instances: this.instances,
          }),
          getInstances: () => this.instances,
          replaceState: (state) => {
            Object.assign(this, state)
          },
          normalizeSerializedGroup,
          normalizeSerializedInstance,
          refreshLocalizedLabels: () => this._refreshLocalizedLabels(),
          saveTerminalSnapshot,
          loadTerminalSnapshot,
          killTerminalSession,
          disposeTerminalSession,
        })
      }
      return this._terminalHydrationRuntime
    },

    _getTerminalLifecycleRuntime() {
      if (!this._terminalLifecycleRuntime) {
        this._terminalLifecycleRuntime = createTerminalLifecycleRuntime({
          getState: () => this,
          hydrateForWorkspace: (force = false) => this.hydrateForWorkspace(force),
          createGroup,
          cloneArgs,
          createDefaultTerminalLabel: () => this._defaultTerminalLabel(),
          getLanguageConfig,
          translateLabel: (label, fallback = '') => translateLabel(label, fallback),
          shellLabel: () => shellLabel(),
          sharedShellKey: SHARED_SHELL_KEY,
          sharedLogKey: SHARED_LOG_KEY,
          persistSnapshot: () => this._persistSnapshot(),
          openBottomPanel: () => this._workspace().openBottomPanel(),
        })
      }
      return this._terminalLifecycleRuntime
    },

    _getTerminalLogRuntime() {
      if (!this._terminalLogRuntime) {
        this._terminalLogRuntime = createTerminalLogRuntime({
          getInstance: (instanceId) => this._findInstance(instanceId),
          ensureBuildLogTerminal: ({ key, label, activate } = {}) => this.ensureBuildLogTerminal({ key, label, activate }),
          activateInstance: (instanceId) => this.activateInstance(instanceId),
          openBottomPanel: () => this._workspace().openBottomPanel(),
          resolveLogTerminalDefinition: (key, label) => resolveLogTerminalDefinition(key, label),
        })
      }
      return this._terminalLogRuntime
    },

    _getTerminalSessionRuntime() {
      if (!this._terminalSessionRuntime) {
        this._terminalSessionRuntime = createTerminalSessionRuntime({
          getState: () => this,
          getWorkspacePath: () => this._workspace().path || '',
          isBottomPanelOpen: () => this._workspace().bottomPanelOpen,
          closeBottomPanel: () => this._workspace().toggleBottomPanel(),
          killTerminalSession,
          disposeTerminalSession,
          clearTerminalSnapshot,
          activateInstance: (instanceId) => this.activateInstance(instanceId),
          persistSnapshot: () => this._persistSnapshot(),
          maxCommandMarkers: MAX_COMMAND_MARKERS,
        })
      }
      return this._terminalSessionRuntime
    },

    _refreshLocalizedLabels() {
      for (const instance of this.instances) {
        if (instance.customLabel) continue
        instance.label = defaultLabelForInstance(instance)
      }
    },

    _defaultTerminalLabel() {
      return terminalLabel(nextLabelNumber(this.instances))
    },

    _ensureBaseGroup() {
      return this._getTerminalLifecycleRuntime().ensureBaseGroup()
    },

    _findInstance(instanceId) {
      return this.instances.find((instance) => instance.id === instanceId) || null
    },

    _findGroup(groupId) {
      return this.groups.find((group) => group.id === groupId) || null
    },

    _persistSnapshot() {
      return this._getTerminalHydrationRuntime().persistSnapshot()
    },

    async resetForWorkspace() {
      return this._getTerminalHydrationRuntime().resetForWorkspace()
    },

    hydrateForWorkspace(force = false) {
      return this._getTerminalHydrationRuntime().hydrateForWorkspace(force)
    },

    _createInstance(definition = {}, { activate = true, persist = true } = {}) {
      return this._getTerminalLifecycleRuntime().createInstance(definition, { activate, persist })
    },

    ensureDefaultShell() {
      return this._getTerminalLifecycleRuntime().ensureDefaultShell()
    },

    createTerminal() {
      return this._getTerminalLifecycleRuntime().createTerminal()
    },

    activateInstance(instanceId) {
      return this._getTerminalLifecycleRuntime().activateInstance(instanceId)
    },

    activateGroup(groupId) {
      return this._getTerminalLifecycleRuntime().activateGroup(groupId)
    },

    renameInstance(instanceId, label) {
      return this._getTerminalLifecycleRuntime().renameInstance(instanceId, label)
    },

    reorderTabs(fromIndex, toIndex) {
      return this._getTerminalLifecycleRuntime().reorderTabs(fromIndex, toIndex)
    },

    _insertGroupAfter(groupId) {
      return this._getTerminalLifecycleRuntime().insertGroupAfter(groupId)
    },

    splitInstance(instanceId = this.activeInstanceId) {
      return this._getTerminalLifecycleRuntime().splitInstance(instanceId)
    },

    async closeInstance(instanceId) {
      return this._getTerminalSessionRuntime().closeInstance(instanceId)
    },

    setFindVisible(visible) {
      this.find.visible = !!visible
    },

    setFindQuery(query) {
      this.find.query = query
    },

    setFindOption(key, value) {
      if (!(key in this.find)) return
      this.find[key] = value
    },

    setSurfaceSize(instanceId, cols, rows) {
      return this._getTerminalSessionRuntime().setSurfaceSize(instanceId, cols, rows)
    },

    async ensureSession(instanceId) {
      return this._getTerminalExecutionRuntime().ensureSession(instanceId)
    },

    markSessionExited(instanceId, payload = null) {
      return this._getTerminalSessionRuntime().markSessionExited(instanceId, payload)
    },

    updateInstanceCwd(instanceId, cwd) {
      return this._getTerminalSessionRuntime().updateInstanceCwd(instanceId, cwd)
    },

    registerCommandStart(instanceId, command = '') {
      return this._getTerminalSessionRuntime().registerCommandStart(instanceId, command)
    },

    registerCommandFinish(instanceId, markerId, status) {
      return this._getTerminalSessionRuntime().registerCommandFinish(instanceId, markerId, status)
    },

    _setLogInstanceStatus(instanceId, status) {
      return this._getTerminalLogRuntime().setLogInstanceStatus(instanceId, status)
    },

    clearLogInstance(instanceId) {
      return this._getTerminalLogRuntime().clearLogInstance(instanceId)
    },

    appendLogChunk(instanceId, text, { clear = false } = {}) {
      return this._getTerminalLogRuntime().appendLogChunk(instanceId, text, { clear })
    },

    _buildLogText(label, text, { clear = false } = {}) {
      return this._getTerminalLogRuntime().buildLogText(label, text, { clear })
    },

    ensureBuildLogTerminal({ key = SHARED_LOG_KEY, label = 'Build', activate = true } = {}) {
      return this._getTerminalLifecycleRuntime().ensureBuildLogTerminal({ key, label, activate })
    },

    ensureSharedShellTerminal({ activate = true } = {}) {
      return this._getTerminalLifecycleRuntime().ensureSharedShellTerminal({ activate })
    },

    ensureLanguageTerminal(language, { activate = true } = {}) {
      return this._getTerminalLifecycleRuntime().ensureLanguageTerminal(language, { activate })
    },

    async sendTextToInstance(instanceId, text) {
      return this._getTerminalExecutionRuntime().sendTextToInstance(instanceId, text)
    },

    async _buildReplCommand(code, language) {
      return this._getTerminalExecutionRuntime().buildReplCommand(code, language)
    },

    async handleCreateLanguageTerminalEvent({ language } = {}) {
      return this._getTerminalExecutionRuntime().handleCreateLanguageTerminalEvent({ language })
    },

    handleFocusLanguageTerminalEvent({ language } = {}) {
      return this._getTerminalExecutionRuntime().handleFocusLanguageTerminalEvent({ language })
    },

    async handleSendToReplEvent({ code, language } = {}) {
      return this._getTerminalExecutionRuntime().handleSendToReplEvent({ code, language })
    },

    handleTerminalLogEvent({ key, label, text, clear = false, open = true, status = null } = {}) {
      return this._getTerminalLogRuntime().handleTerminalLogEvent({ key, label, text, clear, open, status })
    },

    handleTerminalStreamEvent({ key, label, text, clear = false, open = false, header = false, status = null } = {}) {
      return this._getTerminalLogRuntime().handleTerminalStreamEvent({
        key,
        label,
        text,
        clear,
        open,
        header,
        status,
      })
    },
  },
})
