import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { openExternalHttpUrl } from './externalLinks.js'
const RELEASES_URL = 'https://github.com/CaHLiNa/ScribeFlow/releases'
const RELEASES_LATEST_API_URL = 'https://api.github.com/repos/CaHLiNa/ScribeFlow/releases/latest'

function normalizeVersionSegment(value = '') {
  const parsed = Number.parseInt(String(value || '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeComparableVersion(version = '') {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
}

export function compareVersions(currentVersion = '', nextVersion = '') {
  const current = normalizeComparableVersion(currentVersion).split('.')
  const next = normalizeComparableVersion(nextVersion).split('.')
  const length = Math.max(current.length, next.length)
  for (let index = 0; index < length; index += 1) {
    const left = normalizeVersionSegment(current[index])
    const right = normalizeVersionSegment(next[index])
    if (left === right) continue
    return left < right ? -1 : 1
  }
  return 0
}

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

function currentInstallerProfile() {
  const runtimeNavigator = globalThis?.navigator || {}
  const platformHint = [
    runtimeNavigator?.userAgentData?.platform,
    runtimeNavigator?.platform,
    runtimeNavigator?.userAgent,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (platformHint.includes('win')) return 'windows'
  if (platformHint.includes('mac')) return 'macos-arm'
  return 'unknown'
}

function assetScore(assetName, profile) {
  const name = String(assetName || '').toLowerCase()
  if (!name || name.endsWith('.blockmap') || name.endsWith('.sig')) return -1

  if (profile === 'windows') {
    if (!name.endsWith('.exe') && !name.endsWith('.msi')) return -1
    let score = 0
    if (name.includes('windows') || name.includes('win32') || name.includes('win')) score += 4
    if (name.includes('x64') || name.includes('x86_64') || name.includes('amd64')) score += 3
    if (name.includes('setup')) score += 1
    return score
  }

  if (profile === 'macos-arm') {
    if (!name.endsWith('.dmg')) return -1
    let score = 0
    if (name.includes('darwin') || name.includes('macos') || name.includes('mac')) score += 4
    if (name.includes('aarch64') || name.includes('arm64') || name.includes('apple')) score += 3
    if (!name.includes('x86_64') && !name.includes('x64') && !name.includes('intel')) score += 1
    return score
  }

  return name.endsWith('.dmg') || name.endsWith('.exe') || name.endsWith('.msi') ? 0 : -1
}

export function selectInstallerAsset(assets = []) {
  const profile = currentInstallerProfile()
  return [...assets]
    .map((asset) => ({
      name: String(asset?.name || ''),
      downloadUrl: String(asset?.browser_download_url || ''),
      size: Number(asset?.size || 0),
      score: assetScore(asset?.name, profile),
    }))
    .filter((asset) => asset.score >= 0 && asset.name && asset.downloadUrl)
    .sort((left, right) => right.score - left.score || right.size - left.size)[0] || null
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
