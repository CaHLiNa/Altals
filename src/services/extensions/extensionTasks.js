import { invoke } from '@tauri-apps/api/core'

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
