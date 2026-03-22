import { createDocumentWorkflowBuildRuntime } from './documentWorkflowBuildRuntime.js'

export function createDocumentWorkflowBuildOperationRuntime({
  getBuildRuntime = () => createDocumentWorkflowBuildRuntime(),
} = {}) {
  async function runBuildForFile(filePath, options = {}) {
    if (!filePath) return null

    const buildRuntime = getBuildRuntime?.() || null
    if (!buildRuntime?.buildAdapterContext) {
      return null
    }

    const context = buildRuntime.buildAdapterContext(filePath, options)
    const compileAdapter = context?.adapter?.compile || null
    if (!compileAdapter?.compile) {
      return null
    }

    return compileAdapter.compile(filePath, context, options)
  }

  return {
    runBuildForFile,
  }
}
