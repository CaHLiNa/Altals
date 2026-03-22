import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspaceSettingsRuntime } from '../src/domains/workspace/workspaceSettingsRuntime.js'

function createState() {
  return {
    shouldersDir: '/workspace/.altals',
    globalConfigDir: '/Users/test/.altals',
    projectDir: '/workspace/.altals/project',
    instructionsPaths: {
      rootPath: '/workspace/_instructions.md',
      internalPath: '/workspace/.altals/project/instructions.md',
    },
    apiKeys: {},
    apiKey: '',
    modelsConfig: null,
    aiRuntime: null,
    disabledTools: [],
    skillsManifest: null,
    systemPrompt: '',
    instructions: '',
  }
}

function createRuntime(state, overrides = {}) {
  return createWorkspaceSettingsRuntime({
    getShouldersDir: () => state.shouldersDir,
    getGlobalConfigDir: () => state.globalConfigDir,
    getProjectDir: () => state.projectDir,
    getInstructionsPaths: () => state.instructionsPaths,
    getApiKeys: () => state.apiKeys,
    getModelsConfig: () => state.modelsConfig,
    getDisabledTools: () => state.disabledTools,
    setSystemPrompt: (value) => {
      state.systemPrompt = value
    },
    setInstructions: (value) => {
      state.instructions = value
    },
    setApiKeys: (value) => {
      state.apiKeys = value
    },
    setApiKey: (value) => {
      state.apiKey = value
    },
    setModelsConfig: (value) => {
      state.modelsConfig = value
    },
    setAiRuntime: (value) => {
      state.aiRuntime = value
    },
    setDisabledTools: (value) => {
      state.disabledTools = value
    },
    setSkillsManifest: (value) => {
      state.skillsManifest = value
    },
    ...overrides,
  })
}

test('workspace settings runtime loads prompt, instructions, keys, permissions, and skills', async () => {
  const state = createState()
  const runtime = createRuntime(state, {
    loadSystemPrompt: async () => 'system prompt',
    loadWorkspaceInstructions: async () => 'workspace instructions',
    loadWorkspaceGlobalKeys: async () => ({}),
    migrateWorkspaceEnvKeys: async () => ({
      ANTHROPIC_API_KEY: 'anthropic-key',
      OPENAI_API_KEY: 'openai-key',
    }),
    loadWorkspaceModelsConfig: async () => ({ providers: ['anthropic'] }),
    loadAiRuntimeConfig: async () => ({ mode: 'workspace' }),
    loadWorkspaceToolPermissions: async () => ['terminal'],
    loadWorkspaceSkillsManifest: async () => [{ name: 'writer' }],
  })

  assert.deepEqual(await runtime.loadSettings(), {
    apiKeys: {
      ANTHROPIC_API_KEY: 'anthropic-key',
      OPENAI_API_KEY: 'openai-key',
    },
    modelsConfig: { providers: ['anthropic'] },
  })
  assert.equal(state.systemPrompt, 'system prompt')
  assert.equal(state.instructions, 'workspace instructions')
  assert.deepEqual(state.apiKeys, {
    ANTHROPIC_API_KEY: 'anthropic-key',
    OPENAI_API_KEY: 'openai-key',
  })
  assert.equal(state.apiKey, 'anthropic-key')
  assert.deepEqual(state.modelsConfig, { providers: ['anthropic'] })
  assert.deepEqual(state.aiRuntime, { mode: 'workspace' })
  assert.deepEqual(state.disabledTools, ['terminal'])
  assert.deepEqual(state.skillsManifest, [{ name: 'writer' }])
})

test('workspace settings runtime syncs provider models after lazily loading settings', async () => {
  const state = createState()
  const calls = []
  const runtime = createRuntime(state, {
    loadSystemPrompt: async () => {
      calls.push('prompt')
      return 'system prompt'
    },
    loadWorkspaceInstructions: async () => {
      calls.push('instructions')
      return 'workspace instructions'
    },
    loadWorkspaceGlobalKeys: async () => {
      calls.push('keys')
      return {
        ANTHROPIC_API_KEY: 'anthropic-key',
      }
    },
    migrateWorkspaceEnvKeys: async () => {
      calls.push('migrate')
      return {}
    },
    loadWorkspaceModelsConfig: async () => {
      calls.push('models')
      return { providers: ['anthropic'] }
    },
    loadAiRuntimeConfig: async () => {
      calls.push('runtime')
      return { mode: 'workspace' }
    },
    loadWorkspaceToolPermissions: async () => {
      calls.push('permissions')
      return ['terminal']
    },
    loadWorkspaceSkillsManifest: async () => {
      calls.push('skills')
      return [{ name: 'writer' }]
    },
    syncWorkspaceProviderModels: async (options) => {
      calls.push(['sync', options])
      return {
        config: { providers: ['anthropic', 'openai'] },
        addedCount: 1,
        syncedProviders: ['openai'],
        failedProviders: [],
      }
    },
    getDefaultModelsConfig: () => ({ providers: ['default'] }),
  })

  assert.deepEqual(await runtime.syncProviderModels({ providerIds: ['openai'] }), {
    addedCount: 1,
    syncedProviders: ['openai'],
    failedProviders: [],
  })
  assert.deepEqual(state.modelsConfig, { providers: ['anthropic', 'openai'] })
  assert.deepEqual(calls, [
    'prompt',
    'instructions',
    'keys',
    'models',
    'runtime',
    'permissions',
    'skills',
    ['sync', {
      globalConfigDir: '/Users/test/.altals',
      shouldersDir: '/workspace/.altals',
      modelsConfig: { providers: ['anthropic'] },
      apiKeys: { ANTHROPIC_API_KEY: 'anthropic-key' },
      providerIds: ['openai'],
    }],
  ])
})

test('workspace settings runtime handles instruction migration, file opening, key persistence, and tool permission persistence', async () => {
  const state = createState()
  state.disabledTools = ['terminal', 'shell']
  const opened = []
  const savedKeys = []
  const savedPermissions = []
  const migrationErrors = []

  const runtime = createRuntime(state, {
    migrateWorkspaceInstructionsFile: async () => {
      throw new Error('legacy copy failed')
    },
    resolveInstructionsFileToOpen: async () => state.instructionsPaths.internalPath,
    openWorkspaceFileInEditor: (path) => {
      opened.push(path)
    },
    saveWorkspaceGlobalKeys: async (globalConfigDir, keys) => {
      savedKeys.push({ globalConfigDir, keys })
    },
    saveWorkspaceToolPermissions: async (payload) => {
      savedPermissions.push(payload)
    },
    onInstructionsMigrationError: (error) => {
      migrationErrors.push(error.message)
    },
  })

  await runtime.migrateAutoInstructionsFile()
  assert.deepEqual(migrationErrors, ['legacy copy failed'])

  assert.equal(
    await runtime.openInstructionsFile(),
    '/workspace/.altals/project/instructions.md',
  )
  assert.deepEqual(opened, ['/workspace/.altals/project/instructions.md'])

  await runtime.saveGlobalKeys({ ANTHROPIC_API_KEY: 'new-key' })
  assert.deepEqual(savedKeys, [{
    globalConfigDir: '/Users/test/.altals',
    keys: { ANTHROPIC_API_KEY: 'new-key' },
  }])

  await runtime.saveToolPermissions()
  assert.deepEqual(savedPermissions, [{
    globalConfigDir: '/Users/test/.altals',
    disabledTools: ['terminal', 'shell'],
  }])
})
