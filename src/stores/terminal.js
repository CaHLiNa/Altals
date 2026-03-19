import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
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

const SHARED_SHELL_KEY = 'shared-shell-terminal'
const SHARED_LOG_KEY = 'shared-build-terminal'
const TOOL_LOG_TERMINALS = Object.freeze({
  'latex-log': {
    terminalKey: 'tool-latex-terminal',
    label: 'LaTeX',
    preserveText: true,
  },
  'typst-log': {
    terminalKey: 'tool-typst-terminal',
    label: 'Typst',
    preserveText: true,
  },
})
const MAX_COMMAND_MARKERS = 200
const REPL_TEMP_EXT = {
  r: '.R',
  python: '.py',
  julia: '.jl',
}

function clampIndex(value, length) {
  if (length <= 0) return -1
  return Math.min(Math.max(value, 0), length - 1)
}

function nextLabelNumber(instances) {
  const numbers = instances
    .map((instance) => {
      const match = /^Terminal\s+(\d+)$/i.exec(instance.label || '')
      return match ? Number(match[1]) : 0
    })
    .filter(Boolean)
  return numbers.length ? Math.max(...numbers) + 1 : 1
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

function resolveLogTerminalDefinition(logKey, fallbackLabel = 'Build') {
  const toolDefinition = TOOL_LOG_TERMINALS[logKey]
  if (toolDefinition) return toolDefinition
  return {
    terminalKey: SHARED_LOG_KEY,
    label: 'Build',
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
    label: instance?.label || 'Terminal',
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

    _defaultTerminalLabel() {
      return `Terminal ${nextLabelNumber(this.instances)}`
    },

    _ensureBaseGroup() {
      if (this.groups.length > 0) return this.groups[0].id
      const groupId = this.nextGroupId++
      this.groups.push(createGroup(groupId))
      this.activeGroupId = groupId
      return groupId
    },

    _findInstance(instanceId) {
      return this.instances.find((instance) => instance.id === instanceId) || null
    },

    _findGroup(groupId) {
      return this.groups.find((group) => group.id === groupId) || null
    },

    _groupIndex(groupId) {
      return this.groups.findIndex((group) => group.id === groupId)
    },

    _persistSnapshot() {
      const workspace = this._workspace()
      if (!workspace.path) return

      const snapshot = {
        nextInstanceId: this.nextInstanceId,
        nextGroupId: this.nextGroupId,
        nextMarkerId: this.nextMarkerId,
        activeGroupId: this.activeGroupId,
        activeInstanceId: this.activeInstanceId,
        groups: this.groups.map((group) => ({
          id: group.id,
          activeInstanceId: group.activeInstanceId,
        })),
        tabOrder: [...this.tabOrder],
        instances: this.instances.map((instance) => ({
          id: instance.id,
          key: instance.key,
          groupId: instance.groupId,
          kind: instance.kind,
          mode: instance.mode,
          label: instance.label,
          customLabel: instance.customLabel,
          title: instance.title,
          language: instance.language,
          spawnCmd: instance.spawnCmd,
          spawnArgs: cloneArgs(instance.spawnArgs),
        })),
      }

      saveTerminalSnapshot(workspace.path, snapshot)
    },

    async resetForWorkspace() {
      const sessionIds = this.instances
        .map((instance) => instance.sessionId)
        .filter((sessionId) => sessionId !== null)

      for (const sessionId of sessionIds) {
        try {
          await killTerminalSession(sessionId)
        } catch {}
        await disposeTerminalSession(sessionId)
      }

      Object.assign(this, createEmptyState())
    },

    hydrateForWorkspace(force = false) {
      const workspace = this._workspace()
      const workspacePath = workspace.path || ''

      if (!workspacePath) {
        if (this.hydratedWorkspacePath) {
          void this.resetForWorkspace()
        }
        return
      }

      if (!force && this.hydratedWorkspacePath === workspacePath) return

      Object.assign(this, createEmptyState())
      const snapshot = loadTerminalSnapshot(workspacePath)

      if (!snapshot) {
        this.hydratedWorkspacePath = workspacePath
        this._ensureBaseGroup()
        return
      }

      this.nextInstanceId = Math.max(Number(snapshot.nextInstanceId) || 1, 1)
      this.nextGroupId = Math.max(Number(snapshot.nextGroupId) || 1, 1)
      this.nextMarkerId = Math.max(Number(snapshot.nextMarkerId) || 1, 1)
      this.groups = (snapshot.groups || [])
        .map(normalizeSerializedGroup)
        .filter((group) => group.id > 0)
      this.instances = (snapshot.instances || [])
        .map(normalizeSerializedInstance)
        .filter((instance) => instance.id > 0)

      const validIds = new Set(this.instances.map((instance) => instance.id))
      this.tabOrder = (snapshot.tabOrder || []).filter((id) => validIds.has(id))
      for (const instance of this.instances) {
        if (!this.tabOrder.includes(instance.id)) {
          this.tabOrder.push(instance.id)
        }
      }

      if (this.groups.length === 0) {
        this._ensureBaseGroup()
      }

      const validGroupIds = new Set(this.groups.map((group) => group.id))
      for (const instance of this.instances) {
        if (!validGroupIds.has(instance.groupId)) {
          instance.groupId = this.groups[0].id
        }
      }

      this.activeGroupId = validGroupIds.has(snapshot.activeGroupId)
        ? snapshot.activeGroupId
        : this.groups[0]?.id || null
      this.activeInstanceId = validIds.has(snapshot.activeInstanceId)
        ? snapshot.activeInstanceId
        : this.tabOrder[0] || null

      for (const group of this.groups) {
        const groupInstances = this.instances.filter((instance) => instance.groupId === group.id)
        if (!groupInstances.some((instance) => instance.id === group.activeInstanceId)) {
          group.activeInstanceId = groupInstances[0]?.id || null
        }
      }

      this.hydratedWorkspacePath = workspacePath
    },

    _createInstance(definition = {}, { activate = true, persist = true } = {}) {
      const groupId = definition.groupId || this.activeGroupId || this._ensureBaseGroup()
      const instance = {
        id: this.nextInstanceId++,
        key: definition.key || null,
        groupId,
        kind: definition.kind || 'shell',
        mode: definition.mode || (definition.kind === 'log' ? 'log' : 'shell'),
        label: definition.label || this._defaultTerminalLabel(),
        customLabel: definition.customLabel || null,
        title: definition.title || '',
        language: definition.language || null,
        spawnCmd: definition.spawnCmd || null,
        spawnArgs: cloneArgs(definition.spawnArgs),
        cwd: '',
        status: 'idle',
        lastExitCode: null,
        lastCols: definition.lastCols || 120,
        lastRows: definition.lastRows || 32,
        sessionId: null,
        shellIntegrationReady: false,
        commandMarkers: [],
        activeCommandMarkerId: null,
        logChunks: [],
        logRevision: 0,
        logResetToken: 0,
      }

      this.instances.push(instance)
      this.tabOrder.push(instance.id)
      const group = this._findGroup(groupId) || this._findGroup(this._ensureBaseGroup())
      if (group && !group.activeInstanceId) {
        group.activeInstanceId = instance.id
      }
      if (activate) {
        this.activateInstance(instance.id)
      }
      if (persist) this._persistSnapshot()
      return instance.id
    },

    ensureDefaultShell() {
      this.hydrateForWorkspace()
      if (this.instances.length > 0) return this.activeInstanceId || this.instances[0].id
      return this._createInstance()
    },

    createTerminal() {
      this.hydrateForWorkspace()
      const id = this._createInstance()
      this._workspace().openBottomPanel()
      return id
    },

    activateInstance(instanceId) {
      const instance = this._findInstance(instanceId)
      if (!instance) return
      this.activeInstanceId = instance.id
      this.activeGroupId = instance.groupId
      const group = this._findGroup(instance.groupId)
      if (group) {
        group.activeInstanceId = instance.id
      }
      this._persistSnapshot()
    },

    activateGroup(groupId) {
      const group = this._findGroup(groupId)
      if (!group) return
      this.activeGroupId = group.id
      if (group.activeInstanceId) this.activeInstanceId = group.activeInstanceId
    },

    renameInstance(instanceId, label) {
      const instance = this._findInstance(instanceId)
      if (!instance) return
      const nextLabel = String(label || '').trim()
      if (!nextLabel) return
      instance.label = nextLabel
      instance.customLabel = nextLabel
      this._persistSnapshot()
    },

    reorderTabs(fromIndex, toIndex) {
      if (fromIndex === toIndex) return
      const safeFrom = clampIndex(fromIndex, this.tabOrder.length)
      const safeTo = clampIndex(toIndex, this.tabOrder.length)
      if (safeFrom < 0 || safeTo < 0) return
      const [moved] = this.tabOrder.splice(safeFrom, 1)
      this.tabOrder.splice(safeTo, 0, moved)
      this._persistSnapshot()
    },

    _insertGroupAfter(groupId) {
      const currentIndex = this._groupIndex(groupId)
      const nextId = this.nextGroupId++
      const nextGroup = createGroup(nextId)
      if (currentIndex === -1) {
        this.groups.push(nextGroup)
      } else {
        this.groups.splice(currentIndex + 1, 0, nextGroup)
      }
      return nextId
    },

    splitInstance(instanceId = this.activeInstanceId) {
      const source = this._findInstance(instanceId)
      if (!source) return null

      const nextGroupId = this._insertGroupAfter(source.groupId)
      let nextDefinition

      if (source.kind === 'repl' && source.language) {
        const config = getLanguageConfig(source.language)
        nextDefinition = {
          groupId: nextGroupId,
          kind: 'repl',
          mode: 'shell',
          label: config?.label || source.label,
          language: source.language,
          spawnCmd: config?.cmd || source.spawnCmd,
          spawnArgs: cloneArgs(config?.args || source.spawnArgs),
        }
      } else {
        nextDefinition = {
          groupId: nextGroupId,
          kind: 'shell',
          mode: 'shell',
          label: this._defaultTerminalLabel(),
        }
      }

      const id = this._createInstance(nextDefinition)
      this._workspace().openBottomPanel()
      return id
    },

    async closeInstance(instanceId) {
      const workspace = this._workspace()
      const instanceIndex = this.instances.findIndex((instance) => instance.id === instanceId)
      if (instanceIndex === -1) return

      const instance = this.instances[instanceIndex]
      if (instance.sessionId !== null) {
        try {
          await killTerminalSession(instance.sessionId)
        } catch {}
        await disposeTerminalSession(instance.sessionId)
      }

      this.instances.splice(instanceIndex, 1)
      this.tabOrder = this.tabOrder.filter((id) => id !== instanceId)

      const group = this._findGroup(instance.groupId)
      const remainingGroupInstances = this.instances.filter((item) => item.groupId === instance.groupId)
      if (group) {
        group.activeInstanceId = remainingGroupInstances[0]?.id || null
      }
      if (group && remainingGroupInstances.length === 0 && this.groups.length > 1) {
        this.groups = this.groups.filter((item) => item.id !== group.id)
      }

      if (this.instances.length === 0) {
        this.activeInstanceId = null
        this.activeGroupId = this.groups[0]?.id || null
        if (workspace.bottomPanelOpen) {
          workspace.toggleBottomPanel()
        }
        clearTerminalSnapshot(workspace.path || '')
        return
      }

      const nextActive = this._findInstance(this.activeInstanceId)
        || this._findInstance(group?.activeInstanceId)
        || this.instances[0]
      this.activateInstance(nextActive.id)
      this._persistSnapshot()
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
      const instance = this._findInstance(instanceId)
      if (!instance) return
      instance.lastCols = cols || instance.lastCols
      instance.lastRows = rows || instance.lastRows
    },

    async ensureSession(instanceId) {
      const workspace = this._workspace()
      const instance = this._findInstance(instanceId)
      if (!workspace.path || !instance || instance.kind === 'log') return null
      if (instance.sessionId !== null) return instance.sessionId

      const shell = defaultShell()
      const sessionId = await spawnTerminalSession({
        cmd: instance.spawnCmd || shell.cmd,
        args: instance.spawnCmd ? instance.spawnArgs : shell.args,
        cwd: workspace.path,
        cols: instance.lastCols || 120,
        rows: instance.lastRows || 32,
      })

      instance.sessionId = sessionId
      instance.status = 'running'
      instance.lastExitCode = null
      instance.shellIntegrationReady = false

      if (instance.kind === 'shell' && !instance.spawnCmd) {
        const bootstrap = buildShellIntegrationBootstrap(shell.cmd)
        if (bootstrap) {
          window.setTimeout(() => {
            if (instance.sessionId !== sessionId) return
            void writeTerminalSession(sessionId, bootstrap).catch(() => {})
          }, 120)
        }
        instance.shellIntegrationReady = true
      }

      return sessionId
    },

    markSessionExited(instanceId, payload = null) {
      const instance = this._findInstance(instanceId)
      if (!instance) return
      instance.sessionId = null
      instance.status = 'exited'
      instance.activeCommandMarkerId = null
      instance.lastExitCode = Number.isFinite(payload?.code) ? payload.code : null
    },

    updateInstanceCwd(instanceId, cwd) {
      const instance = this._findInstance(instanceId)
      if (!instance) return
      instance.cwd = cwd || ''
    },

    registerCommandStart(instanceId, command = '') {
      const instance = this._findInstance(instanceId)
      if (!instance) return null

      const markerId = this.nextMarkerId++
      const marker = {
        id: markerId,
        command: String(command || '').trim(),
        cwd: instance.cwd || '',
        status: null,
        startedAt: Date.now(),
      }
      instance.commandMarkers.push(marker)
      if (instance.commandMarkers.length > MAX_COMMAND_MARKERS) {
        instance.commandMarkers.splice(0, instance.commandMarkers.length - MAX_COMMAND_MARKERS)
      }
      instance.activeCommandMarkerId = markerId
      instance.status = 'busy'
      return markerId
    },

    registerCommandFinish(instanceId, markerId, status) {
      const instance = this._findInstance(instanceId)
      if (!instance) return

      const targetId = markerId || instance.activeCommandMarkerId
      const marker = instance.commandMarkers.find((item) => item.id === targetId)
      if (marker) {
        marker.status = Number.isFinite(Number(status)) ? Number(status) : null
        marker.finishedAt = Date.now()
      }

      instance.activeCommandMarkerId = null
      instance.lastExitCode = Number.isFinite(Number(status)) ? Number(status) : null
      instance.status = 'running'
    },

    _setLogInstanceStatus(instanceId, status) {
      const instance = this._findInstance(instanceId)
      if (!instance || instance.kind !== 'log' || !status) return

      switch (status) {
        case 'running':
          instance.status = 'busy'
          instance.lastExitCode = null
          break
        case 'success':
          instance.status = 'success'
          instance.lastExitCode = 0
          break
        case 'error':
          instance.status = 'error'
          instance.lastExitCode = 1
          break
        default:
          break
      }
    },

    clearLogInstance(instanceId) {
      const instance = this._findInstance(instanceId)
      if (!instance || instance.kind !== 'log') return
      instance.logChunks = []
      instance.logRevision += 1
      instance.logResetToken += 1
      instance.status = 'idle'
      instance.lastExitCode = null
    },

    appendLogChunk(instanceId, text, { clear = false } = {}) {
      const instance = this._findInstance(instanceId)
      if (!instance || instance.kind !== 'log') return
      if (clear) {
        instance.logChunks = []
        instance.logResetToken += 1
      }
      instance.logChunks.push(String(text || ''))
      instance.logRevision += 1
    },

    _buildLogText(label, text, { clear = false } = {}) {
      const body = String(text ?? '').replace(/\r\n/g, '\n')
      const lines = []
      if (!clear) lines.push('')
      lines.push(`[${label}]`)
      lines.push(body.trimEnd())
      lines.push('')
      return lines.join('\n')
    },

    ensureBuildLogTerminal({ key = SHARED_LOG_KEY, label = 'Build', activate = true } = {}) {
      this.hydrateForWorkspace()
      const existing = this.instances.find((instance) => instance.key === key)
      if (existing) {
        existing.label = label
        if (activate) this.activateInstance(existing.id)
        return existing.id
      }
      return this._createInstance({
        key,
        kind: 'log',
        mode: 'log',
        label,
      }, { activate })
    },

    ensureSharedShellTerminal({ activate = true } = {}) {
      this.hydrateForWorkspace()
      const existing = this.instances.find((instance) => instance.key === SHARED_SHELL_KEY)
      if (existing) {
        existing.label = 'Shell'
        if (activate) this.activateInstance(existing.id)
        return existing.id
      }
      return this._createInstance({
        key: SHARED_SHELL_KEY,
        kind: 'shell',
        mode: 'shell',
        label: 'Shell',
      }, { activate })
    },

    ensureLanguageTerminal(language, { activate = true } = {}) {
      this.hydrateForWorkspace()
      const config = getLanguageConfig(language)
      if (!config) return null

      const existing = this.instances.find((instance) => instance.language === language && instance.kind === 'repl')
      if (existing) {
        if (activate) this.activateInstance(existing.id)
        return existing.id
      }

      return this._createInstance({
        kind: 'repl',
        mode: 'shell',
        label: config.label,
        language,
        spawnCmd: config.cmd,
        spawnArgs: config.args,
      }, { activate })
    },

    async sendTextToInstance(instanceId, text) {
      const instance = this._findInstance(instanceId)
      if (!instance || instance.kind === 'log') return false

      const sessionId = await this.ensureSession(instanceId)
      if (sessionId === null) return false

      const payload = String(text || '')
      if (payload.length < 2048) {
        await writeTerminalSession(sessionId, payload)
        return true
      }

      const chunkSize = 2048
      for (let offset = 0; offset < payload.length; offset += chunkSize) {
        let end = Math.min(offset + chunkSize, payload.length)
        if (end < payload.length) {
          const newline = payload.lastIndexOf('\n', end)
          if (newline > offset) end = newline + 1
        }
        await writeTerminalSession(sessionId, payload.slice(offset, end))
        if (end < payload.length) {
          await new Promise((resolve) => window.setTimeout(resolve, 10))
        }
      }
      return true
    },

    async _buildReplCommand(code, language) {
      if (!String(code || '').includes('\n')) return `${code}\n`

      const extension = REPL_TEMP_EXT[language] || '.txt'
      const tempPath = `/tmp/.altals-run-${Date.now()}${extension}`
      await invoke('write_file', { path: tempPath, content: code })

      switch (language) {
        case 'r':
          return `source("${tempPath}", echo = TRUE)\n`
        case 'python':
          return `exec(open("${tempPath}").read())\n`
        case 'julia':
          return `include("${tempPath}")\n`
        default:
          return `${code}\n`
      }
    },

    async handleCreateLanguageTerminalEvent({ language } = {}) {
      if (!language) return
      if (language === '__shell__') {
        const id = this.ensureSharedShellTerminal()
        this._workspace().openBottomPanel()
        this.activateInstance(id)
        return
      }

      const id = this.ensureLanguageTerminal(language)
      if (id !== null) {
        this._workspace().openBottomPanel()
        this.activateInstance(id)
      }
    },

    handleFocusLanguageTerminalEvent({ language } = {}) {
      if (!language) return
      const instance = this.instances.find((item) => item.language === language && item.kind === 'repl')
      if (!instance) return
      this.activateInstance(instance.id)
      this._workspace().openBottomPanel()
    },

    async handleSendToReplEvent({ code, language } = {}) {
      if (!code || !language) return
      this._workspace().openBottomPanel()

      if (language === '__shell__') {
        const id = this.ensureSharedShellTerminal()
        this.activateInstance(id)
        await this.sendTextToInstance(id, `${code}\n`)
        return
      }

      const id = this.ensureLanguageTerminal(language)
      if (id === null) return
      this.activateInstance(id)
      const command = await this._buildReplCommand(code, language)
      await this.sendTextToInstance(id, command)
    },

    handleTerminalLogEvent({ key, label, text, clear = false, open = true, status = null } = {}) {
      if (!key || !text) return
      const definition = resolveLogTerminalDefinition(key, label)
      const id = this.ensureBuildLogTerminal({
        key: definition.terminalKey,
        label: definition.label,
        activate: open,
      })
      if (open) {
        this.activateInstance(id)
        this._workspace().openBottomPanel()
      }
      const payload = definition.preserveText
        ? String(text ?? '')
        : this._buildLogText(label || key, text, { clear })
      this.appendLogChunk(id, payload, { clear })
      this._setLogInstanceStatus(id, status)
    },

    handleTerminalStreamEvent({ key, label, text, clear = false, open = false, header = false, status = null } = {}) {
      if (!key || !text) return
      const definition = resolveLogTerminalDefinition(key, label)
      const id = this.ensureBuildLogTerminal({
        key: definition.terminalKey,
        label: definition.label,
        activate: open,
      })
      if (open) {
        this.activateInstance(id)
        this._workspace().openBottomPanel()
      }
      const normalizedText = String(text ?? '').replace(/\r\n/g, '\n')
      const prefix = header ? `\n[${label || key}]\n` : ''
      const payload = definition.preserveText
        ? normalizedText
        : `${prefix}${normalizedText}`
      this.appendLogChunk(id, payload, { clear })
      this._setLogInstanceStatus(id, status)
    },
  },
})
