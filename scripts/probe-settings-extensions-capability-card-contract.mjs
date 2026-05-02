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

  mockIPC((cmd) => {
    if (cmd === 'workspace_preferences_load') {
      return {
        preferredLocale: 'en-US',
      }
    }
    if (cmd === 'i18n_runtime_load') {
      return {
        locale: 'en-US',
        systemLocale: 'en-US',
        messages: {},
        aliases: {},
      }
    }
    throw new Error(`Unexpected IPC command: ${cmd}`)
  }, { shouldMockEvents: true })

  const { createSSRApp } = await vite.ssrLoadModule('/node_modules/vue/dist/vue.runtime.esm-bundler.js')
  const { renderToString } = await vite.ssrLoadModule('/node_modules/@vue/server-renderer/dist/server-renderer.esm-browser.js')
  const { useExtensionsStore } = await vite.ssrLoadModule('/src/stores/extensions.js')
  const { useWorkspaceStore } = await vite.ssrLoadModule('/src/stores/workspace.js')
  const { useEditorStore } = await vite.ssrLoadModule('/src/stores/editor.js')
  const { useReferencesStore } = await vite.ssrLoadModule('/src/stores/references.js')
  const componentModule = await vite.ssrLoadModule('/src/components/settings/SettingsExtensions.vue')
  const SettingsExtensions = componentModule.default

  const pinia = createPinia()
  setActivePinia(pinia)

  const workspace = useWorkspaceStore(pinia)
  workspace.path = '/tmp/workspace-a'
  workspace.leftSidebarPanel = 'files'
  workspace.globalConfigDir = '/tmp/global-config'
  workspace.ensureGlobalConfigDir = async () => '/tmp/global-config'

  const editor = useEditorStore(pinia)
  editor.activePaneId = 'pane-1'
  editor.paneTree = {
    id: 'pane-1',
    type: 'leaf',
    tabs: ['/tmp/workspace-a/paper.pdf'],
    activeTab: '/tmp/workspace-a/paper.pdf',
  }

  const references = useReferencesStore(pinia)
  references.selectedReferenceId = 'ref-123'
  references.references = [{
    id: 'ref-123',
    title: 'Probe Reference',
    pdfPath: '/tmp/workspace-a/paper.pdf',
  }]
  references.resolvedQueryState = {
    ...references.resolvedQueryState,
    filteredReferences: references.references,
    sortedReferences: references.references,
  }

  const extensions = useExtensionsStore(pinia)
  extensions.loadingRegistry = false

  const blockedExtension = {
    id: 'blocked-extension',
    name: 'Blocked Extension',
    version: '0.1.0',
    description: 'Blocked capability',
    scope: 'workspace',
    status: 'available',
    manifestFormat: 'package.json',
    main: './dist/extension.js',
    activationEvents: [],
    capabilities: ['document.translate'],
    contributedCommands: [],
    contributedMenus: [],
    contributedKeybindings: [],
    contributedViewContainers: [],
    contributedViews: [],
    contributedViewTitleMenus: [],
    contributedViewItemMenus: [],
    contributedCapabilities: [
      {
        id: 'document.translate',
        inputs: {
          document: {
            type: 'workspaceFile',
            required: true,
            extensions: ['.pdf'],
          },
        },
        outputs: {
          summary: {
            type: 'inlineText',
            required: true,
          },
        },
      },
    ],
    warnings: [],
    errors: [],
    settingsSchema: {},
    runtime: {
      runtimeType: 'node',
    },
  }

  const readyExtension = {
    id: 'ready-extension',
    name: 'Ready Extension',
    version: '0.1.0',
    description: 'Ready capability',
    scope: 'workspace',
    status: 'available',
    manifestFormat: 'package.json',
    main: './dist/extension.js',
    activationEvents: [],
    capabilities: ['document.summarize'],
    contributedCommands: [],
    contributedMenus: [],
    contributedKeybindings: [],
    contributedViewContainers: [],
    contributedViews: [],
    contributedViewTitleMenus: [],
    contributedViewItemMenus: [],
    contributedCapabilities: [
      {
        id: 'document.summarize',
        inputs: {
          document: {
            type: 'workspaceFile',
            required: true,
            extensions: ['.pdf'],
          },
        },
        outputs: {
          summary: {
            type: 'inlineText',
            required: true,
          },
        },
      },
    ],
    warnings: [],
    errors: [],
    settingsSchema: {},
    runtime: {
      runtimeType: 'node',
    },
  }

  async function renderCurrentState() {
    const app = createSSRApp(SettingsExtensions)
    app.use(pinia)
    return renderToString(app)
  }

  extensions.enabledExtensionIds = ['blocked-extension']
  extensions.registry = [blockedExtension]
  extensions.hostSummary = {
    available: true,
    runtime: 'node-extension-host-persistent',
    activatedExtensions: ['blocked-extension'],
    activeRuntimeSlots: [
      { extensionId: 'blocked-extension', workspaceRoot: '/tmp/workspace-a' },
    ],
    pendingPromptOwner: {
      extensionId: 'another-extension',
      workspaceRoot: '/tmp/workspace-b',
    },
  }
  extensions.runtimeRegistry = {
    'blocked-extension': {
      activated: true,
      registeredCommands: [],
      registeredViews: [],
      registeredCapabilities: ['document.translate'],
      registeredMenuActions: [],
    },
  }

  const blockedHtml = await renderCurrentState()
  assert.match(blockedHtml, /Blocked Extension/)
  assert.match(blockedHtml, /document\.translate/)
  assert.match(blockedHtml, /extension-blocked-status-chip/)
  assert.match(blockedHtml, /Blocked/)
  assert.match(blockedHtml, /title="The shared extension host is currently blocked by another-extension in \/tmp\/workspace-b\. Resolve that prompt first\."/)
  assert.doesNotMatch(blockedHtml, /Run document\.translate/)

  extensions.enabledExtensionIds = ['ready-extension']
  extensions.registry = [readyExtension]
  extensions.hostSummary = {
    available: true,
    runtime: 'node-extension-host-persistent',
    activatedExtensions: ['ready-extension'],
    activeRuntimeSlots: [
      { extensionId: 'ready-extension', workspaceRoot: '/tmp/workspace-a' },
    ],
    pendingPromptOwner: null,
  }
  extensions.runtimeRegistry = {
    'ready-extension': {
      activated: true,
      registeredCommands: [],
      registeredViews: [],
      registeredCapabilities: ['document.summarize'],
      registeredMenuActions: [],
    },
  }

  const readyHtml = await renderCurrentState()
  assert.match(readyHtml, /Ready Extension/)
  assert.match(readyHtml, /document\.summarize/)
  assert.match(readyHtml, /extension-status-pill/)
  assert.match(readyHtml, /Ready/)
  assert.match(readyHtml, /Run Summarize document/)

  console.log(JSON.stringify({
    ok: true,
    summary: {
      blockedUsesSharedChip: blockedHtml.includes('extension-blocked-status-chip'),
      blockedUsesSharedButtonLabel: blockedHtml.includes('>Blocked<'),
      readyKeepsStatusPill: readyHtml.includes('extension-status-pill'),
      readyActionLabel: readyHtml.includes('Run Summarize document'),
    },
  }, null, 2))
} finally {
  clearTauriMocks()
  await vite.close()
}
