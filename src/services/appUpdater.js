import { getVersion } from '@tauri-apps/api/app'
const RELEASES_URL = 'https://github.com/CaHLiNa/Altals/releases'

export async function getAppVersion() {
  try {
    return await getVersion()
  } catch {
    return '0.0.0'
  }
}

export async function openReleasesPage() {
  const { open } = await import('@tauri-apps/plugin-shell')
  await open(RELEASES_URL)
}
