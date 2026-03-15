function readRecentWorkspaces() {
  try {
    return JSON.parse(localStorage.getItem('recentWorkspaces') || '[]')
  } catch {
    return []
  }
}

function writeRecentWorkspaces(value) {
  try {
    localStorage.setItem('recentWorkspaces', JSON.stringify(value))
  } catch {
    // Ignore localStorage failures.
  }
}

export function getRecentWorkspaces() {
  return readRecentWorkspaces()
}

export function addRecentWorkspace(path) {
  const recents = readRecentWorkspaces().filter(item => item.path !== path)
  recents.unshift({ path, name: path.split('/').pop(), lastOpened: new Date().toISOString() })
  if (recents.length > 10) recents.length = 10
  writeRecentWorkspaces(recents)
}

export function removeRecentWorkspace(path) {
  const recents = readRecentWorkspaces().filter(item => item.path !== path)
  writeRecentWorkspaces(recents)
}

export function setLastWorkspace(path) {
  try {
    localStorage.setItem('lastWorkspace', path)
  } catch {
    // Ignore localStorage failures.
  }
}

export function clearLastWorkspace() {
  try {
    localStorage.removeItem('lastWorkspace')
  } catch {
    // Ignore localStorage failures.
  }
}
