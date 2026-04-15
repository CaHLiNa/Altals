import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function resolveMacDeveloperDir(currentEnv, platform = process.platform) {
  if (platform !== 'darwin' || currentEnv.DEVELOPER_DIR) {
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

export function buildTauriSpawnSpec(platform, forwardedArgs = []) {
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npx', 'tauri', ...forwardedArgs],
      options: {},
    }
  }

  return {
    command: 'npx',
    args: ['tauri', ...forwardedArgs],
    options: {},
  }
}

export function runTauriCli() {
  const args = process.argv.slice(2)
  const env = { ...process.env }
  const developerDir = resolveMacDeveloperDir(env)

  if (developerDir) {
    env.DEVELOPER_DIR = developerDir
    process.stderr.write(
      `[altals] xcrun could not resolve developer tools; falling back to ${developerDir}\n`,
    )
  }

  const spec = buildTauriSpawnSpec(process.platform, args)
  const child = spawn(spec.command, spec.args, {
    env,
    stdio: 'inherit',
    ...spec.options,
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
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMainModule) {
  runTauriCli()
}
