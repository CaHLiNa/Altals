function normalizeFilePath(filePath = '') {
  return String(filePath || '').trim()
}

export function shouldLoadFileVersionHistoryView({
  visible = false,
  filePath = '',
  previousVisible,
  previousFilePath = '',
} = {}) {
  const normalizedFilePath = normalizeFilePath(filePath)
  if (!visible || !normalizedFilePath) {
    return false
  }

  if (typeof previousVisible === 'undefined') {
    return true
  }

  if (!previousVisible) {
    return true
  }

  return normalizeFilePath(previousFilePath) !== normalizedFilePath
}

export function shouldResetFileVersionHistoryView({ visible = false } = {}) {
  return !visible
}
