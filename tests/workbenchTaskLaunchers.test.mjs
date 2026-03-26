import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildNotebookAssistantLaunchRequest,
  buildReferenceAuditLaunchRequest,
  buildReferenceCompareLaunchRequest,
  buildReferenceMaintenanceLaunchRequest,
} from '../src/services/ai/workbenchTaskLaunchers.js'

test('buildNotebookAssistantLaunchRequest keeps notebook launches beside the current pane', () => {
  const request = buildNotebookAssistantLaunchRequest({
    editorStore: { activePaneId: 'pane-2' },
    chatStore: { id: 'chat-store' },
    filePath: '/tmp/demo.ipynb',
    paneId: 'pane-9',
  })

  assert.equal(request.paneId, 'pane-9')
  assert.equal(request.beside, true)
  assert.equal(request.task.taskId, 'code.notebook-current')
  assert.equal(request.task.workflowTemplateId, 'code.notebook-assistant')
  assert.equal(request.task.source, 'notebook-toolbar')
  assert.equal(request.task.entryContext, 'notebook-toolbar')
  assert.equal(request.task.filePath, '/tmp/demo.ipynb')
})

test('buildReferenceMaintenanceLaunchRequest reuses the active pane when none is provided', () => {
  const request = buildReferenceMaintenanceLaunchRequest({
    editorStore: { activePaneId: 'pane-refs' },
    chatStore: { id: 'chat-store' },
    focusKeys: ['smith2024', 'chen2025'],
  })

  assert.equal(request.paneId, 'pane-refs')
  assert.equal(request.beside, true)
  assert.equal(request.task.taskId, 'citation.maintenance')
  assert.equal(request.task.source, 'reference-list')
  assert.equal(request.task.entryContext, 'reference-list')
  assert.match(request.task.prompt, /@smith2024/)
  assert.match(request.task.prompt, /@chen2025/)
})

test('buildReferenceCompareLaunchRequest keeps selected reference keys in compare prompts', () => {
  const request = buildReferenceCompareLaunchRequest({
    editorStore: { activePaneId: 'pane-refs' },
    chatStore: { id: 'chat-store' },
    refKeys: ['alpha2024', 'beta2023'],
    paneId: 'pane-side',
  })

  assert.equal(request.paneId, 'pane-side')
  assert.equal(request.beside, true)
  assert.equal(request.task.taskId, 'citation.compare')
  assert.equal(request.task.source, 'reference-list')
  assert.equal(request.task.entryContext, 'reference-list')
  assert.match(request.task.prompt, /@alpha2024/)
  assert.match(request.task.prompt, /@beta2023/)
})

test('buildReferenceAuditLaunchRequest keeps reference review launches on the named seam', () => {
  const request = buildReferenceAuditLaunchRequest({
    editorStore: { activePaneId: 'pane-ref-view' },
    chatStore: { id: 'chat-store' },
    refKey: 'wang2019',
  })

  assert.equal(request.paneId, 'pane-ref-view')
  assert.equal(request.beside, true)
  assert.equal(request.task.taskId, 'citation.reference-audit')
  assert.equal(request.task.source, 'reference-view')
  assert.equal(request.task.entryContext, 'reference-view')
  assert.match(request.task.prompt, /@wang2019/)
})
