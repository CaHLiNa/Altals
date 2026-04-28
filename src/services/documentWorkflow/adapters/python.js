function isPythonFile(filePath = '') {
  return filePath.toLowerCase().endsWith('.py')
}

const pythonCompileAdapter = {
  id: 'python',

  stateForFile(filePath, context) {
    return context.pythonStore?.stateForFile?.(filePath) || null
  },

  async compile(filePath, context) {
    return context.pythonStore?.compile?.(filePath) || null
  },
}

export const pythonDocumentAdapter = {
  kind: 'python',

  matchesFile(filePath) {
    return isPythonFile(filePath)
  },

  supportsWorkflowSource(filePath) {
    return isPythonFile(filePath)
  },

  preview: {
    defaultKind: 'terminal',
    supportedKinds: ['terminal'],
    createPath() {
      return null
    },
    inferKind() {
      return null
    },
  },

  compile: pythonCompileAdapter,
}
