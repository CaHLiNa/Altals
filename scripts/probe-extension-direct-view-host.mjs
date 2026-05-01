import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const repoRoot = process.cwd()
const hostPath = path.join(repoRoot, 'src-tauri/resources/extension-host/extension-host.mjs')

const extensionSource = `
export async function activate(context) {
  context.views.registerViewProvider('exampleDirectViewExtension.resultView', async () => ({
    title: 'Direct Result View',
    description: 'Direct host view provider contract',
    message: 'Direct view resolved',
    badgeValue: 1,
    badgeTooltip: 'One direct view result is available.',
    statusLabel: 'Ready',
    statusTone: 'success',
    actionLabel: 'Inspect direct outputs',
    sections: [
      {
        id: 'target',
        kind: 'context',
        title: 'Target',
        value: context.documents?.resource?.path || 'none',
      },
    ],
    resultEntries: [
      {
        id: 'open-source',
        label: 'Open Source File',
        path: '/tmp/direct-source.md',
        action: 'open',
        previewMode: 'text',
        previewPath: '/tmp/direct-source.md',
        previewTitle: 'Source File',
        mediaType: 'text/plain',
      },
    ],
    artifacts: [
      {
        id: 'direct-artifact',
        extensionId: 'example-direct-view-extension',
        taskId: 'external-task',
        capability: 'document.transform',
        kind: 'translated-text',
        mediaType: 'text/plain',
        path: '/tmp/direct-output.txt',
        sourcePath: '/tmp/direct-source.md',
      },
    ],
    outputs: [
      {
        id: 'direct-summary',
        type: 'inlineText',
        mediaType: 'text/plain',
        title: 'Direct Summary',
        description: 'Direct view summary',
        text: 'summary from direct view',
      },
      {
        id: 'direct-card',
        type: 'inlineHtml',
        mediaType: 'text/html',
        title: 'Direct HTML Card',
        description: 'Direct view html',
        html: '<p>direct html</p>',
      },
    ],
    items: [],
  }))
}
`

function ensure(condition, message, details = null) {
  if (condition) return
  const error = new Error(message)
  error.details = details
  throw error
}

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'scribeflow-direct-view-'))
  const extensionPath = path.join(tempRoot, 'example-direct-view-extension')
  const manifestPath = path.join(extensionPath, 'package.json')
  const distDir = path.join(extensionPath, 'dist')
  const entryPath = path.join(distDir, 'extension.js')

  await import('node:fs/promises').then(({ mkdir }) => mkdir(distDir, { recursive: true }))
  await writeFile(entryPath, extensionSource, 'utf8')
  await writeFile(manifestPath, JSON.stringify({
    name: 'example-direct-view-extension',
    displayName: 'Example Direct View Extension',
    version: '0.1.0',
    type: 'module',
    main: './dist/extension.js',
    activationEvents: ['onView:exampleDirectViewExtension.resultView'],
    contributes: {
      viewsContainers: {
        activitybar: [
          {
            id: 'exampleDirectViewExtension.tools',
            title: 'Direct View Tools',
          },
        ],
      },
      views: {
        'exampleDirectViewExtension.tools': [
          {
            id: 'exampleDirectViewExtension.resultView',
            name: 'Direct Result View',
          },
        ],
      },
    },
    permissions: {
      readWorkspaceFiles: true,
    },
  }, null, 2), 'utf8')

  const child = spawn('node', [hostPath], {
    cwd: repoRoot,
    stdio: ['pipe', 'pipe', 'inherit'],
  })

  let currentResolve = null
  const observed = []

  function send(method, params) {
    child.stdin.write(`${JSON.stringify({ method, params })}\n`)
  }

  function call(method, params) {
    if (currentResolve) {
      throw new Error('probe does not support concurrent calls')
    }
    send(method, params)
    return new Promise((resolve, reject) => {
      currentResolve = { resolve, reject }
    })
  }

  child.stdout.setEncoding('utf8')
  let buffer = ''
  child.stdout.on('data', (chunk) => {
    buffer += chunk
    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line) {
        const message = JSON.parse(line)
        observed.push(message)
        if (['Activate', 'ResolveView', 'Error'].includes(message.kind)) {
          if (!currentResolve) {
            throw new Error(`unexpected terminal message without waiter: ${message.kind}`)
          }
          const { resolve, reject } = currentResolve
          currentResolve = null
          if (message.kind === 'Error') {
            reject(new Error(String(message.payload?.message || 'Unknown extension host error')))
          } else {
            resolve(message)
          }
        }
      }
      newlineIndex = buffer.indexOf('\n')
    }
  })

  child.on('exit', (code) => {
    if (currentResolve) {
      const { reject } = currentResolve
      currentResolve = null
      reject(new Error(`extension host exited early with code ${code ?? 'unknown'}`))
    }
  })

  setTimeout(() => {
    if (!currentResolve) return
    console.error(JSON.stringify({ timeout: true, observed }, null, 2))
    process.exitCode = 1
    child.kill()
  }, 8000)

  try {
    const activate = await call('Activate', {
      extensionId: 'example-direct-view-extension',
      activationEvent: 'onView:exampleDirectViewExtension.resultView',
      extensionPath,
      manifestPath,
      mainEntry: './dist/extension.js',
      permissions: { readWorkspaceFiles: true },
      capabilities: [],
      activationState: {
        settings: {},
        globalState: {},
        workspaceState: {},
      },
    })

    const resolved = await call('ResolveView', {
      activationEvent: 'onView:exampleDirectViewExtension.resultView',
      extensionPath,
      manifestPath,
      mainEntry: './dist/extension.js',
      viewId: 'exampleDirectViewExtension.resultView',
      parentItemId: '',
      envelope: {
        taskId: 'direct-task',
        extensionId: 'example-direct-view-extension',
        workspaceRoot: '/tmp/workspace',
        itemId: '',
        itemHandle: '',
        referenceId: '',
        capability: '',
        targetKind: 'workspace',
        targetPath: '/tmp/direct-source.md',
        settingsJson: '{}',
      },
    })

    ensure(activate?.payload?.registeredViews?.includes('exampleDirectViewExtension.resultView'), 'direct view was not registered', activate?.payload || {})
    ensure(Array.isArray(resolved?.payload?.resultEntries) && resolved.payload.resultEntries.length === 1, 'direct view did not return baseline result entries', resolved?.payload || {})
    ensure(Array.isArray(resolved?.payload?.artifacts) && resolved.payload.artifacts.length === 1, 'direct view did not return artifacts', resolved?.payload || {})
    ensure(Array.isArray(resolved?.payload?.outputs) && resolved.payload.outputs.length === 2, 'direct view did not return outputs', resolved?.payload || {})
    ensure(String(resolved?.payload?.artifacts?.[0]?.path || '') === '/tmp/direct-output.txt', 'direct view artifact path drifted', resolved?.payload || {})
    ensure(String(resolved?.payload?.artifacts?.[0]?.taskId || '') === 'external-task', 'direct view artifact task id drifted', resolved?.payload || {})
    ensure(String(resolved?.payload?.artifacts?.[0]?.capability || '') === 'document.transform', 'direct view artifact capability drifted', resolved?.payload || {})
    ensure(String(resolved?.payload?.outputs?.[0]?.type || '').toLowerCase() === 'inlinetext', 'direct view text output drifted', resolved?.payload || {})
    ensure(String(resolved?.payload?.outputs?.[1]?.type || '').toLowerCase() === 'inlinehtml', 'direct view html output drifted', resolved?.payload || {})

    console.log(JSON.stringify({
      ok: true,
      summary: {
        registeredViews: activate?.payload?.registeredViews || [],
        resultEntryIds: resolved.payload.resultEntries.map((entry) => entry.id),
        artifactIds: resolved.payload.artifacts.map((entry) => entry.id),
        artifactTaskIds: resolved.payload.artifacts.map((entry) => entry.taskId),
        artifactCapabilities: resolved.payload.artifacts.map((entry) => entry.capability),
        outputIds: resolved.payload.outputs.map((entry) => entry.id),
      },
    }, null, 2))
  } finally {
    child.kill()
  }
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error?.message || String(error),
    details: error?.details || null,
  }, null, 2))
  process.exitCode = 1
})
