import { isAiContextAvailable } from '../../domains/ai/aiContextRuntime.js'
import { t } from '../../i18n/index.js'
import {
  DEFAULT_AGENT_ACTION_ID,
  isDefaultAgentActionId,
  normalizeBuiltInAiActionId,
} from './builtInActions.js'
import { isAltalsManagedFilesystemSkill } from './skillDiscovery.js'

export const AI_AGENT_ACTION_DEFINITIONS = [
  {
    id: DEFAULT_AGENT_ACTION_ID,
    kind: 'built-in-action',
    titleKey: 'Workspace agent',
    descriptionKey:
      'Ask the agent to inspect the current workspace, use tools, and continue the task in context.',
    requiredContext: ['workspace'],
  },
]

export const AI_BUILT_IN_ACTION_DEFINITIONS = AI_AGENT_ACTION_DEFINITIONS
export const AI_SKILL_DEFINITIONS = AI_AGENT_ACTION_DEFINITIONS

const REQUIRED_CONTEXT_LABELS = {
  document: 'active document',
  selection: 'selected text',
  reference: 'selected reference',
}

function getDisplayTitle(entry = {}) {
  return String(entry.titleKey || entry.name || entry.id || '').trim()
}

function getDocumentBlock(contextBundle = {}) {
  if (!contextBundle.document?.available) return `- ${t('Active document')}: ${t('Unavailable')}`
  return `- ${t('Active document')}: ${contextBundle.document.filePath}`
}

function getWorkspaceBlock(contextBundle = {}) {
  if (!contextBundle.workspace?.available) return `- ${t('Folder')}: ${t('Unavailable')}`
  return `- ${t('Folder')}: ${contextBundle.workspace.path}`
}

function getSelectionBlock(contextBundle = {}) {
  if (!contextBundle.selection?.available) return `- ${t('Selected text')}: ${t('Unavailable')}`
  return [`- ${t('Selected text')}:`, '```text', contextBundle.selection.text, '```'].join('\n')
}

function getReferenceBlock(contextBundle = {}) {
  if (!contextBundle.reference?.available)
    return `- ${t('Selected reference')}: ${t('Unavailable')}`

  const parts = [
    `- ${t('Selected reference title')}: ${contextBundle.reference.title || t('Untitled reference')}`,
  ]
  if (contextBundle.reference.citationKey) {
    parts.push(`- ${t('Citation key')}: ${contextBundle.reference.citationKey}`)
  }
  if (contextBundle.reference.year) {
    parts.push(`- ${t('Year')}: ${contextBundle.reference.year}`)
  }
  if (contextBundle.reference.authorLine) {
    parts.push(`- ${t('Author line')}: ${contextBundle.reference.authorLine}`)
  }
  return parts.join('\n')
}

function buildMissingContextBlock(entry = {}, contextBundle = {}) {
  const requiredContext = Array.isArray(entry.requiredContext) ? entry.requiredContext : []
  const missing = requiredContext.filter((kind) => !isAiContextAvailable(kind, contextBundle))
  if (missing.length === 0) return ''

  return [
    `${t('Action')}: ${getDisplayTitle(entry)}`,
    '',
    t('This action is missing required workspace context.'),
    t('Missing context:'),
    ...missing.map((kind) => `- ${t(REQUIRED_CONTEXT_LABELS[kind] || kind)}`),
  ].join('\n')
}

const BUILT_IN_BRIEF_BUILDERS = {
  [DEFAULT_AGENT_ACTION_ID]: (contextBundle) =>
    [
      `${t('Task')}: ${t('Use the current workspace as your working context and continue the user task directly.')}`,
      '',
      `${t('Workspace context')}:`,
      getWorkspaceBlock(contextBundle),
      getDocumentBlock(contextBundle),
      contextBundle.selection.available
        ? getSelectionBlock(contextBundle)
        : `- ${t('Selected text')}: ${t('Unavailable')}`,
      contextBundle.reference.available
        ? getReferenceBlock(contextBundle)
        : `- ${t('Selected reference')}: ${t('Unavailable')}`,
      '',
      `${t('Operating rules')}:`,
      `- ${t('Inspect the available workspace context before making claims about project state.')}`,
      `- ${t('Prefer direct action and tool use over repeating the workflow back to the user.')}`,
      `- ${t('Make uncertainty explicit instead of inventing file state, evidence, or citations.')}`,
    ].join('\n'),
}

export function getAiSkillBehaviorId(entry = null, fallbackSkillId = '') {
  if (!entry) return String(fallbackSkillId || '').trim()
  if (entry.kind === 'filesystem-skill') {
    return String(entry.slug || entry.name || fallbackSkillId || '').trim()
  }
  return String(entry.id || fallbackSkillId || '').trim()
}

function buildFilesystemSkillBrief(skill = {}, contextBundle = {}) {
  return [
    `${t('Skill')}: ${skill.name || skill.slug || t('Unnamed skill')}`,
    `${t('Type')}: ${t('Filesystem skill')}`,
    `${t('Source path')}: ${skill.skillFilePath || skill.directoryPath || t('unknown')}`,
    `${t('Scope')}: ${skill.scope === 'user' ? t('User scope') : t('Workspace scope')}`,
    skill.supportingFiles?.length
      ? `${t('Supporting files in skill directory')}: ${skill.supportingFiles.join(', ')}`
      : `${t('Supporting files in skill directory')}: ${t('None discovered')}`,
    '',
    `${t('Workspace context')}:`,
    getWorkspaceBlock(contextBundle),
    getDocumentBlock(contextBundle),
    getSelectionBlock(contextBundle),
    getReferenceBlock(contextBundle),
    '',
    `${t('Skill instructions (from SKILL.md)')}:`,
    '```md',
    String(skill.markdown || '').trim(),
    '```',
    '',
    `${t('Requirements')}:`,
    `- ${t('Treat the skill instructions as the active instruction pack.')}`,
    `- ${t('Stay close to the supplied Altals workspace context.')}`,
    `- ${t('If the skill expects tools or files not yet available, say so explicitly instead of inventing them.')}`,
  ].join('\n')
}

export function getBuiltInAiActionById(actionId = '') {
  const normalizedActionId = normalizeBuiltInAiActionId(actionId)
  return AI_AGENT_ACTION_DEFINITIONS.find((action) => action.id === normalizedActionId) || null
}

export function getAiSkillById(skillId = '', altalsSkills = []) {
  return (
    getBuiltInAiActionById(skillId) ||
    (Array.isArray(altalsSkills)
      ? altalsSkills.find(
          (skill) => skill.id === skillId && isAltalsManagedFilesystemSkill(skill)
        ) || null
      : null)
  )
}

export function buildAgentContextSnapshot(skillOrId = '', contextBundle = {}, options = {}) {
  const altalsSkills = Array.isArray(options.altalsSkills) ? options.altalsSkills : []
  const entry = typeof skillOrId === 'string' ? getAiSkillById(skillOrId, altalsSkills) : skillOrId

  if (!entry) return ''

  if (entry.kind === 'filesystem-skill') {
    if (!isAltalsManagedFilesystemSkill(entry)) return ''
    return buildFilesystemSkillBrief(entry, contextBundle)
  }

  const normalizedEntry = isDefaultAgentActionId(entry.id)
    ? {
        ...entry,
        id: DEFAULT_AGENT_ACTION_ID,
      }
    : entry
  const missingContextBlock = buildMissingContextBlock(entry, contextBundle)
  if (missingContextBlock) return missingContextBlock

  const builder = BUILT_IN_BRIEF_BUILDERS[normalizedEntry.id]
  return typeof builder === 'function' ? builder(contextBundle) : ''
}

export function buildPreparedAiBrief(skillOrId = '', contextBundle = {}, options = {}) {
  return buildAgentContextSnapshot(skillOrId, contextBundle, options)
}
