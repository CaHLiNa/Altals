import { isLatex, isTypst } from '../../utils/fileTypes.js'

function isDocumentAiTarget(filePath) {
  return isLatex(filePath) || isTypst(filePath)
}

export function createDocumentWorkflowAiRuntime({
  launchAiTaskImpl = null,
  createFixTaskImpl = null,
  createDiagnoseTaskImpl = null,
} = {}) {
  async function resolveLaunchAiTask() {
    if (launchAiTaskImpl) return launchAiTaskImpl
    const mod = await import('../../services/ai/launch.js')
    return mod.launchAiTask
  }

  async function resolveFixTaskCreator() {
    if (createFixTaskImpl) return createFixTaskImpl
    const mod = await import('../../services/ai/taskCatalog.js')
    return mod.createTexTypFixTask
  }

  async function resolveDiagnoseTaskCreator() {
    if (createDiagnoseTaskImpl) return createDiagnoseTaskImpl
    const mod = await import('../../services/ai/taskCatalog.js')
    return mod.createTexTypDiagnoseTask
  }

  async function launchFixForFile(filePath, options = {}) {
    if (!isDocumentAiTarget(filePath)) return null

    const launchTask = await resolveLaunchAiTask()
    const createFixTask = await resolveFixTaskCreator()
    return launchTask({
      editorStore: options.editorStore || null,
      chatStore: options.chatStore || null,
      paneId: options.paneId || null,
      beside: options.beside !== false,
      surface: options.surface || 'drawer',
      modelId: options.modelId,
      task: createFixTask({
        filePath,
        source: options.source || 'document-workflow',
        entryContext: options.entryContext || 'document-workflow',
      }),
    })
  }

  async function launchDiagnoseForFile(filePath, options = {}) {
    if (!isDocumentAiTarget(filePath)) return null

    const launchTask = await resolveLaunchAiTask()
    const createDiagnoseTask = await resolveDiagnoseTaskCreator()
    return launchTask({
      editorStore: options.editorStore || null,
      chatStore: options.chatStore || null,
      paneId: options.paneId || null,
      beside: options.beside !== false,
      surface: options.surface || 'drawer',
      modelId: options.modelId,
      task: createDiagnoseTask({
        filePath,
        source: options.source || 'document-workflow',
        entryContext: options.entryContext || 'document-workflow',
      }),
    })
  }

  return {
    launchFixForFile,
    launchDiagnoseForFile,
  }
}
