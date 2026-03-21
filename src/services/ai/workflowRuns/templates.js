const WORKFLOW_TEMPLATE_LIST = [
  {
    id: 'draft.review-revise',
    label: 'Review and revise draft',
    role: 'reviewer',
    toolProfile: 'reviewer',
    autoAdvanceUntil: 'generate_patch',
    approvalTypes: ['apply_patch'],
    steps: [
      {
        kind: 'read_context',
        label: 'Read context',
        description: 'Read the current draft, active comments, and nearby workspace context.',
      },
      {
        kind: 'analyze_goal',
        label: 'Analyze goal',
        description: 'Identify the document type and the revision goal.',
      },
      {
        kind: 'generate_review',
        label: 'Generate review',
        description: 'Produce a structured review artifact with concrete issues.',
      },
      {
        kind: 'generate_patch',
        label: 'Generate patch',
        description: 'Draft direct edits for issues that can be fixed safely.',
      },
      {
        kind: 'await_patch_decision',
        label: 'Await patch decision',
        description: 'Pause before applying edits and wait for user approval.',
        requiresApproval: true,
        approvalType: 'apply_patch',
      },
      {
        kind: 'summarize_outcome',
        label: 'Summarize outcome',
        description: 'Summarize changes and any remaining issues after edits land.',
      },
    ],
  },
  {
    id: 'references.search-intake',
    label: 'Search and intake references',
    role: 'citation_librarian',
    toolProfile: 'citation_librarian',
    autoAdvanceUntil: 'generate_citation_set',
    approvalTypes: ['accept_sources'],
    steps: [
      {
        kind: 'read_context',
        label: 'Read context',
        description: 'Read the target claim, draft, and existing reference context.',
      },
      {
        kind: 'analyze_goal',
        label: 'Analyze goal',
        description: 'Identify the evidence need and the target research question.',
      },
      {
        kind: 'search_local_references',
        label: 'Search local references',
        description: 'Check the local references library first.',
      },
      {
        kind: 'search_external_sources',
        label: 'Search external sources',
        description: 'Expand to external search only if local references are insufficient.',
      },
      {
        kind: 'generate_citation_set',
        label: 'Generate citation set',
        description: 'Build a ranked proposal with source fit reasoning.',
      },
      {
        kind: 'await_source_decision',
        label: 'Await source decision',
        description: 'Pause before importing sources and wait for user approval.',
        requiresApproval: true,
        approvalType: 'accept_sources',
      },
      {
        kind: 'summarize_outcome',
        label: 'Summarize outcome',
        description: 'Summarize accepted sources and the remaining evidence gaps.',
      },
    ],
  },
  {
    id: 'code.debug-current',
    label: 'Debug current code',
    role: 'code_assistant',
    toolProfile: 'code_assistant',
    autoAdvanceUntil: 'generate_fix_suggestions',
    approvalTypes: [],
    steps: [
      {
        kind: 'read_context',
        label: 'Read context',
        description: 'Read the current file, error message, and recent workspace context.',
      },
      {
        kind: 'analyze_goal',
        label: 'Analyze goal',
        description: 'Extract the task goal and the expected behavior.',
      },
      {
        kind: 'diagnose_issue',
        label: 'Diagnose issue',
        description: 'Form the most likely failure hypotheses.',
      },
      {
        kind: 'generate_fix_suggestions',
        label: 'Generate fix suggestions',
        description: 'Suggest fixes without directly modifying files by default.',
      },
      {
        kind: 'summarize_outcome',
        label: 'Summarize outcome',
        description: 'Summarize the issue, suggestions, and any verification steps.',
      },
    ],
  },
]

export const WORKFLOW_TEMPLATE_IDS = WORKFLOW_TEMPLATE_LIST.map((template) => template.id)

export const WORKFLOW_TEMPLATES = WORKFLOW_TEMPLATE_LIST.map((template) => ({
  ...template,
  steps: template.steps.map((step) => ({ ...step })),
  approvalTypes: [...template.approvalTypes],
}))

export function getWorkflowTemplate(templateId) {
  const id = String(templateId || '').trim()
  const template = WORKFLOW_TEMPLATES.find((item) => item.id === id)
  if (!template) {
    throw new Error(`Unknown workflow template: ${id || '(empty)'}`)
  }
  return {
    ...template,
    steps: template.steps.map((step) => ({ ...step })),
    approvalTypes: [...template.approvalTypes],
  }
}
