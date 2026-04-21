export function hasDesktopInvoke() {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__?.invoke === 'function'
}

export function readStorageValue(key, fallback = '') {
  try {
    const value = localStorage.getItem(key)
    return value == null ? fallback : value
  } catch {
    return fallback
  }
}

export function readStorageBoolean(key, fallback = false) {
  const fallbackValue = fallback ? 'true' : 'false'
  const value = String(readStorageValue(key, fallbackValue)).trim().toLowerCase()
  return value === 'true' || value === '1' || value === 'yes' || value === 'on'
}

export function readStorageJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed == null ? fallback : parsed
  } catch {
    return fallback
  }
}

export function readStorageSnapshot(keys = []) {
  const snapshot = {}

  try {
    for (const key of keys) {
      const value = localStorage.getItem(key)
      if (value !== null) {
        snapshot[key] = value
      }
    }
  } catch {
    // Ignore localStorage failures.
  }

  return snapshot
}

export function clearStorageKeys(keys = []) {
  try {
    for (const key of keys) {
      localStorage.removeItem(key)
    }
  } catch {
    // Ignore localStorage failures.
  }
}

export function writeStorageValue(key, value) {
  try {
    if (value == null || value === '') {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, String(value))
    }
    return true
  } catch {
    return false
  }
}

export function writeStorageJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
