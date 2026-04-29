import { invoke } from '@tauri-apps/api/core'

export async function startPluginJob(payload = {}) {
  return invoke('plugin_job_start', {
    params: {
      globalConfigDir: String(payload.globalConfigDir || ''),
      workspaceRoot: String(payload.workspaceRoot || ''),
      pluginId: String(payload.pluginId || ''),
      capability: String(payload.capability || ''),
      target: payload.target || {},
      settings: payload.settings || {},
    },
  })
}

export async function listPluginJobs() {
  const jobs = await invoke('plugin_job_list')
  return Array.isArray(jobs) ? jobs : []
}

export async function getPluginJob(jobId = '') {
  return invoke('plugin_job_get', {
    params: {
      jobId: String(jobId || ''),
    },
  })
}

export async function cancelPluginJob(jobId = '') {
  return invoke('plugin_job_cancel', {
    params: {
      jobId: String(jobId || ''),
    },
  })
}
