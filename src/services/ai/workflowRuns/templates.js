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
  {
    id: 'code.notebook-assistant',
    label: 'Inspect current notebook',
    role: 'code_assistant',
    toolProfile: 'code_assistant',
    autoAdvanceUntil: 'generate_notebook_plan',
    approvalTypes: ['apply_notebook_edits'],
    steps: [
      {
        kind: 'read_context',
        label: 'Read context',
        description: 'Read the current notebook, active selection, and nearby workspace context.',
      },
      {
        kind: 'analyze_goal',
        label: 'Analyze goal',
        description: 'Identify the notebook task, uncertainty, or debugging target.',
      },
      {
        kind: 'inspect_notebook_cells',
        label: 'Inspect notebook cells',
        description: 'Inspect notebook cells, outputs, and execution order.',
      },
      {
        kind: 'generate_notebook_plan',
        label: 'Generate notebook plan',
        description: 'Prepare concrete notebook analysis or edit suggestions.',
      },
      {
        kind: 'await_notebook_edit_decision',
        label: 'Await notebook edit decision',
        description: 'Pause before applying notebook edits and wait for approval.',
        requiresApproval: true,
        approvalType: 'apply_notebook_edits',
      },
      {
        kind: 'summarize_outcome',
        label: 'Summarize outcome',
        description: 'Summarize the notebook findings, suggested edits, and next checks.',
      },
    ],
  },
  {
    id: 'references.maintenance',
    label: 'Maintain references',
    role: 'citation_librarian',
    toolProfile: 'citation_librarian',
    autoAdvanceUntil: 'generate_reference_actions',
    approvalTypes: ['apply_reference_changes'],
    steps: [
      {
        kind: 'read_context',
        label: 'Read context',
        description: 'Read the current library focus, selection, and workspace reference context.',
      },
      {
        kind: 'analyze_goal',
        label: 'Analyze goal',
        description: 'Identify the maintenance target and the likely cleanup scope.',
      },
      {
        kind: 'audit_reference_library',
        label: 'Audit reference library',
        description: 'Inspect the local library for metadata, duplicate, and availability issues.',
      },
      {
        kind: 'detect_reference_issues',
        label: 'Detect reference issues',
        description: 'Group the most important maintenance issues and cleanup opportunities.',
      },
      {
        kind: 'generate_reference_actions',
        label: 'Generate reference actions',
        description: 'Prepare concrete maintenance actions and prioritized fixes.',
      },
      {
        kind: 'await_reference_change_decision',
        label: 'Await reference change decision',
        description: 'Pause before applying reference changes and wait for approval.',
        requiresApproval: true,
        approvalType: 'apply_reference_changes',
      },
      {
        kind: 'summarize_outcome',
        label: 'Summarize outcome',
        description: 'Summarize the maintenance findings, recommended fixes, and follow-up work.',
      },
    ],
  },
  {
    id: 'pdf.summary-current',
    label: 'Summarize current PDF',
    role: 'researcher',
    toolProfile: 'researcher',
    autoAdvanceUntil: 'generate_summary',
    approvalTypes: [],
    steps: [
      {
        kind: 'read_context',
        label: 'Read context',
        description: 'Read the target PDF and any nearby research context.',
      },
      {
        kind: 'analyze_goal',
        label: 'Analyze goal',
        description: 'Identify the summary angle and expected output depth.',
      },
      {
        kind: 'extract_pdf_findings',
        label: 'Extract PDF findings',
        description: 'Extract the main research question, method, evidence, and claims.',
      },
      {
        kind: 'generate_summary',
        label: 'Generate summary',
        description: 'Produce a structured summary of the PDF.',
      },
      {
        kind: 'summarize_outcome',
        label: 'Summarize outcome',
        description: 'Summarize the reading output and suggest the next follow-up actions.',
      },
    ],
  },
  {
    id: 'research.compare-sources',
    label: 'Compare sources',
    role: 'researcher',
    toolProfile: 'researcher',
    autoAdvanceUntil: 'generate_proposal_cards',
    approvalTypes: [],
    steps: [
      {
        kind: 'read_context',
        label: 'Read context',
        description: 'Read the active sources, target topic, and nearby research context.',
      },
      {
        kind: 'analyze_goal',
        label: 'Analyze goal',
        description: 'Identify what should be compared and what decision the comparison should support.',
      },
      {
        kind: 'search_local_references',
        label: 'Search local references',
        description: 'Check whether the local library already contains the relevant candidates.',
      },
      {
        kind: 'search_external_sources',
        label: 'Search external sources',
        description: 'Expand outward only when the local library is not enough for the comparison.',
      },
      {
        kind: 'compare_source_set',
        label: 'Compare source set',
        description: 'Compare overlap, differences, strengths, and fit across the candidate sources.',
      },
      {
        kind: 'generate_proposal_cards',
        label: 'Generate proposal cards',
        description: 'Prepare concrete recommendations and comparison takeaways.',
      },
      {
        kind: 'summarize_outcome',
        label: 'Summarize outcome',
        description: 'Summarize the comparison and the next decision or reading step.',
      },
    ],
  },
  {
    id: 'compile.tex-typ-diagnose',
    label: 'Diagnose TeX / Typst compile issues',
    role: 'tex_typ_fixer',
    toolProfile: 'tex_typ_fixer',
    autoAdvanceUntil: 'diagnose_compile_issue',
    approvalTypes: [],
    steps: [
      {
        kind: 'read_context',
        label: 'Read context',
        description: 'Read the current TeX or Typst source and compile context.',
      },
      {
        kind: 'diagnose_compile_issue',
        label: 'Diagnose compile issue',
        description: 'Analyze compile diagnostics and identify the highest-priority issues.',
      },
      {
        kind: 'summarize_outcome',
        label: 'Summarize outcome',
        description: 'Summarize the compile diagnosis and the next recommended action.',
      },
    ],
  },
  {
    id: 'compile.tex-typ-fix',
    label: 'Fix TeX / Typst compile issues',
    role: 'tex_typ_fixer',
    toolProfile: 'tex_typ_fixer',
    autoAdvanceUntil: 'generate_patch',
    approvalTypes: ['apply_patch'],
    steps: [
      {
        kind: 'read_context',
        label: 'Read context',
        description: 'Read the current TeX or Typst source and compile context.',
      },
      {
        kind: 'diagnose_compile_issue',
        label: 'Diagnose compile issue',
        description: 'Analyze compile diagnostics and identify the highest-priority issues.',
      },
      {
        kind: 'generate_patch',
        label: 'Generate patch',
        description: 'Prepare the smallest safe patch for the detected compile issues.',
      },
      {
        kind: 'await_patch_decision',
        label: 'Await patch decision',
        description: 'Pause before applying TeX / Typst edits and wait for approval.',
        requiresApproval: true,
        approvalType: 'apply_patch',
      },
      {
        kind: 'summarize_outcome',
        label: 'Summarize outcome',
        description: 'Summarize the diagnosis, proposed edits, and remaining blockers.',
      },
    ],
  },
]

export const WORKFLOW_TEMPLATE_IDS = WORKFLOW_TEMPLATE_LIST.map((template) => template.id)

export const WORKFLOW_TEMPLATES = WORKFLOW_TEMPLATE_LIST.map((template) => ({
  ...template,
  backgroundCapable: template.backgroundCapable !== false,
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
    backgroundCapable: template.backgroundCapable !== false,
    steps: template.steps.map((step) => ({ ...step })),
    approvalTypes: [...template.approvalTypes],
  }
}
