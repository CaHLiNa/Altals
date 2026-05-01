import assert from 'node:assert/strict'
import {
  buildExtensionArtifactPreviewEntries,
  buildExtensionTaskResultEntries,
} from '../src/services/extensions/extensionArtifactPreviewEntries.js'

async function main() {
  const entries = buildExtensionArtifactPreviewEntries([
    {
      id: 'artifact-pdf',
      kind: 'translated-pdf',
      mediaType: 'application/pdf',
      path: '/tmp/paper.pdf',
    },
    {
      id: 'artifact-text',
      kind: 'translated-text',
      mediaType: 'text/plain',
      path: '/tmp/paper.pdf.zh-CN.translation.txt',
    },
    {
      id: 'artifact-html',
      kind: 'translation-html',
      mediaType: 'text/html',
      path: '/tmp/translation.html',
    },
  ])

  assert.equal(entries.length, 3)
  assert.deepEqual(
    entries.map((entry) => ({
      id: entry.id,
      previewMode: entry.previewMode,
      previewPath: entry.previewPath,
      title: entry.previewTitle,
    })),
    [
      {
        id: 'artifact-pdf',
        previewMode: 'pdf',
        previewPath: '/tmp/paper.pdf',
        title: 'Translated Pdf',
      },
      {
        id: 'artifact-text',
        previewMode: 'text',
        previewPath: '/tmp/paper.pdf.zh-CN.translation.txt',
        title: 'Translated Text',
      },
      {
        id: 'artifact-html',
        previewMode: 'html',
        previewPath: '/tmp/translation.html',
        title: 'Translation Html',
      },
    ],
  )

  const taskEntries = buildExtensionTaskResultEntries({
    id: 'task-1',
    extensionId: 'example-pdf-extension',
    commandId: 'scribeflow.pdf.translate',
    target: {
      kind: 'pdf',
      referenceId: 'ref-123',
      path: '/tmp/paper.pdf',
    },
    settings: {
      'examplePdfExtension.targetLang': 'zh-CN',
    },
    logPath: '/tmp/extension-task.log',
    outputs: [
      {
        id: 'inline-summary',
        type: 'inlineText',
        mediaType: 'text/plain',
        title: 'Inline Summary',
        text: 'inline summary text',
      },
    ],
    artifacts: [
      {
        id: 'artifact-text',
        kind: 'translated-text',
        mediaType: 'text/plain',
        path: '/tmp/paper.pdf.zh-CN.translation.txt',
      },
    ],
  })

  assert.deepEqual(
    taskEntries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      previewMode: entry.previewMode,
      commandId: entry.commandId || '',
      previewTitle: entry.previewTitle || '',
    })),
    [
      {
        id: 'artifact-text',
        action: 'open',
        previewMode: 'text',
        commandId: '',
        previewTitle: 'Translated Text',
      },
      {
        id: 'inline-summary',
        action: 'open',
        previewMode: 'text',
        commandId: '',
        previewTitle: 'Inline Summary',
      },
      {
        id: 'task-1:log',
        action: 'open',
        previewMode: 'text',
        commandId: '',
        previewTitle: 'Task Log',
      },
      {
        id: 'task-1:rerun',
        action: 'execute-command',
        previewMode: undefined,
        commandId: 'scribeflow.pdf.translate',
        previewTitle: '',
      },
    ],
  )

  console.log(JSON.stringify({
    ok: true,
    entries,
    taskEntries,
  }, null, 2))
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error?.message || String(error),
  }, null, 2))
  process.exitCode = 1
})
