import { normalizeAiArtifact } from '../../domains/ai/aiArtifactRuntime.js'
import { invoke } from '@tauri-apps/api/core'
import { getAiSkillBehaviorId, getAiSkillById } from './skillRegistry.js'
import { isAltalsManagedFilesystemSkill } from './skillDiscovery.js'
import { loadSkillSupportingFiles } from './skillSupportFiles.js'
import { resolveRuntimeAiToolIds } from './toolRegistry.js'

export async function executeAiAgentEntry({
  skillId = '',
  skill = null,
  contextBundle = {},
  config = {},
  apiKey = '',
  userInstruction = '',
  conversation = [],
  altalsSkills = [],
  attachments = [],
  referencedFiles = [],
  requestedTools = [],
  runtimeIntent = 'chat',
  toolRuntime = {},
  onEvent,
  signal,
} = {}) {
  const resolvedSkill = skill || getAiSkillById(skillId, altalsSkills)
  if (!resolvedSkill) {
    throw new Error('AI skill is not available.')
  }
  if (resolvedSkill.kind === 'filesystem-skill' && !isAltalsManagedFilesystemSkill(resolvedSkill)) {
    throw new Error('AI skill is not available.')
  }

  const enabledToolIds = resolveRuntimeAiToolIds(config?.enabledTools, { runtimeIntent })
  const enabledToolSet = new Set(enabledToolIds)
  const promptSkill = {
    ...resolvedSkill,
    enabledToolIds,
  }

  let supportFiles = []
  if (resolvedSkill.kind === 'filesystem-skill' && enabledToolSet.has('load-skill-support-files')) {
    supportFiles = await loadSkillSupportingFiles(resolvedSkill)
  }

  const promptResponse = await invoke('ai_agent_build_prompt', {
    params: {
      skill: promptSkill,
      contextBundle,
      userInstruction,
      conversation,
      altalsSkills,
      supportFiles,
      attachments,
      referencedFiles,
      requestedTools,
      enabledToolIds,
      runtimeIntent,
    },
  })
  const behaviorId = String(promptResponse?.behaviorId || getAiSkillBehaviorId(resolvedSkill, skillId))
  const systemPrompt = String(promptResponse?.systemPrompt || '')
  const userPrompt = String(promptResponse?.userPrompt || '')

  const { content, payload, events, transport } = await invoke('ai_agent_execute', {
    params: {
      providerId: config.providerId || 'openai',
      config,
      apiKey,
      conversation,
      userPrompt,
      systemPrompt,
      contextBundle,
      supportFiles,
      enabledToolIds,
      workspacePath: String(contextBundle?.workspace?.path || '').trim(),
    },
  })

  for (const event of Array.isArray(events) ? events : []) {
    onEvent?.(event, Array.isArray(events) ? events : [])
  }

  const artifact = normalizeAiArtifact(behaviorId, payload, contextBundle, content)

  return {
    skill: resolvedSkill,
    behaviorId,
    supportFiles,
    events,
    transport,
    content,
    payload,
    artifact,
  }
}

export async function executeAiSkill(options = {}) {
  return executeAiAgentEntry(options)
}
