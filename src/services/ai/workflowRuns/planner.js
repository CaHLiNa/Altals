import { createWorkflowRun, createWorkflowStep } from './state.js'
import { getWorkflowTemplate } from './templates.js'

export function createWorkflowPlan({ templateId, context = {} } = {}) {
  const template = getWorkflowTemplate(templateId)
  const steps = template.steps.map((step, index) =>
    createWorkflowStep({
      id: `${template.id}:${index + 1}`,
      kind: step.kind,
      label: step.label,
      description: step.description,
      requiresApproval: Boolean(step.requiresApproval),
      approvalType: step.approvalType || null,
    }),
  )

  return {
    ...createWorkflowRun({
      templateId: template.id,
      title: template.label,
      context,
      steps,
    }),
    label: template.label,
    role: template.role,
    toolProfile: template.toolProfile,
    autoAdvanceUntil: template.autoAdvanceUntil,
    approvalTypes: [...template.approvalTypes],
  }
}
