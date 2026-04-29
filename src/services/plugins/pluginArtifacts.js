import { invoke } from '@tauri-apps/api/core'

export async function openPluginArtifact(artifact = {}) {
  return invoke('plugin_artifact_open', {
    params: {
      path: String(artifact?.path || ''),
    },
  })
}

export async function revealPluginArtifact(artifact = {}) {
  return invoke('plugin_artifact_reveal', {
    params: {
      path: String(artifact?.path || ''),
    },
  })
}
