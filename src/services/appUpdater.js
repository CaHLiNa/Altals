import { getVersion } from '@tauri-apps/api/app'
const RELEASES_URL = 'https://github.com/CaHLiNa/Altals/releases'

export async function getAppVersion() {
  try {
    return await getVersion()
  } catch {
    return '0.0.0'
  }
}

export async function checkForUpdate() {
  return null
}

export async function downloadUpdate(update, onProgress) {
  void update
  if (onProgress) onProgress(0)
  return false
}

export async function installAndRestart() {
  return false
}

export function isAutoCheckEnabled() {
  return false
}

export function setAutoCheckEnabled(enabled) {
  void enabled
}

export async function openReleasesPage() {
  const { open } = await import('@tauri-apps/plugin-shell')
  await open(RELEASES_URL)
}
