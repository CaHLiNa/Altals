import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { compareVersions, selectInstallerAsset } from '../domains/settings/appUpdatePresentation.js'
import { openExternalHttpUrl } from './externalLinks.js'
const RELEASES_URL = 'https://github.com/CaHLiNa/ScribeFlow/releases'
const RELEASES_LATEST_API_URL = 'https://api.github.com/repos/CaHLiNa/ScribeFlow/releases/latest'

export { compareVersions, selectInstallerAsset }

export async function getAppVersion() {
  try {
    return await getVersion()
  } catch {
    return '0.0.0'
  }
}

export async function checkForAppUpdates(currentVersion = '') {
  const apiUrl = new URL(RELEASES_LATEST_API_URL)
  apiUrl.searchParams.set('_ts', String(Date.now()))
  const response = await fetch(apiUrl.toString(), {
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub responded with ${response.status}`)
  }

  const payload = await response.json()
  const latestVersion = String(payload?.tag_name || payload?.name || '').trim()
  if (!latestVersion) {
    throw new Error('Latest release version is unavailable.')
  }
  const installerAsset = selectInstallerAsset(payload?.assets || [])

  return {
    latestVersion,
    releaseUrl: String(payload?.html_url || RELEASES_URL),
    publishedAt: payload?.published_at || '',
    installerAsset,
    hasUpdate:
      !!currentVersion && compareVersions(currentVersion, latestVersion) < 0,
  }
}

export function onAppUpdateDownloadProgress(handler) {
  return listen('app-update-download-progress', (event) => {
    handler?.(event.payload || {})
  })
}

export async function downloadAppUpdateAsset(asset) {
  if (!asset?.downloadUrl || !asset?.name) {
    throw new Error('No update installer is available for this device.')
  }

  return invoke('app_update_download_asset', {
    downloadUrl: asset.downloadUrl,
    fileName: asset.name,
  })
}

export async function revealDownloadedUpdate(path = '') {
  return invoke('app_update_reveal_download', { path })
}

export async function openReleasesPage(url = RELEASES_URL) {
  const targetUrl = String(url || RELEASES_URL)
  const opened = await openExternalHttpUrl(targetUrl)
  if (!opened) {
    throw new Error('Release URL is not a valid HTTP URL.')
  }
}
