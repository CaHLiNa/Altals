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
