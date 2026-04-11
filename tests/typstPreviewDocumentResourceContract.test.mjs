import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const previewDocumentSource = readFileSync(
  new URL('../src/services/typst/previewDocument.js', import.meta.url),
  'utf8',
)

const tauriLibSource = readFileSync(
  new URL('../src-tauri/src/lib.rs', import.meta.url),
  'utf8',
)

test('typst preview document html is loaded from Tinymist LSP resources instead of the static preview homepage fetch command', () => {
  assert.match(previewDocumentSource, /requestTinymistExecuteCommand\(\s*'tinymist\.getResources'/)
  assert.doesNotMatch(previewDocumentSource, /typst_preview_fetch_document/)
  assert.doesNotMatch(tauriLibSource, /tinymist::typst_preview_fetch_document/)
})
