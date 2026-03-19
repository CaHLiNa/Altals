const TERMINAL_SNAPSHOT_VERSION = 1
const TERMINAL_SNAPSHOT_KEY = 'terminalWorkbench'

function getSnapshotStorageKey(workspacePath = '') {
  return `${TERMINAL_SNAPSHOT_KEY}:${workspacePath}`
}

export function loadTerminalSnapshot(workspacePath = '') {
  if (!workspacePath) return null

  try {
    const raw = localStorage.getItem(getSnapshotStorageKey(workspacePath))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== TERMINAL_SNAPSHOT_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export function saveTerminalSnapshot(workspacePath = '', snapshot = null) {
  if (!workspacePath || !snapshot) return

  try {
    localStorage.setItem(
      getSnapshotStorageKey(workspacePath),
      JSON.stringify({
        version: TERMINAL_SNAPSHOT_VERSION,
        ...snapshot,
      }),
    )
  } catch {
    // Ignore persistence failures.
  }
}

export function clearTerminalSnapshot(workspacePath = '') {
  if (!workspacePath) return

  try {
    localStorage.removeItem(getSnapshotStorageKey(workspacePath))
  } catch {
    // Ignore persistence failures.
  }
}
