import { invoke } from '@tauri-apps/api/core'

export async function detectPythonRuntime() {
  return invoke('python_runtime_detect')
}

export async function compilePythonFile(filePath) {
  return invoke('python_runtime_compile', {
    params: {
      filePath: String(filePath || ''),
    },
  })
}
