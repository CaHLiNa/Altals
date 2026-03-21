import { createWorkflowRun, createWorkflowStep, markRunPlanned } from './state.js'
import { getWorkflowTemplate } from './templates.js'

export function createWorkflowPlan({ templateId, context = {} } = {}) {
  const template = getWorkflowTemplate(templateId)
  const steps = template.steps.map((step) => {
    const normalizedStep = createWorkflowStep({
      kind: step.kind,
      label: step.label,
      description: step.description,
      requiresApproval: Boolean(step.requiresApproval),
      approvalType: step.approvalType || null,
    })
    const { id: _id, ...stepWithoutId } = normalizedStep
    return stepWithoutId
  })

  const run = markRunPlanned(
    createWorkflowRun({
      templateId: template.id,
      title: template.label,
      context,
      steps,
    }),
  )

  return {
    run,
    template: {
      id: template.id,
      label: template.label,
      role: template.role,
      toolProfile: template.toolProfile,
      autoAdvanceUntil: template.autoAdvanceUntil,
      approvalTypes: [...template.approvalTypes],
    },
  }
}
