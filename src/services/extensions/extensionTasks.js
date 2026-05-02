import { invoke } from '@tauri-apps/api/core'

export async function listExtensionTasks(workspaceRoot = '') {
  const tasks = await invoke('extension_task_list', {
    params: {
      workspaceRoot: String(workspaceRoot || ''),
    },
  })
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

export async function cancelExtensionTasksForExtension(extensionId = '', workspaceRoot = '') {
  const tasks = await invoke('extension_task_cancel_extension', {
    params: {
      extensionId: String(extensionId || ''),
      workspaceRoot: String(workspaceRoot || ''),
    },
  })
  return Array.isArray(tasks) ? tasks : []
}
