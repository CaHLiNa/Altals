import process from 'node:process'
import {
  assertVersionsMatch,
  bumpSemver,
  getLatestSemverTagVersion,
  maxSemver,
  updateVersions,
} from './version-utils.mjs'

function run() {
  const args = process.argv.slice(2)
  const level = args.find((arg) => !arg.startsWith('--'))
  const dryRun = args.includes('--dry-run')

  if (!level || !['patch', 'minor', 'major'].includes(level)) {
    throw new Error('Usage: node scripts/bump-version.mjs <patch|minor|major> [--dry-run]')
  }

  const currentVersion = assertVersionsMatch()
  const latestTagVersion = getLatestSemverTagVersion()
  const baseVersion = maxSemver(currentVersion, latestTagVersion)
  const nextVersion = bumpSemver(baseVersion, level)

  if (!dryRun) {
    updateVersions(nextVersion)
  }

  console.log(nextVersion)
}

try {
  run()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
