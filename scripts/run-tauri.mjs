import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const env = { ...process.env }

function resolveMacDeveloperDir(currentEnv) {
  if (process.platform !== 'darwin' || currentEnv.DEVELOPER_DIR) {
    return null
  }

  const ranlibCheck = spawnSync('xcrun', ['--find', 'ranlib'], {
    env: currentEnv,
    encoding: 'utf8',
  })

  if (ranlibCheck.status === 0) {
    return null
  }

  const cltPath = '/Library/Developer/CommandLineTools'
  const cltRanlibPath = `${cltPath}/usr/bin/ranlib`

  if (!existsSync(cltRanlibPath)) {
    return null
  }

  return cltPath
}

const developerDir = resolveMacDeveloperDir(env)

if (developerDir) {
  env.DEVELOPER_DIR = developerDir
  process.stderr.write(
    `[altals] xcrun could not resolve developer tools; falling back to ${developerDir}\n`,
  )
}

const tauriCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(tauriCommand, ['tauri', ...args], {
  env,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})

child.on('error', (error) => {
  process.stderr.write(`${error.message}\n`)
  process.exit(1)
})
