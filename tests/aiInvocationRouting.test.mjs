import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyAiInvocationSuggestion,
  getAiInvocationSuggestions,
  inferAiSkillFromPrompt,
  parseAiInvocationInput,
  resolveAiInvocation,
} from '../src/services/ai/invocationRouting.js'

test('parseAiInvocationInput still parses legacy slash action aliases', () => {
  const parsed = parseAiInvocationInput('/grounded-chat Explain this section')

  assert.equal(parsed.prefix, '/')
  assert.equal(parsed.name, 'grounded-chat')
  assert.equal(parsed.remainder, 'Explain this section')
})

test('resolveAiInvocation still routes $skill to Altals skills in manual chat-style flows', () => {
  const resolved = resolveAiInvocation({
    prompt: '$revise-with-citations tighten this paragraph',
    mode: 'chat',
    activeSkill: { id: 'workspace-agent' },
    builtInActions: [{ id: 'workspace-agent' }],
    altalsSkills: [
      {
        id: 'fs-1',
        slug: 'revise-with-citations',
        name: 'revise-with-citations',
        source: 'altals-workspace',
        kind: 'filesystem-skill',
        directoryPath: '/workspace/.altals/skills/revise-with-citations',
      },
    ],
  })

  assert.equal(resolved.resolvedSkill.id, 'fs-1')
  assert.equal(resolved.userInstruction, 'tighten this paragraph')
})

test('resolveAiInvocation ignores filesystem skills outside Altals managed roots', () => {
  const resolved = resolveAiInvocation({
    prompt: '$academic-researcher analyze this section',
    mode: 'chat',
    activeSkill: { id: 'workspace-agent' },
    builtInActions: [{ id: 'workspace-agent' }],
    altalsSkills: [
      {
        id: 'fs-1',
        slug: 'academic-researcher',
        name: 'academic-researcher',
        source: 'codex-home',
        kind: 'filesystem-skill',
        directoryPath: '/Users/tester/.codex/skills/academic-researcher',
      },
    ],
    contextBundle: {
      workspace: { available: true },
    },
  })

  assert.equal(resolved.resolvedSkill.id, 'workspace-agent')
  assert.equal(resolved.userInstruction, '$academic-researcher analyze this section')
})

test('resolveAiInvocation allows explicit skill invocation in agent mode', () => {
  const resolved = resolveAiInvocation({
    prompt: '$revise-with-citations tighten this paragraph',
    mode: 'agent',
    activeSkill: { id: 'workspace-agent' },
    builtInActions: [{ id: 'workspace-agent' }],
    altalsSkills: [
      {
        id: 'fs-1',
        slug: 'revise-with-citations',
        name: 'revise-with-citations',
        source: 'altals-workspace',
        kind: 'filesystem-skill',
        directoryPath: '/workspace/.altals/skills/revise-with-citations',
      },
    ],
    contextBundle: {
      workspace: { available: true },
    },
  })

  assert.equal(resolved.resolvedSkill.id, 'fs-1')
  assert.equal(resolved.userInstruction, 'tighten this paragraph')
})

test('inferAiSkillFromPrompt auto-routes to a matching skill when the prompt and context fit', () => {
  const resolvedSkill = inferAiSkillFromPrompt({
    prompt: 'Please revise this paragraph and add the right citation.',
    builtInActions: [{ id: 'workspace-agent' }],
    altalsSkills: [
      {
        id: 'fs-1',
        slug: 'revise-with-citations',
        name: 'revise-with-citations',
        source: 'altals-workspace',
        kind: 'filesystem-skill',
        directoryPath: '/workspace/.altals/skills/revise-with-citations',
        description:
          'Revise the selected passage while staying grounded in the selected reference.',
      },
    ],
    contextBundle: {
      workspace: { available: true },
      selection: { available: true },
      reference: { available: true },
    },
  })

  assert.equal(resolvedSkill.id, 'fs-1')
})

test('inferAiSkillFromPrompt falls back to workspace agent when no skill is a strong match', () => {
  const resolvedSkill = inferAiSkillFromPrompt({
    prompt: 'Inspect the workspace and explain the current project structure.',
    builtInActions: [{ id: 'workspace-agent' }],
    altalsSkills: [
      {
        id: 'fs-1',
        slug: 'revise-with-citations',
        name: 'revise-with-citations',
        source: 'altals-workspace',
        kind: 'filesystem-skill',
        directoryPath: '/workspace/.altals/skills/revise-with-citations',
        description:
          'Revise the selected passage while staying grounded in the selected reference.',
      },
    ],
    contextBundle: {
      workspace: { available: true },
    },
  })

  assert.equal(resolvedSkill.id, 'workspace-agent')
})

test('getAiInvocationSuggestions returns unified slash completions and dollar skill completions', () => {
  const slashSuggestions = getAiInvocationSuggestions({
    prompt: '/re',
    builtInActions: [
      { id: 'workspace-agent', titleKey: 'Workspace agent', descriptionKey: 'desc' },
    ],
    altalsSkills: [
      {
        id: 'fs-1',
        slug: 'revise-with-citations',
        name: 'revise-with-citations',
        description: 'desc',
        source: 'altals-workspace',
        kind: 'filesystem-skill',
        directoryPath: '/workspace/.altals/skills/revise-with-citations',
      },
    ],
    recentSkillIds: ['fs-1'],
  })
  const skillSuggestions = getAiInvocationSuggestions({
    prompt: '$revi',
    builtInActions: [],
    altalsSkills: [
      {
        id: 'fs-1',
        slug: 'revise-with-citations',
        name: 'revise-with-citations',
        description: 'desc',
        source: 'altals-workspace',
        kind: 'filesystem-skill',
        directoryPath: '/workspace/.altals/skills/revise-with-citations',
      },
    ],
    recentSkillIds: ['fs-1'],
  })

  assert.equal(slashSuggestions[0].insertText, '/revise-with-citations ')
  assert.equal(slashSuggestions[0].groupKey, 'recent-skills')
  assert.equal(skillSuggestions[0].insertText, '$revise-with-citations ')
  assert.equal(skillSuggestions[0].groupKey, 'recent-skills')
})

test('getAiInvocationSuggestions hides skills outside Altals managed roots', () => {
  const suggestions = getAiInvocationSuggestions({
    prompt: '$acad',
    builtInActions: [],
    altalsSkills: [
      {
        id: 'fs-1',
        slug: 'academic-researcher',
        name: 'academic-researcher',
        description: 'desc',
        source: 'codex-home',
        kind: 'filesystem-skill',
        directoryPath: '/Users/tester/.codex/skills/academic-researcher',
      },
    ],
    recentSkillIds: ['fs-1'],
  })

  assert.equal(suggestions.length, 0)
})

test('applyAiInvocationSuggestion replaces the current invocation token', () => {
  const updated = applyAiInvocationSuggestion('/wor explain this', {
    insertText: '/workspace-agent ',
  })

  assert.equal(updated, '/workspace-agent explain this')
})

test('resolveAiInvocation maps legacy grounded-chat alias onto workspace agent', () => {
  const resolved = resolveAiInvocation({
    prompt: '/grounded-chat inspect the current workspace',
    mode: 'agent',
    activeSkill: { id: 'workspace-agent' },
    builtInActions: [{ id: 'workspace-agent' }],
    altalsSkills: [],
    contextBundle: {
      workspace: { available: true },
    },
  })

  assert.equal(resolved.resolvedSkill.id, 'workspace-agent')
  assert.equal(resolved.userInstruction, 'inspect the current workspace')
})
