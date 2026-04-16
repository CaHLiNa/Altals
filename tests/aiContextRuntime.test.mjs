import test from 'node:test'
import assert from 'node:assert/strict'

import { buildAiContextBundle, recommendAiSkills } from '../src/domains/ai/aiContextRuntime.js'
import {
  AI_AGENT_ACTION_DEFINITIONS,
  buildAgentContextSnapshot,
} from '../src/services/ai/skillRegistry.js'

test('buildAiContextBundle only keeps editor selection when it matches the active document', () => {
  const bundle = buildAiContextBundle({
    workspacePath: '/workspace',
    activeFile: '/workspace/paper.md',
    selection: {
      filePath: '/workspace/other.md',
      from: 4,
      to: 18,
      text: 'stale selection',
    },
    selectedReference: null,
  })

  assert.equal(bundle.document.available, true)
  assert.equal(bundle.selection.available, false)
  assert.equal(bundle.selection.text, '')
})

test('buildAiContextBundle ignores a persisted selected reference when reference context is inactive', () => {
  const bundle = buildAiContextBundle({
    workspacePath: '/workspace',
    activeFile: '/workspace/paper.md',
    selection: null,
    selectedReference: {
      id: 'ref-1',
      title: 'Attention Is All You Need',
      citationKey: 'vaswani2017',
      year: '2017',
      authors: ['Ashish Vaswani', 'Noam Shazeer'],
    },
    referenceActive: false,
  })

  assert.equal(bundle.document.available, true)
  assert.equal(bundle.reference.available, false)
  assert.equal(bundle.reference.title, '')
})

test('recommendAiSkills still exposes the workspace agent when document context exists', () => {
  const bundle = buildAiContextBundle({
    workspacePath: '/workspace',
    activeFile: '/workspace/paper.md',
    selection: {
      filePath: '/workspace/paper.md',
      from: 10,
      to: 42,
      text: 'Transformers remain under-motivated in this section.',
    },
    selectedReference: {
      id: 'ref-1',
      title: 'Attention Is All You Need',
      citationKey: 'vaswani2017',
      year: '2017',
      authors: ['Ashish Vaswani', 'Noam Shazeer'],
    },
  })

  const recommendations = recommendAiSkills(bundle, AI_AGENT_ACTION_DEFINITIONS)

  assert.equal(recommendations[0].id, 'workspace-agent')
  assert.equal(recommendations[0].available, true)
})

test('buildAgentContextSnapshot includes filesystem skill markdown and workspace context', () => {
  const bundle = buildAiContextBundle({
    workspacePath: '/workspace',
    activeFile: '/workspace/paper.md',
    selection: {
      filePath: '/workspace/paper.md',
      from: 10,
      to: 42,
      text: 'Transformers remain under-motivated in this section.',
    },
    selectedReference: {
      id: 'ref-1',
      title: 'Attention Is All You Need',
      citationKey: 'vaswani2017',
      year: '2017',
      authors: ['Ashish Vaswani', 'Noam Shazeer'],
    },
  })

  const snapshot = buildAgentContextSnapshot(
    {
      id: 'fs-skill:workspace:revise-with-citations',
      kind: 'filesystem-skill',
      name: 'revise-with-citations',
      slug: 'revise-with-citations',
      scope: 'workspace',
      skillFilePath: '/workspace/.altals/skills/revise-with-citations/SKILL.md',
      directoryPath: '/workspace/.altals/skills/revise-with-citations',
      supportingFiles: ['rubric.md'],
      markdown: '# Revise With Citations\n\nReturn JSON.',
    },
    bundle
  )

  assert.match(snapshot, /Skill: revise-with-citations/)
  assert.match(snapshot, /Transformers remain under-motivated/)
  assert.match(snapshot, /vaswani2017/)
  assert.match(snapshot, /rubric\.md/)
})

test('buildAgentContextSnapshot ignores filesystem skills outside Altals managed roots', () => {
  const bundle = buildAiContextBundle({
    workspacePath: '/workspace',
    activeFile: '/workspace/paper.md',
    selection: null,
    selectedReference: null,
  })

  const snapshot = buildAgentContextSnapshot(
    {
      id: 'fs-skill:user:academic-researcher',
      kind: 'filesystem-skill',
      name: 'academic-researcher',
      slug: 'academic-researcher',
      scope: 'user',
      source: 'codex-home',
      skillFilePath: '/Users/tester/.codex/skills/academic-researcher/SKILL.md',
      directoryPath: '/Users/tester/.codex/skills/academic-researcher',
      markdown: '# Academic Researcher\n\nExternal instructions.',
    },
    bundle
  )

  assert.equal(snapshot, '')
})
