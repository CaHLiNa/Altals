import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const repoRoot = process.cwd()
const hostPath = path.join(repoRoot, 'src-tauri/resources/extension-host/extension-host.mjs')
const extensionPath = path.join(repoRoot, '.scribeflow/extensions/retain-pdf')
const manifestPath = path.join(extensionPath, 'package.json')

function ensure(condition, message, details = null) {
  if (condition) return
  const error = new Error(message)
  error.details = details
  throw error
}

function isTerminal(message) {
  return ['Activate', 'ExecuteCommand', 'InvokeCapability', 'ResolveView', 'Error'].includes(message.kind)
}

function send(child, method, params) {
  child.stdin.write(`${JSON.stringify({ method, params })}\n`)
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const tempWorkspace = path.join(os.tmpdir(), `scribeflow-retain-pdf-probe-${Date.now()}`)
  await mkdir(tempWorkspace, { recursive: true })
  const sourcePdf = path.join(tempWorkspace, 'paper.pdf')
  await writeFile(sourcePdf, '%PDF-1.4\n% probe\n', 'utf8')

  const child = spawn('node', [hostPath], {
    cwd: repoRoot,
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const observed = []
  const writtenSettingsPayloads = []
  const spawnEnvPayloads = []
  let current = null
  let buffer = ''

  const call = (method, params) => {
    if (current) throw new Error('probe does not support concurrent calls')
    send(child, method, params)
    return new Promise((resolve, reject) => {
      current = { resolve, reject }
    })
  }

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    buffer += chunk
    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line) {
        const message = JSON.parse(line)
        observed.push(message)
        if (isTerminal(message)) {
          if (!current) throw new Error(`unexpected terminal message: ${message.kind}`)
          const waiter = current
          current = null
          if (message.kind === 'Error') {
            waiter.reject(new Error(String(message.payload?.message || 'unknown host error')))
          } else {
            waiter.resolve(message)
          }
        } else {
          handleNonTerminal(child, message)
        }
      }
      newlineIndex = buffer.indexOf('\n')
    }
  })

  function handleNonTerminal(target, message) {
    if (message.kind !== 'HostCallRequested') return
    const requestId = message.payload?.requestId
    const kind = message.payload?.kind
    const payload = message.payload?.payload || {}
    if (kind === 'process.exec') {
      const args = Array.isArray(payload.args) ? payload.args : []
      const filePath = String(args[2] || args[1] || '')
      const jsonPayload = String(args[3] || args[2] || '{}')
      if (String(args[0] || '') === '-e' && String(args[1] || '').includes('fs.writeFileSync') && filePath) {
        writtenSettingsPayloads.push(JSON.parse(jsonPayload || '{}'))
        void mkdir(path.dirname(filePath), { recursive: true })
          .then(() => writeFile(filePath, jsonPayload, 'utf8'))
          .then(() => send(target, 'ResolveHostCall', {
            requestId,
            accepted: true,
            result: { ok: true, code: 0, stdout: '', stderr: '' },
          }))
        return
      }
      if (String(args[0] || '') === '-e' && String(args[1] || '').includes('process.stdout.write') && filePath) {
        void readFile(filePath, 'utf8')
          .catch(() => '{}')
          .then((stdout) => send(target, 'ResolveHostCall', {
            requestId,
            accepted: true,
            result: { ok: true, code: 0, stdout, stderr: '' },
          }))
        return
      }
    }
    if (kind === 'process.spawn') {
      const args = Array.isArray(payload.args) ? payload.args : []
      spawnEnvPayloads.push(payload.env || {})
      const resultPath = String(args[args.indexOf('--result') + 1] || '')
      const logPath = String(args[args.indexOf('--log') + 1] || '')
      const translatedPdf = String(args[args.indexOf('--translatedPdf') + 1] || '')
      const translatedText = String(args[args.indexOf('--translatedText') + 1] || '')
      void Promise.all([
        mkdir(path.dirname(resultPath), { recursive: true }),
        mkdir(path.dirname(logPath), { recursive: true }),
        mkdir(path.dirname(translatedPdf), { recursive: true }),
        mkdir(path.dirname(translatedText), { recursive: true }),
      ]).then(async () => {
        await writeFile(translatedPdf, '%PDF-1.4\n% translated probe\n', 'utf8')
        await writeFile(translatedText, '# translated probe\n', 'utf8')
        await writeFile(logPath, 'probe log\n', 'utf8')
        await writeFile(resultPath, JSON.stringify({
          ok: true,
          status: 'succeeded',
          retainPdfJobId: 'retain-job-probe',
          sourcePdf,
          translatedPdfPath: translatedPdf,
          translatedTextPath: translatedText,
          logPath,
          finalStage: 'finished',
          finalStageDetail: 'probe completed',
          message: 'RetainPDF probe succeeded',
        }), 'utf8')
        send(target, 'ResolveHostCall', {
          requestId,
          accepted: true,
          result: { ok: true, pid: 43110 },
        })
      })
      return
    }
    if (kind === 'process.wait') {
      send(target, 'ResolveHostCall', {
        requestId,
        accepted: true,
        result: { ok: true, pid: payload.pid || 43110, code: 0 },
      })
      return
    }
    if (kind === 'tasks.update') {
      send(target, 'ResolveHostCall', {
        requestId,
        accepted: true,
        result: {
          id: payload.taskId || '',
          state: payload.state || '',
          progress: { label: payload.progressLabel || '' },
          artifacts: payload.artifacts || [],
          outputs: payload.outputs || [],
        },
      })
      return
    }
    send(target, 'ResolveHostCall', {
      requestId,
      accepted: false,
      error: `Unhandled host call kind: ${kind}`,
    })
  }

  const envelope = {
    extensionId: 'retain-pdf',
    workspaceRoot: tempWorkspace,
    taskId: 'retain-probe-task',
    commandId: 'retainPdf.translateCurrent',
    capability: 'pdf.translate',
    targetKind: 'pdf',
    targetPath: sourcePdf,
    referenceId: 'ref-probe',
    settingsJson: '{}',
    locale: 'zh-CN',
  }

  const activationState = {
    settings: {
      'retainPdf.apiBaseUrl': 'http://127.0.0.1:41000',
      'retainPdf.apiKey': 'backend-key',
      'retainPdf.ocrProvider': 'mineru',
      'retainPdf.mineruToken': 'mineru-token',
      'retainPdf.modelBaseUrl': 'https://api.deepseek.com/v1',
      'retainPdf.model': 'deepseek-v4-flash',
      'retainPdf.modelApiKey': 'model-key',
      'retainPdf.workflow': 'book',
      'retainPdf.developerMode': true,
      'retainPdf.pollIntervalSeconds': 1,
      'retainPdf.timeoutSeconds': 120,
    },
    globalState: {},
    workspaceState: {},
    locale: 'zh-CN',
  }

  const activation = await call('Activate', {
    extensionId: 'retain-pdf',
    extensionPath,
    manifestPath,
    mainEntry: manifest.main,
    activationEvent: 'onCommand:retainPdf.translateCurrent',
    permissions: manifest.permissions,
    capabilities: manifest.contributes.capabilities,
    activationState,
    envelope,
  })
  ensure(activation.payload.registeredCommands.includes('retainPdf.translateCurrent'), 'retain-pdf command was not registered', activation.payload)
  ensure(activation.payload.registeredCapabilities.includes('pdf.translate'), 'retain-pdf capability was not registered', activation.payload)
  ensure(activation.payload.registeredViews.includes('retainPdf.panel'), 'retain-pdf panel was not registered', activation.payload)

  const executed = await call('ExecuteCommand', {
    extensionId: 'retain-pdf',
    extensionPath,
    manifestPath,
    mainEntry: manifest.main,
    commandId: 'retainPdf.translateCurrent',
    permissions: manifest.permissions,
    capabilities: manifest.contributes.capabilities,
    activationState,
    envelope,
  })
  const payload = executed.payload || {}
  const artifactIds = Array.isArray(payload.artifacts) ? payload.artifacts.map((entry) => entry.id) : []
  const resultEntryIds = Array.isArray(payload.resultEntries) ? payload.resultEntries.map((entry) => entry.id) : []
  ensure(payload.taskState === 'succeeded', 'retain-pdf command did not succeed', payload)
  ensure(artifactIds.includes('retain-pdf-translated-pdf'), 'translated PDF artifact missing', payload)
  ensure(artifactIds.includes('retain-pdf-log'), 'log artifact missing', payload)
  ensure(resultEntryIds.includes('retain-pdf-rerun'), 'rerun result entry missing', payload)
  const writtenSettings = writtenSettingsPayloads[0] || {}
  ensure(!Object.hasOwn(writtenSettings, 'apiKey'), 'RetainPDF worker settings leaked apiKey to disk', writtenSettings)
  ensure(!Object.hasOwn(writtenSettings, 'mineruToken'), 'RetainPDF worker settings leaked mineruToken to disk', writtenSettings)
  ensure(!Object.hasOwn(writtenSettings, 'paddleToken'), 'RetainPDF worker settings leaked paddleToken to disk', writtenSettings)
  ensure(!Object.hasOwn(writtenSettings, 'modelApiKey'), 'RetainPDF worker settings leaked modelApiKey to disk', writtenSettings)
  const spawnEnv = spawnEnvPayloads[0] || {}
  ensure(spawnEnv.RETAIN_PDF_API_KEY === 'backend-key', 'RetainPDF worker api key was not passed through process env', spawnEnv)
  ensure(spawnEnv.RETAIN_PDF_MINERU_TOKEN === 'mineru-token', 'RetainPDF worker OCR token was not passed through process env', spawnEnv)
  ensure(spawnEnv.RETAIN_PDF_MODEL_API_KEY === 'model-key', 'RetainPDF worker model key was not passed through process env', spawnEnv)

  const viewChanged = observed.find((entry) =>
    entry.kind === 'ViewStateChanged' &&
    entry.payload?.viewId === 'retainPdf.panel' &&
    Array.isArray(entry.payload?.resultEntries) &&
    entry.payload.resultEntries.some((item) => item.id === 'retain-pdf-translated-pdf') &&
    entry.payload.statusLabel === '已完成'
  )
  ensure(Boolean(viewChanged), 'retain-pdf panel did not publish completed translated result entries', observed)
  ensure(
    viewChanged.payload.resultEntries.some((item) => item.label === '打开翻译后 PDF'),
    'retain-pdf panel did not localize result entries from plugin language pack',
    viewChanged.payload,
  )

  child.kill()
  console.log(JSON.stringify({
    ok: true,
    commandCount: activation.payload.registeredCommands.length,
    artifactIds,
    resultEntryIds,
    viewStatus: viewChanged.payload.statusLabel,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
