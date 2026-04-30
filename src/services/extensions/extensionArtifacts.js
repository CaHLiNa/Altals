import { invoke } from '@tauri-apps/api/core'

export async function openExtensionArtifact(artifact = {}) {
  return invoke('extension_artifact_open', {
    params: {
      path: String(artifact?.path || ''),
    },
  })
}

export async function revealExtensionArtifact(artifact = {}) {
  return invoke('extension_artifact_reveal', {
    params: {
      path: String(artifact?.path || ''),
    },
  })
}
