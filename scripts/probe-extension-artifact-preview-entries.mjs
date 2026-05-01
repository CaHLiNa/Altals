import assert from 'node:assert/strict'
import {
  buildExtensionArtifactPreviewEntries,
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

  console.log(JSON.stringify({
    ok: true,
    entries,
  }, null, 2))
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error?.message || String(error),
  }, null, 2))
  process.exitCode = 1
})
