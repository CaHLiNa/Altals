<template>
  <div
    ref="terminalContainer"
    class="terminal-surface h-full w-full min-h-0 min-w-0 overflow-hidden"
    @contextmenu.prevent="emit('contextmenu', $event)"
  />
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from '../../i18n'
import { resizeTerminalSession, subscribeTerminalSession } from '../../services/terminal/terminalSessions'
import { parseShellIntegrationPayload, TERMINAL_SHELL_OSC } from '../../services/terminal/terminalShellIntegration'
import { useTerminalStore } from '../../stores/terminal'
import { useWorkspaceStore } from '../../stores/workspace'
import { terminalThemes } from '../../themes/terminal'

const props = defineProps({
  instanceId: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['contextmenu'])

const terminalStore = useTerminalStore()
const workspace = useWorkspaceStore()
const { t } = useI18n()
const terminalContainer = ref(null)
const instance = computed(() => terminalStore.instances.find((item) => item.id === props.instanceId) || null)

let terminal = null
let fitAddon = null
let searchAddon = null
let resizeObserver = null
let sessionUnsubscribe = null
let currentSessionId = null
let lastLogRevision = 0
let lastLogResetToken = 0
let lastLogChunkIndex = 0
let activeMarkerId = null
let commandCursorIndex = -1
const commandMarkers = new Map()

function getMarkerEntries() {
  return [...commandMarkers.entries()]
    .filter(([, marker]) => marker && !marker.isDisposed)
    .sort((a, b) => a[1].line - b[1].line)
}

function writePlainOutput(data) {
  if (!terminal || !data) return
  terminal.write(String(data).replace(/\r?\n/g, '\r\n'))
}

function applyLogReplay() {
  const current = instance.value
  if (!terminal || !current || current.kind !== 'log') return

  if (current.logResetToken !== lastLogResetToken) {
    terminal.reset()
    lastLogResetToken = current.logResetToken
    lastLogChunkIndex = 0
  }

  if (current.logRevision === lastLogRevision && current.logChunks.length === lastLogChunkIndex) return

  for (; lastLogChunkIndex < current.logChunks.length; lastLogChunkIndex += 1) {
    writePlainOutput(current.logChunks[lastLogChunkIndex])
  }
  lastLogRevision = current.logRevision
}

function handleShellIntegration(data) {
  const current = instance.value
  if (!current) return

  const { type, payload } = parseShellIntegrationPayload(data)
  if (type === 'Cwd') {
    terminalStore.updateInstanceCwd(current.id, payload)
    return
  }

  if (type === 'CmdStart') {
    activeMarkerId = terminalStore.registerCommandStart(current.id, payload)
    commandCursorIndex = -1
    if (activeMarkerId !== null && typeof terminal?.registerMarker === 'function') {
      const marker = terminal.registerMarker(0)
      if (marker) commandMarkers.set(activeMarkerId, marker)
    }
    return
  }

  if (type === 'CmdFinish') {
    terminalStore.registerCommandFinish(current.id, activeMarkerId, payload)
    activeMarkerId = null
  }
}

async function bindSession(sessionId) {
  if (sessionUnsubscribe) {
    sessionUnsubscribe()
    sessionUnsubscribe = null
  }

  currentSessionId = sessionId
  if (sessionId === null) return

  sessionUnsubscribe = subscribeTerminalSession(sessionId, {
    replay: true,
    onOutput: (data) => {
      if (terminal && data) terminal.write(data)
    },
    onExit: (payload) => {
      terminalStore.markSessionExited(props.instanceId, payload)
      if (terminal) {
        terminal.write(`\r\n\x1b[90m[${t('Process exited')}]\x1b[0m\r\n`)
      }
    },
  })
}

async function ensureSession() {
  const current = instance.value
  if (!current || current.kind === 'log') return
  const sessionId = await terminalStore.ensureSession(current.id)
  if (sessionId !== null) {
    await bindSession(sessionId)
  }
}

function syncSurfaceSize() {
  const current = instance.value
  if (!terminal || !fitAddon || !current) return

  fitAddon.fit()
  terminalStore.setSurfaceSize(current.id, terminal.cols, terminal.rows)
  if (current.sessionId !== null) {
    void resizeTerminalSession(current.sessionId, terminal.cols, terminal.rows).catch(() => {})
  }
}

async function initTerminal() {
  const [{ Terminal }, { FitAddon }, { SearchAddon }, { WebLinksAddon }] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
    import('@xterm/addon-search'),
    import('@xterm/addon-web-links'),
  ])
  await import('@xterm/xterm/css/xterm.css')

  terminal = new Terminal({
    theme: terminalThemes[workspace.theme] || terminalThemes.default,
    fontFamily: "'JetBrains Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
    fontSize: 13,
    lineHeight: 1.42,
    scrollback: 20000,
    cursorBlink: instance.value?.kind !== 'log',
    disableStdin: instance.value?.kind === 'log',
    allowTransparency: true,
  })

  fitAddon = new FitAddon()
  searchAddon = new SearchAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(searchAddon)
  terminal.loadAddon(new WebLinksAddon())
  terminal.parser.registerOscHandler(TERMINAL_SHELL_OSC, (data) => {
    handleShellIntegration(data)
    return true
  })

  terminal.open(terminalContainer.value)
  await nextTick()
  syncSurfaceSize()

  terminal.onData((data) => {
    const current = instance.value
    if (!current || current.kind === 'log' || current.sessionId === null) return
    void terminalStore.sendTextToInstance(current.id, data).catch(() => {})
  })

  terminal.onResize(() => {
    syncSurfaceSize()
  })

  resizeObserver = new ResizeObserver(() => {
    syncSurfaceSize()
  })
  resizeObserver.observe(terminalContainer.value)

  if (instance.value?.kind === 'log') {
    applyLogReplay()
  } else {
    await ensureSession()
  }
}

watch(
  () => workspace.theme,
  (theme) => {
    if (!terminal) return
    terminal.options.theme = terminalThemes[theme] || terminalThemes.default
  },
)

watch(
  () => instance.value?.sessionId,
  (sessionId) => {
    if (!terminal || instance.value?.kind === 'log') return
    void bindSession(sessionId ?? null)
  },
)

watch(
  () => [instance.value?.logRevision, instance.value?.logResetToken],
  () => {
    applyLogReplay()
  },
)

watch(
  () => instance.value?.kind,
  (kind) => {
    if (!terminal) return
    terminal.options.disableStdin = kind === 'log'
    terminal.options.cursorBlink = kind !== 'log'
  },
)

defineExpose({
  focus() {
    terminal?.focus()
  },
  refitTerminal() {
    syncSurfaceSize()
  },
  clear() {
    if (!terminal) return
    terminal.clear()
  },
  searchNext(query, options = {}) {
    if (!searchAddon || !query) return false
    return searchAddon.findNext(query, options)
  },
  searchPrevious(query, options = {}) {
    if (!searchAddon || !query) return false
    return searchAddon.findPrevious(query, options)
  },
  copySelection() {
    const text = terminal?.getSelection?.() || ''
    if (!text) return false
    navigator.clipboard?.writeText?.(text)
    return true
  },
  async paste() {
    const current = instance.value
    if (!current || current.kind === 'log') return false
    const text = await navigator.clipboard?.readText?.()
    if (!text) return false
    await terminalStore.sendTextToInstance(current.id, text)
    return true
  },
  selectAll() {
    terminal?.selectAll?.()
  },
  async sendText(text) {
    const current = instance.value
    if (!current || current.kind === 'log') return false
    return terminalStore.sendTextToInstance(current.id, text)
  },
  scrollToCommand(direction = 'previous') {
    if (!terminal) return false
    const entries = getMarkerEntries()
    if (entries.length === 0) return false

    if (direction === 'next') {
      commandCursorIndex = Math.min(entries.length - 1, commandCursorIndex + 1)
    } else {
      if (commandCursorIndex < 0) commandCursorIndex = entries.length
      commandCursorIndex = Math.max(0, commandCursorIndex - 1)
    }

    terminal.scrollToLine(entries[commandCursorIndex][1].line)
    return true
  },
})

onMounted(async () => {
  await initTerminal()
})

onUnmounted(() => {
  if (sessionUnsubscribe) sessionUnsubscribe()
  if (resizeObserver) resizeObserver.disconnect()
  if (terminal) terminal.dispose()
  sessionUnsubscribe = null
  resizeObserver = null
  terminal = null
  fitAddon = null
  searchAddon = null
  currentSessionId = null
  commandMarkers.clear()
})
</script>
