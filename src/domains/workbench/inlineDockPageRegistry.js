function normalizePageList(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function normalizePage(page = {}, definition = {}) {
  const key = String(page.key || '').trim()
  if (!key) return null

  return {
    ...definition.defaults,
    ...page,
    key,
    type: String(page.type || definition.type || definition.id || '').trim(),
  }
}

function allowedPageIdsFromContext(context = {}) {
  const ids = Array.isArray(context.allowedPageIds) ? context.allowedPageIds : []
  return new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))
}

export function createInlineDockPageRegistry(definitions = []) {
  const normalizedDefinitions = definitions
    .map((definition) => ({
      ...definition,
      id: String(definition?.id || '').trim(),
      type: String(definition?.type || definition?.id || '').trim(),
    }))
    .filter((definition) => definition.id && typeof definition.resolve === 'function')

  function resolvePages(context = {}) {
    const allowedPageIds = allowedPageIdsFromContext(context)
    const definitions = allowedPageIds.size > 0
      ? normalizedDefinitions.filter((definition) => allowedPageIds.has(definition.id))
      : normalizedDefinitions

    return definitions.flatMap((definition) =>
      normalizePageList(definition.resolve(context))
        .map((page) => normalizePage(page, definition))
        .filter(Boolean)
    )
  }

  function getDefinition(id = '') {
    const normalizedId = String(id || '').trim()
    return normalizedDefinitions.find((definition) => definition.id === normalizedId) || null
  }

  return {
    getDefinition,
    resolvePages,
  }
}

export function findInlineDockPage(pages = [], key = '') {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) return null
  return pages.find((page) => page.key === normalizedKey) || null
}
