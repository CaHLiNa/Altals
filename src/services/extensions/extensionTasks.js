import { invoke } from '@tauri-apps/api/core'

export async function startExtensionTask(payload = {}) {
  return invoke('extension_task_start', {
    params: {
      globalConfigDir: String(payload.globalConfigDir || ''),
      workspaceRoot: String(payload.workspaceRoot || ''),
      extensionId: String(payload.extensionId || ''),
      capability: String(payload.capability || ''),
      target: payload.target || {},
      settings: payload.settings || {},
    },
  })
}

export async function listExtensionTasks() {
  const tasks = await invoke('extension_task_list')
  return Array.isArray(tasks) ? tasks : []
}

export async function getExtensionTask(taskId = '') {
  return invoke('extension_task_get', {
    params: {
      taskId: String(taskId || ''),
    },
  })
}

export async function cancelExtensionTask(taskId = '') {
  return invoke('extension_task_cancel', {
    params: {
      taskId: String(taskId || ''),
    },
  })
}
