import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { createPinia, setActivePinia } from 'pinia'
import { createLogger, createServer } from 'vite'

if (!globalThis.window) {
  globalThis.window = globalThis
}

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto
}

const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  logLevel: 'error',
  customLogger: createLogger('error', {
    customConsole: {
      ...console,
      error(message, ...rest) {
        const rendered = String(message || '')
        if (rendered.includes('WebSocket server error:')) return
        console.error(message, ...rest)
      },
    },
  }),
})

let clearTauriMocks = () => {}

try {
  const { mockIPC, mockWindows, clearMocks } = await import('@tauri-apps/api/mocks')
  clearTauriMocks = clearMocks
  mockWindows('main')

  let promptOpen = false
  const ipcCalls = []
  mockIPC((cmd, args) => {
    ipcCalls.push([cmd, args])
    if (cmd === 'extension_host_status') {
      return {
        available: true,
        runtime: 'node-extension-host-persistent',
        activatedExtensions: ['example-pdf-extension', 'example-pdf-extension'],
        activeRuntimeSlots: [
          {
            extensionId: 'example-pdf-extension',
            workspaceRoot: '/tmp/workspace-a',
          },
          {
            extensionId: 'example-pdf-extension',
            workspaceRoot: '/tmp/workspace-b',
          },
        ],
        pendingPromptOwner: promptOpen
          ? {
            extensionId: 'example-pdf-extension',
            workspaceRoot: '/tmp/workspace-b',
          }
          : null,
      }
    }
    if (cmd === 'extension_host_respond_ui_request') {
      promptOpen = false
      return {
        requestId: String(args?.params?.requestId || ''),
        accepted: true,
      }
    }
    if (cmd === 'extension_task_list') return []
    throw new Error(`Unexpected IPC command: ${cmd}`)
  }, { shouldMockEvents: true })

  const { useExtensionsStore } = await vite.ssrLoadModule('/src/stores/extensions.js')
  const { useWorkspaceStore } = await vite.ssrLoadModule('/src/stores/workspace.js')
  const { useExtensionWindowUiStore } = await vite.ssrLoadModule('/src/stores/extensionWindowUi.js')

  const pinia = createPinia()
  setActivePinia(pinia)

  const workspace = useWorkspaceStore(pinia)
  workspace.path = '/tmp/workspace-a'

  const extensions = useExtensionsStore(pinia)
  const extensionWindowUi = useExtensionWindowUiStore(pinia)
  const summary = await extensions.refreshHostSummary()

  assert.equal(summary.runtime, 'node-extension-host-persistent')
  assert.deepEqual(
    summary.activeRuntimeSlots.map((entry) => entry.workspaceRoot),
    ['/tmp/workspace-a', '/tmp/workspace-b'],
  )
  assert.equal(summary.pendingPromptOwner, null)

  promptOpen = true
  extensionWindowUi.presentRequest({
    requestId: 'request-pending-prompt',
    extensionId: 'example-pdf-extension',
    workspaceRoot: '/tmp/workspace-b',
    kind: 'inputBox',
    title: 'Pending prompt',
    prompt: 'Waiting for input',
    placeholder: 'Type here',
  })

  const pendingSummary = await extensions.syncHostSummaryAfterPromptEvent()
  assert.equal(pendingSummary.pendingPromptOwner?.extensionId, 'example-pdf-extension')
  assert.equal(pendingSummary.pendingPromptOwner?.workspaceRoot, '/tmp/workspace-b')

  await extensionWindowUi.resolve('confirmed')
  const recoveredSummary = await extensions.syncHostSummaryAfterPromptEvent()
  assert.equal(recoveredSummary.pendingPromptOwner, null)

  const diagnostics = extensions.hostDiagnosticsFor('example-pdf-extension', '/tmp/workspace-a')
  assert.equal(diagnostics.activeWorkspaceSlotCount, 1)
  assert.equal(diagnostics.otherWorkspaceSlotCount, 1)
  assert.equal(diagnostics.ownsPendingPrompt, false)

  console.log(JSON.stringify({
    ok: true,
    summary: {
      runtime: summary.runtime,
      activeRuntimeSlotCount: summary.activeRuntimeSlots.length,
      activeRuntimeSlotRoots: summary.activeRuntimeSlots.map((entry) => entry.workspaceRoot),
      pendingPromptOwnerWhilePromptOpen: pendingSummary.pendingPromptOwner,
      pendingPromptOwnerAfterResolve: recoveredSummary.pendingPromptOwner,
      activeWorkspaceSlotCount: diagnostics.activeWorkspaceSlotCount,
      otherWorkspaceSlotCount: diagnostics.otherWorkspaceSlotCount,
      respondRequestObserved: ipcCalls.some(([cmd]) => cmd === 'extension_host_respond_ui_request'),
    },
  }, null, 2))
} finally {
  clearTauriMocks()
  await vite.close()
}
