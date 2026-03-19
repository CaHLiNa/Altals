import { resolveApiAccess } from '../apiClient'
import { getThinkingConfig } from '../chatModels'
import { buildBaseSystemPrompt } from '../systemPrompt'
import { buildWorkspaceMeta } from '../workspaceMeta'
import { normalizeRuntimeId } from './runtimeAdapter'

export async function buildChatRuntimeConfig({ session, workspace } = {}) {
  const role = session?._ai?.role || 'general'
  const profile = session?._ai?.toolProfile || role
  const profileRuntime = workspace?.aiRuntime?.profileRuntimes?.[profile]
    || workspace?.aiRuntime?.profileRuntimes?.[role]
    || null
  const runtimeId = normalizeRuntimeId(
    session?._ai?.runtimeId ||
    profileRuntime ||
    workspace?.aiRuntime?.defaultRuntime,
  )

  const access = await resolveApiAccess({ modelId: session?.modelId }, workspace)
  const provider = access ? (access.providerHint || access.provider) : null
  const modelEntry = workspace?.modelsConfig?.models?.find((model) => model.id === session?.modelId)
  const thinkingConfig = access ? getThinkingConfig(access.model, provider, modelEntry?.thinking) : null

  let systemPrompt = buildBaseSystemPrompt(workspace)
  if (workspace?.systemPrompt) systemPrompt += '\n\n' + workspace.systemPrompt
  if (workspace?.instructions) systemPrompt += '\n\n' + workspace.instructions

  try {
    const meta = await buildWorkspaceMeta(workspace?.path)
    if (meta) systemPrompt += '\n\n' + meta
  } catch {}
  if (!access && runtimeId !== 'opencode') return null

  return {
    access,
    workspace,
    provider,
    thinkingConfig,
    systemPrompt,
    runtimeId,
    strictRuntime: session?._ai?.strictRuntime ?? !!workspace?.aiRuntime?.opencode?.strict,
    sessionLabel: session?.label || session?._ai?.label || 'AI',
    runtimeSessionId: session?._ai?.runtimeSessionId || null,
    opencodeEndpoint: workspace?.aiRuntime?.opencode?.endpoint || null,
    opencodeIdleDisposeMs: workspace?.aiRuntime?.opencode?.idleDisposeMs || null,
    toolRole: role,
    toolProfile: session?._ai?.toolProfile || null,
    allowedTools: session?._ai?.allowedTools || null,
  }
}
