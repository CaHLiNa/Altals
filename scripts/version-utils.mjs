import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const files = {
  packageJson: path.join(repoRoot, 'package.json'),
  packageLock: path.join(repoRoot, 'package-lock.json'),
  cargoToml: path.join(repoRoot, 'src-tauri', 'Cargo.toml'),
  cargoLock: path.join(repoRoot, 'src-tauri', 'Cargo.lock'),
  tauriConf: path.join(repoRoot, 'src-tauri', 'tauri.conf.json'),
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, value)
}

function updateSingleMatch(content, pattern, replacement, label) {
  const match = content.match(pattern)
  if (!match) {
    throw new Error(`Failed to find ${label}`)
  }
  return content.replace(pattern, replacement)
}

export function readVersions() {
  const packageJson = readJson(files.packageJson)
  const packageLock = readJson(files.packageLock)
  const tauriConf = readJson(files.tauriConf)
  const cargoToml = readText(files.cargoToml)
  const cargoLock = readText(files.cargoLock)

  const cargoTomlVersion = cargoToml.match(/^version = "([^"]+)"$/m)?.[1]
  const cargoLockVersion = cargoLock.match(/name = "altals"\nversion = "([^"]+)"/)?.[1]

  return {
    packageJson: packageJson.version,
    packageLock: packageLock.version,
    packageLockRoot: packageLock.packages?.['']?.version,
    cargoToml: cargoTomlVersion || null,
    cargoLock: cargoLockVersion || null,
    tauriConf: tauriConf.version,
  }
}

export function assertVersionsMatch() {
  const versions = readVersions()
  const unique = [...new Set(Object.values(versions).filter(Boolean))]
  if (unique.length !== 1) {
    const detail = Object.entries(versions)
      .map(([name, version]) => `${name}: ${version ?? 'missing'}`)
      .join('\n')
    throw new Error(`Version mismatch detected:\n${detail}`)
  }
  return unique[0]
}

export function bumpSemver(version, level) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`)
  }

  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])

  if (level === 'major') return `${major + 1}.0.0`
  if (level === 'minor') return `${major}.${minor + 1}.0`
  if (level === 'patch') return `${major}.${minor}.${patch + 1}`
  throw new Error(`Unsupported bump level: ${level}`)
}

export function updateVersions(nextVersion) {
  const packageJson = readJson(files.packageJson)
  packageJson.version = nextVersion
  writeJson(files.packageJson, packageJson)

  const packageLock = readJson(files.packageLock)
  packageLock.version = nextVersion
  if (packageLock.packages?.['']) {
    packageLock.packages[''].version = nextVersion
  }
  writeJson(files.packageLock, packageLock)

  const tauriConf = readJson(files.tauriConf)
  tauriConf.version = nextVersion
  writeJson(files.tauriConf, tauriConf)

  const cargoToml = readText(files.cargoToml)
  writeText(
    files.cargoToml,
    updateSingleMatch(
      cargoToml,
      /^version = "[^"]+"$/m,
      `version = "${nextVersion}"`,
      'src-tauri/Cargo.toml version',
    ),
  )

  const cargoLock = readText(files.cargoLock)
  writeText(
    files.cargoLock,
    updateSingleMatch(
      cargoLock,
      /name = "altals"\nversion = "[^"]+"/,
      `name = "altals"\nversion = "${nextVersion}"`,
      'src-tauri/Cargo.lock altals package version',
    ),
  )
}

export function buildLabel(version, runNumber, sha, isTag = false) {
  if (isTag) return `v${version}`
  const shortSha = String(sha || '').slice(0, 7) || 'local'
  const buildNumber = String(runNumber || '0')
  return `${version}-build.${buildNumber}.${shortSha}`
}

export function assertTagMatchesVersion(tagName) {
  const version = assertVersionsMatch()
  const normalizedTag = String(tagName || '').replace(/^refs\/tags\//, '')
  const expectedTag = `v${version}`
  if (normalizedTag !== expectedTag) {
    throw new Error(`Tag ${normalizedTag} does not match project version ${version}`)
  }
  return version
}

function runCli() {
  const [command, ...args] = process.argv.slice(2)

  if (command === 'check') {
    const version = assertVersionsMatch()
    console.log(version)
    return
  }

  if (command === 'get') {
    console.log(assertVersionsMatch())
    return
  }

  if (command === 'check-tag') {
    const tag = args[0]
    if (!tag) throw new Error('Usage: node scripts/version-utils.mjs check-tag <tag>')
    console.log(assertTagMatchesVersion(tag))
    return
  }

  if (command === 'build-label') {
    const [runNumber, sha, tagFlag] = args
    const version = assertVersionsMatch()
    console.log(buildLabel(version, runNumber, sha, tagFlag === 'true'))
    return
  }

  throw new Error(
    'Usage: node scripts/version-utils.mjs <check|get|check-tag|build-label> [args...]',
  )
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectRun) {
  try {
    runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
