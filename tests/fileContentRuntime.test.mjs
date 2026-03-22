import test from 'node:test'
import assert from 'node:assert/strict'

import { createFileContentRuntime } from '../src/domains/files/fileContentRuntime.js'

test('file content runtime coalesces pdf source detection and caches the detected kind', async () => {
  const pdfSourceKinds = {}
  let detectCalls = 0
  let releaseDetect
  const detectPromise = new Promise((resolve) => {
    releaseDetect = resolve
  })

  const runtime = createFileContentRuntime({
    getPdfSourceState: (path) => pdfSourceKinds[path] || null,
    setPdfSourceState: (path, state) => {
      pdfSourceKinds[path] = state
    },
    clearPdfSourceState: (path) => {
      delete pdfSourceKinds[path]
    },
    detectPdfSourceKind: async () => {
      detectCalls += 1
      await detectPromise
      return 'latex'
    },
  })

  const first = runtime.ensurePdfSourceKind('/ws/output.pdf')
  const second = runtime.ensurePdfSourceKind('/ws/output.pdf')
  releaseDetect()

  assert.equal(await first, 'latex')
  assert.equal(await second, 'latex')
  assert.equal(detectCalls, 1)
  assert.deepEqual(pdfSourceKinds['/ws/output.pdf'], {
    status: 'ready',
    kind: 'latex',
  })
})

test('file content runtime invalidates matching pdf source entries for source files and reloads pdf viewers', async () => {
  const pdfSourceKinds = {
    '/ws/output.pdf': { status: 'ready', kind: 'latex' },
  }
  const updatedPaths = []

  const runtime = createFileContentRuntime({
    getPdfSourceState: (path) => pdfSourceKinds[path] || null,
    setPdfSourceState: (path, state) => {
      pdfSourceKinds[path] = state
    },
    clearPdfSourceState: (path) => {
      delete pdfSourceKinds[path]
    },
    notifyPdfUpdated: (path) => {
      updatedPaths.push(path)
    },
  })

  runtime.invalidatePdfSourceForPath('/ws/output.tex')
  assert.equal(pdfSourceKinds['/ws/output.pdf'], undefined)

  await runtime.reloadFile('/ws/output.pdf')
  assert.deepEqual(updatedPaths, ['/ws/output.pdf'])
})

test('file content runtime reads pdf and text files into cache and records text read failures', async () => {
  const fileContents = {}
  const fileLoadErrors = {}
  const pdfReadErrors = []

  const runtime = createFileContentRuntime({
    readTextFile: async (path) => {
      if (path === '/ws/doc.md') throw new Error('boom')
      return 'ignored'
    },
    extractPdfText: async () => 'pdf text',
    isBinaryPath: (path) => path.endsWith('.png'),
    setFileContent: (path, content) => {
      fileContents[path] = content
    },
    clearFileLoadError: (path) => {
      delete fileLoadErrors[path]
    },
    setFileLoadError: (path, error) => {
      fileLoadErrors[path] = error.message
    },
    onPdfReadError: (path, error) => {
      pdfReadErrors.push({ path, message: error.message })
    },
  })

  assert.equal(await runtime.readFile('/ws/output.pdf'), 'pdf text')
  assert.equal(fileContents['/ws/output.pdf'], 'pdf text')
  assert.equal(await runtime.readFile('/ws/image.png'), null)
  assert.equal(await runtime.readFile('/ws/doc.md'), null)
  assert.equal(fileLoadErrors['/ws/doc.md'], 'boom')
  assert.deepEqual(pdfReadErrors, [])
})

test('file content runtime saves content, clears read errors, and reports save failures through the callback', async () => {
  const fileContents = {}
  const fileLoadErrors = {
    '/ws/doc.md': 'old error',
  }
  const savedPaths = []
  const saveErrors = []
  let shouldFail = false

  const runtime = createFileContentRuntime({
    saveTextFile: async () => {
      if (shouldFail) throw new Error('write failed')
    },
    setFileContent: (path, content) => {
      fileContents[path] = content
    },
    clearFileLoadError: (path) => {
      delete fileLoadErrors[path]
    },
    syncSavedMarkdownLinks: (path) => {
      savedPaths.push(path)
    },
    onSaveError: (path, error) => {
      saveErrors.push({ path, message: error.message })
    },
  })

  assert.equal(await runtime.saveFile('/ws/doc.md', '# draft'), true)
  assert.equal(fileContents['/ws/doc.md'], '# draft')
  assert.equal(fileLoadErrors['/ws/doc.md'], undefined)
  assert.deepEqual(savedPaths, ['/ws/doc.md'])

  shouldFail = true
  assert.equal(await runtime.saveFile('/ws/doc.md', '# retry'), false)
  assert.deepEqual(saveErrors, [{
    path: '/ws/doc.md',
    message: 'write failed',
  }])
})
