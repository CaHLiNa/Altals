import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { setUserStyles } from '../services/citationStyleRegistry'
import { events } from '../services/telemetry'
import { useWorkspaceStore } from './workspace'
import { useEditorStore } from './editor'
import { useFilesStore } from './files'
import { extractTextFromPdf } from '../utils/pdfMetadata'
import { buildReferenceKey } from '../utils/referenceKeys'
import {
  createEmptyGlobalReferenceWorkbench,
  createEmptyWorkspaceReferenceCollection,
  parseGlobalReferenceWorkbench,
  parseWorkspaceReferenceCollection,
  resolveGlobalReferenceFulltextPath,
  resolveGlobalReferenceLibraryPath,
  resolveGlobalReferencePdfPath,
  resolveGlobalReferencePdfsDir,
  resolveGlobalReferencesDir,
  resolveGlobalReferenceWorkbenchPath,
  resolveGlobalReferenceFulltextDir,
  resolveLegacyWorkspaceReferenceFulltextDir,
  resolveLegacyWorkspaceReferenceLibraryPath,
  resolveLegacyWorkspaceReferencePdfsDir,
  resolveWorkspaceReferenceCollectionPath,
  resolveWorkspaceReferencesDir,
} from '../services/referenceLibraryPaths'

function normalizeDoi(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/doi\.org\//i, '')
    .toLowerCase()
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeAuthorToken(author = {}) {
  return String(author?.family || author?.given || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

const EDITABLE_REFERENCE_KEY_RE = /^[A-Za-z][A-Za-z0-9:_.-]*$/
const VALID_LIBRARY_SORT_KEYS = new Set(['added-desc', 'year-desc', 'year-asc', 'title-asc', 'author-asc'])
const VALID_READING_STATES = new Set(['unread', 'reading', 'reviewed'])
const VALID_PRIORITY_LEVELS = new Set(['low', 'medium', 'high'])

function createWorkbenchId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeEditableReferenceKey(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
}

function normalizeReferenceTags(tags = []) {
  const raw = Array.isArray(tags) ? tags : String(tags || '').split(',')
  return Array.from(new Set(
    raw
      .map((tag) => String(tag || '').trim())
      .filter(Boolean)
  ))
}

function normalizeReferenceCollections(collections = []) {
  const raw = Array.isArray(collections) ? collections : String(collections || '').split(',')
  return Array.from(new Set(
    raw
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ))
}

function normalizeReadingState(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return VALID_READING_STATES.has(normalized) ? normalized : ''
}

function normalizePriority(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return VALID_PRIORITY_LEVELS.has(normalized) ? normalized : ''
}

function normalizeRating(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  const rounded = Math.round(numeric)
  return rounded >= 1 && rounded <= 5 ? rounded : 0
}

function normalizeWorkflowText(value) {
  return String(value || '').trim()
}

function issuedYear(ref = {}) {
  return Number(ref?.issued?.['date-parts']?.[0]?.[0] || 0)
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.keys(value).length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return value !== null && value !== undefined && value !== ''
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function mergeableFieldNames(existing = {}, incoming = {}) {
  return Array.from(new Set([
    ...Object.keys(existing || {}),
    ...Object.keys(incoming || {}),
  ])).filter((field) => (
    field &&
    field !== 'id' &&
    !field.startsWith('_')
  ))
}

function referenceKey(ref = {}) {
  return ref?._key || ref?.id || null
}

function sanitizeReferenceRecord(ref = {}) {
  const next = cloneValue(ref) || {}
  const tags = normalizeReferenceTags(next._tags || [])
  const collections = normalizeReferenceCollections(next._collections || [])
  const readingState = normalizeReadingState(next._readingState)
  const priority = normalizePriority(next._priority)
  const rating = normalizeRating(next._rating)
  const summary = normalizeWorkflowText(next._summary)
  const readingNote = normalizeWorkflowText(next._readingNote)

  if (tags.length > 0) next._tags = tags
  else delete next._tags

  if (collections.length > 0) next._collections = collections
  else delete next._collections

  if (readingState) next._readingState = readingState
  else delete next._readingState

  if (priority) next._priority = priority
  else delete next._priority

  if (rating > 0) next._rating = rating
  else delete next._rating

  if (summary) next._summary = summary
  else delete next._summary

  if (readingNote) next._readingNote = readingNote
  else delete next._readingNote

  return next
}

function normalizeWorkbenchCollection(entry = {}, seenIds = new Set()) {
  const name = String(entry?.name || '').trim()
  if (!name) return null
  const preferredId = String(entry?.id || '').trim()
  let id = preferredId || createWorkbenchId('collection')
  while (seenIds.has(id)) {
    id = createWorkbenchId('collection')
  }
  seenIds.add(id)
  const now = new Date().toISOString()
  return {
    id,
    name,
    createdAt: String(entry?.createdAt || now),
    updatedAt: String(entry?.updatedAt || entry?.createdAt || now),
  }
}

function normalizeSavedViewFilters(filters = {}) {
  const viewId = String(filters?.viewId || 'all').trim() || 'all'
  return {
    viewId,
    tags: normalizeReferenceTags(filters?.tags || []),
    searchQuery: String(filters?.searchQuery || '').trim(),
    sortKey: VALID_LIBRARY_SORT_KEYS.has(String(filters?.sortKey || '').trim())
      ? String(filters.sortKey).trim()
      : 'added-desc',
  }
}

function normalizeWorkbenchSavedView(entry = {}, seenIds = new Set()) {
  const name = String(entry?.name || '').trim()
  if (!name) return null
  const preferredId = String(entry?.id || '').trim()
  let id = preferredId || createWorkbenchId('view')
  while (seenIds.has(id)) {
    id = createWorkbenchId('view')
  }
  seenIds.add(id)
  const now = new Date().toISOString()
  return {
    id,
    name,
    filters: normalizeSavedViewFilters(entry?.filters || {}),
    createdAt: String(entry?.createdAt || now),
    updatedAt: String(entry?.updatedAt || entry?.createdAt || now),
  }
}

function sanitizeWorkbenchState(payload = createEmptyGlobalReferenceWorkbench()) {
  const collectionIds = new Set()
  const savedViewIds = new Set()
  const collections = (payload?.collections || [])
    .map((entry) => normalizeWorkbenchCollection(entry, collectionIds))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
  const savedViews = (payload?.savedViews || [])
    .map((entry) => normalizeWorkbenchSavedView(entry, savedViewIds))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
  return {
    version: Number(payload?.version) || 1,
    collections,
    savedViews,
  }
}

function buildKeyMapFromList(list = []) {
  const map = {}
  for (let i = 0; i < list.length; i += 1) {
    const key = referenceKey(list[i])
    if (key) map[key] = i
  }
  return map
}

function buildWorkspaceLibrary(globalLibrary = [], globalKeyMap = {}, workspaceKeys = []) {
  const seen = new Set()
  const library = []
  const keys = []

  for (const key of workspaceKeys || []) {
    if (!key || seen.has(key)) continue
    const idx = globalKeyMap[key]
    if (idx === undefined) continue
    seen.add(key)
    library.push(globalLibrary[idx])
    keys.push(key)
  }

  return { library, keys }
}

function sortReferences(list = [], sortBy = 'addedAt', sortDir = 'desc') {
  const copy = [...list]
  const dir = sortDir === 'asc' ? 1 : -1
  switch (sortBy) {
    case 'author':
      return copy.sort((a, b) => {
        const aAuth = a.author?.[0]?.family || ''
        const bAuth = b.author?.[0]?.family || ''
        return dir * aAuth.localeCompare(bAuth)
      })
    case 'year':
      return copy.sort((a, b) => {
        const aYear = a.issued?.['date-parts']?.[0]?.[0] || 0
        const bYear = b.issued?.['date-parts']?.[0]?.[0] || 0
        return dir * (aYear - bYear)
      })
    case 'title':
      return copy.sort((a, b) => dir * (a.title || '').localeCompare(b.title || ''))
    case 'addedAt':
    default:
      return copy.sort((a, b) => {
        const aDate = a._addedAt || ''
        const bDate = b._addedAt || ''
        return dir * aDate.localeCompare(bDate)
      })
  }
}

function filterReferences(list = [], query = '') {
  if (!query || !query.trim()) return list

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  return list.filter(ref => {
    const searchable = [
      ref.title || '',
      ref._key || '',
      ref.DOI || '',
      String(ref.issued?.['date-parts']?.[0]?.[0] || ''),
      ...(ref.author || []).map(a => `${a.family || ''} ${a.given || ''}`),
      ...(ref._tags || []),
      ref['container-title'] || '',
      ref.abstract || '',
    ].join(' ').toLowerCase()

    return tokens.every(token => searchable.includes(token))
  })
}

async function readFileIfExists(path) {
  if (!path) return null
  try {
    const exists = await invoke('path_exists', { path })
    if (!exists) return null
    return await invoke('read_file', { path })
  } catch {
    return null
  }
}

async function readJsonArray(path) {
  const raw = await readFileIfExists(path)
  if (!raw) return []
  try {
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function readWorkspaceReferenceCollection(path) {
  return parseWorkspaceReferenceCollection(await readFileIfExists(path))
}

async function copyFileIfPresent(src, dest) {
  if (!src || !dest) return false
  try {
    const exists = await invoke('path_exists', { path: src })
    if (!exists) return false
    const destExists = await invoke('path_exists', { path: dest })
    if (!destExists) {
      await invoke('copy_file', { src, dest })
    }
    return true
  } catch {
    return false
  }
}

export const useReferencesStore = defineStore('references', {
  state: () => ({
    library: [],
    keyMap: {},         // citeKey → index in library
    globalLibrary: [],
    globalKeyMap: {},
    workspaceKeys: [],
    collections: [],
    savedViews: [],
    initialized: false,
    loading: false,
    activeKey: null,
    libraryDetailMode: 'browse',
    selectedKeys: new Set(),
    sortBy: 'addedAt',  // field name: 'addedAt' | 'author' | 'year' | 'title'
    sortDir: 'desc',    // 'asc' | 'desc'
    citationStyle: 'apa',
    _loadGeneration: 0,
  }),

  getters: {
    getByKey: (state) => (key) => {
      const globalIdx = state.globalKeyMap[key]
      if (globalIdx !== undefined) return state.globalLibrary[globalIdx]
      const idx = state.keyMap[key]
      return idx !== undefined ? state.library[idx] : null
    },

    allKeys: (state) => state.globalLibrary.map((ref) => referenceKey(ref)).filter(Boolean),

    refCount: (state) => state.library.length,

    refsWithPdf: (state) => state.library.filter(r => r._pdfFile),

    sortedLibrary: (state) => sortReferences(state.library, state.sortBy, state.sortDir),

    sortedGlobalLibrary: (state) => sortReferences(state.globalLibrary, state.sortBy, state.sortDir),

    // Citation index: key → [filePaths] that cite it
    citedIn: (state) => {
      const filesStore = useFilesStore()
      const map = {}
      // Pandoc-style: [@key], [@key1; @key2]
      const citationRe = /\[([^\[\]]*@[a-zA-Z][\w]*[^\[\]]*)\]/g
      const keyRe = /@([a-zA-Z][\w]*)/g
      // LaTeX-style: \cite{key}, \citep{key1, key2}
      const latexCiteRe = /\\(?:cite[tp]?|citealp|citealt|citeauthor|citeyear|autocite|textcite|parencite|nocite|footcite|fullcite|supercite|smartcite|Cite[tp]?|Parencite|Textcite|Autocite|Smartcite|Footcite|Fullcite)\{([^}]*)\}/g
      const latexKeyRe = /([a-zA-Z][\w.-]*)/g
      const typstCiteRe = /(^|[^\w])@([a-zA-Z][\w.-]*)/gm

      for (const [path, content] of Object.entries(filesStore.fileContents)) {
        if (!content) continue

        if (path.endsWith('.md')) {
          citationRe.lastIndex = 0
          let match
          while ((match = citationRe.exec(content)) !== null) {
            keyRe.lastIndex = 0
            let keyMatch
            while ((keyMatch = keyRe.exec(match[1])) !== null) {
              const key = keyMatch[1]
              if (!map[key]) map[key] = []
              if (!map[key].includes(path)) map[key].push(path)
            }
          }
        } else if (path.endsWith('.tex') || path.endsWith('.latex')) {
          latexCiteRe.lastIndex = 0
          let match
          while ((match = latexCiteRe.exec(content)) !== null) {
            latexKeyRe.lastIndex = 0
            let keyMatch
            while ((keyMatch = latexKeyRe.exec(match[1])) !== null) {
              const key = keyMatch[1]
              if (!map[key]) map[key] = []
              if (!map[key].includes(path)) map[key].push(path)
            }
          }
        } else if (path.endsWith('.typ')) {
          typstCiteRe.lastIndex = 0
          let match
          while ((match = typstCiteRe.exec(content)) !== null) {
            const key = match[2]
            if (!map[key]) map[key] = []
            if (!map[key].includes(path)) map[key].push(path)
          }
        }
      }
      return map
    },

    citedKeys() {
      return new Set(Object.keys(this.citedIn))
    },
  },

  actions: {
    // --- Persistence ---

    _captureWorkspaceContext() {
      const workspace = useWorkspaceStore()
      return {
        workspacePath: workspace.path || '',
        projectDir: workspace.projectDir || '',
        globalConfigDir: workspace.globalConfigDir || '',
      }
    },

    _matchesWorkspaceContext(context) {
      if (!context?.workspacePath || !context?.projectDir || !context?.globalConfigDir) return false
      const workspace = useWorkspaceStore()
      return (
        workspace.path === context.workspacePath
        && workspace.projectDir === context.projectDir
        && workspace.globalConfigDir === context.globalConfigDir
      )
    },

    _beginLoadContext() {
      const context = this._captureWorkspaceContext()
      if (!this._matchesWorkspaceContext(context)) return null
      this._loadGeneration += 1
      return {
        ...context,
        generation: this._loadGeneration,
      }
    },

    _isLoadStale(context) {
      if (!context) return true
      return context.generation !== this._loadGeneration || !this._matchesWorkspaceContext(context)
    },

    async loadLibrary() {
      const context = this._beginLoadContext()
      if (!context) return

      this.loading = true

      try {
        try {
          await this._ensureReferenceStorageReady(context)
          if (this._isLoadStale(context)) return

          let globalLibrary = await readJsonArray(resolveGlobalReferenceLibraryPath(context.globalConfigDir))
          if (this._isLoadStale(context)) return

          let workspaceCollection = await readWorkspaceReferenceCollection(resolveWorkspaceReferenceCollectionPath(context.projectDir))
          if (this._isLoadStale(context)) return

          const workbenchState = sanitizeWorkbenchState(
            parseGlobalReferenceWorkbench(
              await readFileIfExists(resolveGlobalReferenceWorkbenchPath(context.globalConfigDir))
            )
          )
          if (this._isLoadStale(context)) return

          const migration = await this._migrateLegacyWorkspaceData(context, {
            globalLibrary,
            workspaceKeys: workspaceCollection.keys,
          })
          if (this._isLoadStale(context)) return

          globalLibrary = migration.globalLibrary
          workspaceCollection = {
            ...workspaceCollection,
            keys: migration.workspaceKeys,
          }
          const validCollectionIds = new Set(workbenchState.collections.map((entry) => entry.id))
          globalLibrary = globalLibrary
            .map((ref) => {
              const nextRef = sanitizeReferenceRecord(ref)
              if (validCollectionIds.size > 0 && Array.isArray(nextRef._collections)) {
                nextRef._collections = nextRef._collections.filter((id) => validCollectionIds.has(id))
                if (nextRef._collections.length === 0) delete nextRef._collections
              } else {
                delete nextRef._collections
              }
              return nextRef
            })
            .filter((ref) => !!referenceKey(ref))

          this.globalLibrary = globalLibrary
          this.globalKeyMap = buildKeyMapFromList(globalLibrary)
          this.collections = workbenchState.collections
          this.savedViews = workbenchState.savedViews
          const workspaceView = buildWorkspaceLibrary(globalLibrary, this.globalKeyMap, workspaceCollection.keys)
          this.library = workspaceView.library
          this.workspaceKeys = workspaceView.keys
          this.keyMap = buildKeyMapFromList(workspaceView.library)
          if (this.activeKey && this.globalKeyMap[this.activeKey] === undefined) {
            this.activeKey = null
            this.libraryDetailMode = 'browse'
          }

          if (migration.didChange) {
            await this._writeLibraries(context)
            if (this._isLoadStale(context)) return
          }
        } catch (e) {
          if (this._isLoadStale(context)) return
          console.warn('Failed to load reference library:', e)
          this.library = []
          this.keyMap = {}
          this.workspaceKeys = []
          if (!Array.isArray(this.globalLibrary) || this.globalLibrary.length === 0) {
            this.globalLibrary = []
            this.globalKeyMap = {}
            this.collections = []
            this.savedViews = []
          } else {
            this.globalKeyMap = buildKeyMapFromList(this.globalLibrary)
          }
        }

        if (this._isLoadStale(context)) return

        // Load persisted citation style
        try {
          const stylePath = `${context.projectDir}/citation-style.json`
          const exists = await invoke('path_exists', { path: stylePath })
          if (exists) {
            const raw = await invoke('read_file', { path: stylePath })
            const data = JSON.parse(raw)
            if (data.citationStyle) this.citationStyle = data.citationStyle
          }
        } catch { /* use default */ }

        if (this._isLoadStale(context)) return

        // Load user-added CSL styles from .project/styles/
        try {
          await this._loadUserStyles(context.projectDir)
        } catch { /* no user styles */ }

        if (this._isLoadStale(context)) return

        this.initialized = true
        await this.startWatching(context)
      } finally {
        if (!this._isLoadStale(context)) {
          this.loading = false
        }
      }
    },

    async _loadUserStyles(baseDir) {
      const stylesDir = `${baseDir}/styles`
      const exists = await invoke('path_exists', { path: stylesDir })
      if (!exists) return

      const entries = await invoke('read_dir', { path: stylesDir })
      const cslFiles = (entries || []).filter(e => e.name?.endsWith('.csl'))
      if (cslFiles.length === 0) return

      const { parseCslMetadata, deriveStyleId } = await import('../utils/cslParser')

      const styles = []
      for (const entry of cslFiles) {
        try {
          const xml = await invoke('read_file', { path: `${stylesDir}/${entry.name}` })
          const meta = parseCslMetadata(xml)
          const id = deriveStyleId(meta.id, meta.title)
          styles.push({
            id,
            name: meta.title,
            category: meta.category || 'Custom',
            filename: entry.name,
          })
        } catch {
          // Skip malformed CSL files
        }
      }

      if (styles.length > 0) {
        setUserStyles(styles)
      }
    },

    _saveTimer: null,
    async saveLibrary() {
      const context = this._captureWorkspaceContext()
      clearTimeout(this._saveTimer)
      this._saveTimer = setTimeout(() => this._doSave(context), 500)
    },

    async _doSave(context = this._captureWorkspaceContext()) {
      if (!this._matchesWorkspaceContext(context)) return
      await this._writeLibraries(context)
    },

    async _writeLibraries(context = this._captureWorkspaceContext()) {
      if (!context?.projectDir || !context?.globalConfigDir) return

      const globalLibraryPath = resolveGlobalReferenceLibraryPath(context.globalConfigDir)
      const workbenchStatePath = resolveGlobalReferenceWorkbenchPath(context.globalConfigDir)
      const workspaceCollectionPath = resolveWorkspaceReferenceCollectionPath(context.projectDir)
      try {
        this._markSelfWrite(globalLibraryPath)
        await invoke('write_file', {
          path: globalLibraryPath,
          content: JSON.stringify(this.globalLibrary, null, 2),
        })
        this._markSelfWrite(workbenchStatePath)
        await invoke('write_file', {
          path: workbenchStatePath,
          content: JSON.stringify({
            ...createEmptyGlobalReferenceWorkbench(),
            collections: this.collections,
            savedViews: this.savedViews,
          }, null, 2),
        })
        this._markSelfWrite(workspaceCollectionPath)
        await invoke('write_file', {
          path: workspaceCollectionPath,
          content: JSON.stringify({
            ...createEmptyWorkspaceReferenceCollection(),
            keys: [...this.workspaceKeys],
          }, null, 2),
        })
      } catch (e) {
        console.warn('Failed to save reference library:', e)
      }
    },

    async startWatching(context = this._captureWorkspaceContext()) {
      if (!this._matchesWorkspaceContext(context)) return
      if (this._unlisten) this._unlisten()

      const globalLibraryPath = resolveGlobalReferenceLibraryPath(context.globalConfigDir)
      const workbenchStatePath = resolveGlobalReferenceWorkbenchPath(context.globalConfigDir)
      const workspaceCollectionPath = resolveWorkspaceReferenceCollectionPath(context.projectDir)
      this._unlisten = await listen('fs-change', async (event) => {
        if (!this._matchesWorkspaceContext(context)) return
        const paths = event.payload?.paths || []
        const relevant = paths.filter((path) => (
          path === globalLibraryPath
          || path === workspaceCollectionPath
          || path === workbenchStatePath
        ))
        if (relevant.length === 0) return

        let needsReload = false
        for (const path of relevant) {
          if (this._consumeSelfWrite(path)) continue
          needsReload = true
        }
        if (needsReload) {
          await this.loadLibrary()
        }
      })
    },

    stopWatching() {
      if (this._unlisten) { this._unlisten(); this._unlisten = null }
    },

    cleanup(options = {}) {
      const { preserveGlobalLibrary = false } = options
      clearTimeout(this._saveTimer)
      this._saveTimer = null
      this.stopWatching()
      this._loadGeneration += 1
      this.library = []
      this.keyMap = {}
      if (!preserveGlobalLibrary) {
        this.globalLibrary = []
        this.globalKeyMap = {}
        this.collections = []
        this.savedViews = []
      }
      this.workspaceKeys = []
      this._selfWriteCounts = {}
      this.initialized = false
      this.loading = false
      this.activeKey = null
      this.libraryDetailMode = 'browse'
      this.selectedKeys = new Set()
      this.citationStyle = 'apa'
    },

    async setCitationStyle(style) {
      this.citationStyle = style
      const workspace = useWorkspaceStore()
      if (!workspace.projectDir) return
      try {
        await invoke('write_file', {
          path: `${workspace.projectDir}/citation-style.json`,
          content: JSON.stringify({ citationStyle: style }),
        })
      } catch (e) {
        console.warn('Failed to save citation style:', e)
      }
    },

    _markSelfWrite(path) {
      if (!path) return
      if (!this._selfWriteCounts) this._selfWriteCounts = {}
      this._selfWriteCounts[path] = (this._selfWriteCounts[path] || 0) + 1
    },

    _consumeSelfWrite(path) {
      if (!path || !this._selfWriteCounts?.[path]) return false
      this._selfWriteCounts[path] -= 1
      if (this._selfWriteCounts[path] <= 0) delete this._selfWriteCounts[path]
      return true
    },

    _syncWorkspaceView() {
      this.globalKeyMap = buildKeyMapFromList(this.globalLibrary)
      const workspaceView = buildWorkspaceLibrary(this.globalLibrary, this.globalKeyMap, this.workspaceKeys)
      this.library = workspaceView.library
      this.workspaceKeys = workspaceView.keys
      this.keyMap = buildKeyMapFromList(workspaceView.library)
      if (this.activeKey && this.globalKeyMap[this.activeKey] === undefined) {
        this.activeKey = null
        this.libraryDetailMode = 'browse'
      }
    },

    async _deleteReferenceAsset(path) {
      if (!path) return false
      try {
        const exists = await invoke('path_exists', { path })
        if (!exists) return false
        await invoke('delete_path', { path })
        return true
      } catch (error) {
        console.warn('Failed to delete reference asset:', path, error)
        return false
      }
    },

    async _ensureReferenceStorageReady(context = this._captureWorkspaceContext()) {
      if (!context?.projectDir || !context?.globalConfigDir) return

      const globalPdfsDir = resolveGlobalReferencePdfsDir(context.globalConfigDir)
      const globalFulltextDir = resolveGlobalReferenceFulltextDir(context.globalConfigDir)
      const globalLibraryPath = resolveGlobalReferenceLibraryPath(context.globalConfigDir)
      const workbenchStatePath = resolveGlobalReferenceWorkbenchPath(context.globalConfigDir)
      const workspaceRefsDir = resolveWorkspaceReferencesDir(context.projectDir)
      const workspaceCollectionPath = resolveWorkspaceReferenceCollectionPath(context.projectDir)

      await invoke('create_dir', { path: resolveGlobalReferencesDir(context.globalConfigDir) }).catch(() => {})
      await invoke('create_dir', { path: globalPdfsDir }).catch(() => {})
      await invoke('create_dir', { path: globalFulltextDir }).catch(() => {})
      await invoke('create_dir', { path: workspaceRefsDir }).catch(() => {})

      const globalLibraryExists = await invoke('path_exists', { path: globalLibraryPath }).catch(() => false)
      if (!globalLibraryExists) {
        await invoke('write_file', {
          path: globalLibraryPath,
          content: '[]',
        })
      }

      const workbenchStateExists = await invoke('path_exists', { path: workbenchStatePath }).catch(() => false)
      if (!workbenchStateExists) {
        await invoke('write_file', {
          path: workbenchStatePath,
          content: JSON.stringify(createEmptyGlobalReferenceWorkbench(), null, 2),
        })
      }

      const workspaceCollectionExists = await invoke('path_exists', { path: workspaceCollectionPath }).catch(() => false)
      if (!workspaceCollectionExists) {
        await invoke('write_file', {
          path: workspaceCollectionPath,
          content: JSON.stringify(createEmptyWorkspaceReferenceCollection(), null, 2),
        })
      }
    },

    async _migrateLegacyWorkspaceData(context = this._captureWorkspaceContext(), { globalLibrary = [], workspaceKeys = [] } = {}) {
      const legacyLibraryPath = resolveLegacyWorkspaceReferenceLibraryPath(context.projectDir)
      const legacyRefs = await readJsonArray(legacyLibraryPath)
      if (legacyRefs.length === 0) {
        return {
          globalLibrary,
          workspaceKeys,
          didChange: false,
        }
      }

      const nextGlobalLibrary = [...globalLibrary]
      const nextWorkspaceKeys = [...workspaceKeys]
      const nextGlobalKeyMap = buildKeyMapFromList(nextGlobalLibrary)
      let didChange = false

      for (const legacyRef of legacyRefs) {
        const key = referenceKey(legacyRef) || buildReferenceKey(legacyRef, new Set(Object.keys(nextGlobalKeyMap)))
        let targetRef = nextGlobalKeyMap[key] !== undefined ? nextGlobalLibrary[nextGlobalKeyMap[key]] : null

        if (!targetRef) {
          const nextRef = {
            ...cloneValue(legacyRef),
            _key: key,
            id: key,
          }
          nextGlobalLibrary.push(nextRef)
          nextGlobalKeyMap[key] = nextGlobalLibrary.length - 1
          targetRef = nextRef
          didChange = true
        }

        if (!nextWorkspaceKeys.includes(key)) {
          nextWorkspaceKeys.push(key)
          didChange = true
        }

        const assetChanged = await this._migrateLegacyReferenceAssets(context, targetRef, legacyRef, key)
        if (assetChanged) didChange = true
      }

      return {
        globalLibrary: nextGlobalLibrary,
        workspaceKeys: nextWorkspaceKeys,
        didChange,
      }
    },

    async _migrateLegacyReferenceAssets(context = this._captureWorkspaceContext(), targetRef, legacyRef, key) {
      if (!context?.projectDir || !context?.globalConfigDir) return false

      let changed = false
      const legacyPdfsDir = resolveLegacyWorkspaceReferencePdfsDir(context.projectDir)
      const legacyFulltextDir = resolveLegacyWorkspaceReferenceFulltextDir(context.projectDir)

      if (legacyRef?._pdfFile && !targetRef?._pdfFile) {
        const copied = await copyFileIfPresent(
          `${legacyPdfsDir}/${legacyRef._pdfFile}`,
          resolveGlobalReferencePdfPath(context.globalConfigDir, `${key}.pdf`),
        )
        if (copied) {
          targetRef._pdfFile = `${key}.pdf`
          changed = true
        }
      }

      if (legacyRef?._textFile && !targetRef?._textFile) {
        const copied = await copyFileIfPresent(
          `${legacyFulltextDir}/${legacyRef._textFile}`,
          resolveGlobalReferenceFulltextPath(context.globalConfigDir, `${key}.txt`),
        )
        if (copied) {
          targetRef._textFile = `${key}.txt`
          changed = true
        }
      }

      return changed
    },

    // --- CRUD ---

    addReference(cslJson) {
      if (!cslJson._key) {
        cslJson._key = this.generateKey(cslJson)
      }
      cslJson.id = cslJson._key

      const duplicateAudit = this.auditImportCandidate(cslJson)
      if (duplicateAudit.existingKey) {
        this.addKeyToWorkspace(duplicateAudit.existingKey)
        return {
          key: duplicateAudit.existingKey,
          status: 'duplicate',
          existingKey: duplicateAudit.existingKey,
          matchType: duplicateAudit.matchType,
        }
      }

      if (!cslJson._addedAt) {
        cslJson._addedAt = new Date().toISOString()
      }

      this.globalLibrary.push(cslJson)
      this.workspaceKeys.push(cslJson._key)
      this._syncWorkspaceView()
      this.saveLibrary()
      events.refImport(cslJson._importMethod || 'manual')

      return { key: cslJson._key, status: 'added' }
    },

    addReferences(cslArray) {
      const report = { added: [], duplicates: [], errors: [] }
      for (const csl of cslArray) {
        try {
          const result = this.addReference({ ...csl })
          if (result.status === 'added') report.added.push(result.key)
          else report.duplicates.push(result.existingKey || result.key)
        } catch (e) {
          report.errors.push({ csl, error: e.message })
        }
      }
      return report
    },

    updateReference(key, updates) {
      const idx = this.globalKeyMap[key]
      if (idx === undefined) return false

      Object.assign(this.globalLibrary[idx], updates)

      if (updates._key && updates._key !== key) {
        this.globalLibrary[idx].id = updates._key
        this.workspaceKeys = this.workspaceKeys.map((item) => (item === key ? updates._key : item))
      }

      this._syncWorkspaceView()
      this.saveLibrary()
      return true
    },

    _commitGlobalReferenceMutations(changed = false) {
      if (!changed) return 0
      this._syncWorkspaceView()
      this.saveLibrary()
      return 1
    },

    _commitWorkbenchMutations(changed = false) {
      if (!changed) return 0
      this.saveLibrary()
      return 1
    },

    createCollection(nameRaw = '') {
      const name = String(nameRaw || '').trim()
      if (!name) return { ok: false, error: 'Collection name is required.' }

      const existing = this.collections.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
      if (existing) {
        return { ok: true, collection: existing, duplicated: true }
      }

      const now = new Date().toISOString()
      const collection = {
        id: createWorkbenchId('collection'),
        name,
        createdAt: now,
        updatedAt: now,
      }
      this.collections = [...this.collections, collection].sort((a, b) => a.name.localeCompare(b.name))
      this.saveLibrary()
      return { ok: true, collection, duplicated: false }
    },

    deleteCollection(collectionId = '') {
      const id = String(collectionId || '').trim()
      if (!id) return false
      const exists = this.collections.some((entry) => entry.id === id)
      if (!exists) return false

      this.collections = this.collections.filter((entry) => entry.id !== id)
      let changed = false
      for (const refItem of this.globalLibrary) {
        const current = normalizeReferenceCollections(refItem._collections || [])
        if (!current.includes(id)) continue
        const nextCollections = current.filter((item) => item !== id)
        if (nextCollections.length > 0) refItem._collections = nextCollections
        else delete refItem._collections
        changed = true
      }
      this.savedViews = this.savedViews.map((view) => {
        if (view.filters?.viewId !== `collection:${id}`) return view
        return {
          ...view,
          filters: normalizeSavedViewFilters({
            ...view.filters,
            viewId: 'all',
          }),
          updatedAt: new Date().toISOString(),
        }
      })
      this._commitGlobalReferenceMutations(changed)
      this.saveLibrary()
      return true
    },

    addCollectionToReferences(keys = [], collectionId = '') {
      const id = String(collectionId || '').trim()
      if (!id || !this.collections.some((entry) => entry.id === id)) return 0

      let changed = false
      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        const current = normalizeReferenceCollections(this.globalLibrary[idx]._collections || [])
        if (current.includes(id)) continue
        this.globalLibrary[idx]._collections = [...current, id]
        changed = true
      }
      return this._commitGlobalReferenceMutations(changed)
    },

    removeCollectionFromReferences(keys = [], collectionId = '') {
      const id = String(collectionId || '').trim()
      if (!id) return 0

      let changed = false
      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        const current = normalizeReferenceCollections(this.globalLibrary[idx]._collections || [])
        if (!current.includes(id)) continue
        const nextCollections = current.filter((item) => item !== id)
        if (nextCollections.length > 0) this.globalLibrary[idx]._collections = nextCollections
        else delete this.globalLibrary[idx]._collections
        changed = true
      }
      return this._commitGlobalReferenceMutations(changed)
    },

    toggleCollectionForReference(key, collectionId = '') {
      const id = String(collectionId || '').trim()
      if (!id) return false
      const idx = this.globalKeyMap[key]
      if (idx === undefined) return false
      const current = normalizeReferenceCollections(this.globalLibrary[idx]._collections || [])
      if (current.includes(id)) {
        return this.removeCollectionFromReferences([key], id) > 0
      }
      return this.addCollectionToReferences([key], id) > 0
    },

    createSavedView({ name = '', filters = {} } = {}) {
      const nextName = String(name || '').trim()
      if (!nextName) return { ok: false, error: 'Saved view name is required.' }

      const existing = this.savedViews.find((entry) => entry.name.toLowerCase() === nextName.toLowerCase())
      if (existing) {
        return { ok: true, savedView: existing, duplicated: true }
      }

      const now = new Date().toISOString()
      const savedView = {
        id: createWorkbenchId('view'),
        name: nextName,
        filters: normalizeSavedViewFilters(filters),
        createdAt: now,
        updatedAt: now,
      }
      this.savedViews = [...this.savedViews, savedView].sort((a, b) => a.name.localeCompare(b.name))
      this.saveLibrary()
      return { ok: true, savedView, duplicated: false }
    },

    deleteSavedView(savedViewId = '') {
      const id = String(savedViewId || '').trim()
      if (!id) return false
      const nextViews = this.savedViews.filter((entry) => entry.id !== id)
      if (nextViews.length === this.savedViews.length) return false
      this.savedViews = nextViews
      this.saveLibrary()
      return true
    },

    setReadingState(keys = [], state = '') {
      const normalizedState = normalizeReadingState(state)
      let changed = false
      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        if ((this.globalLibrary[idx]._readingState || '') === normalizedState) continue
        if (normalizedState) this.globalLibrary[idx]._readingState = normalizedState
        else delete this.globalLibrary[idx]._readingState
        changed = true
      }
      return this._commitGlobalReferenceMutations(changed)
    },

    setPriority(keys = [], priority = '') {
      const normalizedPriority = normalizePriority(priority)
      let changed = false
      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        if ((this.globalLibrary[idx]._priority || '') === normalizedPriority) continue
        if (normalizedPriority) this.globalLibrary[idx]._priority = normalizedPriority
        else delete this.globalLibrary[idx]._priority
        changed = true
      }
      return this._commitGlobalReferenceMutations(changed)
    },

    setRating(keys = [], rating = 0) {
      const normalizedRating = normalizeRating(rating)
      let changed = false
      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        const currentRating = normalizeRating(this.globalLibrary[idx]._rating)
        if (currentRating === normalizedRating) continue
        if (normalizedRating > 0) this.globalLibrary[idx]._rating = normalizedRating
        else delete this.globalLibrary[idx]._rating
        changed = true
      }
      return this._commitGlobalReferenceMutations(changed)
    },

    saveReferenceSummary(key, summary = '') {
      const idx = this.globalKeyMap[key]
      if (idx === undefined) return false
      const normalizedSummary = normalizeWorkflowText(summary)
      if ((this.globalLibrary[idx]._summary || '') === normalizedSummary) return false
      if (normalizedSummary) this.globalLibrary[idx]._summary = normalizedSummary
      else delete this.globalLibrary[idx]._summary
      this._syncWorkspaceView()
      this.saveLibrary()
      return true
    },

    saveReferenceReadingNote(key, note = '') {
      const idx = this.globalKeyMap[key]
      if (idx === undefined) return false
      const normalizedNote = normalizeWorkflowText(note)
      if ((this.globalLibrary[idx]._readingNote || '') === normalizedNote) return false
      if (normalizedNote) this.globalLibrary[idx]._readingNote = normalizedNote
      else delete this.globalLibrary[idx]._readingNote
      this._syncWorkspaceView()
      this.saveLibrary()
      return true
    },

    addTagsToReferences(keys = [], tags = []) {
      const normalizedTags = normalizeReferenceTags(tags)
      if (normalizedTags.length === 0) return 0

      let changed = false
      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        const currentTags = normalizeReferenceTags(this.globalLibrary[idx]._tags || [])
        const nextTags = normalizeReferenceTags([...currentTags, ...normalizedTags])
        if (nextTags.join('\u0000') === currentTags.join('\u0000')) continue
        this.globalLibrary[idx]._tags = nextTags
        changed = true
      }

      return this._commitGlobalReferenceMutations(changed)
    },

    replaceTagsForReferences(keys = [], tags = []) {
      const normalizedTags = normalizeReferenceTags(tags)
      let changed = false

      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        const currentTags = normalizeReferenceTags(this.globalLibrary[idx]._tags || [])
        if (normalizedTags.join('\u0000') === currentTags.join('\u0000')) continue
        if (normalizedTags.length > 0) this.globalLibrary[idx]._tags = normalizedTags
        else delete this.globalLibrary[idx]._tags
        changed = true
      }

      return this._commitGlobalReferenceMutations(changed)
    },

    removeTagsFromReferences(keys = [], tags = []) {
      const removeTags = new Set(normalizeReferenceTags(tags))
      if (removeTags.size === 0) return 0

      let changed = false
      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        const currentTags = normalizeReferenceTags(this.globalLibrary[idx]._tags || [])
        if (currentTags.length === 0) continue
        const nextTags = currentTags.filter((tag) => !removeTags.has(tag))
        if (nextTags.length === currentTags.length) continue
        if (nextTags.length > 0) this.globalLibrary[idx]._tags = nextTags
        else delete this.globalLibrary[idx]._tags
        changed = true
      }

      return this._commitGlobalReferenceMutations(changed)
    },

    renameReferenceKey(oldKey, nextKeyRaw) {
      const idx = this.globalKeyMap[oldKey]
      if (idx === undefined) {
        return { ok: false, error: 'Reference not found' }
      }

      const nextKey = normalizeEditableReferenceKey(nextKeyRaw)
      if (!nextKey) {
        return { ok: false, error: 'Citation key is required.' }
      }
      if (!EDITABLE_REFERENCE_KEY_RE.test(nextKey)) {
        return { ok: false, error: 'Citation key can only use letters, numbers, _, -, :, and .' }
      }
      if (nextKey === oldKey) {
        return { ok: true, key: oldKey, changed: false }
      }

      const duplicate = this.globalLibrary.some((ref, refIdx) => (
        refIdx !== idx && referenceKey(ref) === nextKey
      ))
      if (duplicate) {
        return { ok: false, error: 'Citation key already exists.' }
      }

      this.globalLibrary[idx]._key = nextKey
      this.globalLibrary[idx].id = nextKey
      this.workspaceKeys = this.workspaceKeys.map((item) => (item === oldKey ? nextKey : item))

      if (this.activeKey === oldKey) {
        this.activeKey = nextKey
      }
      if (this.selectedKeys.has(oldKey)) {
        const nextSelected = new Set(this.selectedKeys)
        nextSelected.delete(oldKey)
        nextSelected.add(nextKey)
        this.selectedKeys = nextSelected
      }

      this._syncWorkspaceView()
      this.saveLibrary()
      return { ok: true, key: nextKey, oldKey, changed: true }
    },

    mergeReference(existingKey, importedRef, fieldSelections = {}) {
      const existingRef = this.getByKey(existingKey)
      if (!existingRef || !importedRef) return { status: 'missing' }

      const merged = {
        ...cloneValue(existingRef),
      }

      for (const field of mergeableFieldNames(existingRef, importedRef)) {
        if (fieldSelections[field] !== 'incoming') continue
        if (!hasValue(importedRef[field])) continue
        merged[field] = cloneValue(importedRef[field])
      }

      this.updateReference(existingKey, merged)
      return {
        status: 'merged',
        key: existingKey,
        ref: this.getByKey(existingKey),
      }
    },

    addKeyToWorkspace(key) {
      if (!key || this.workspaceKeys.includes(key)) return false
      this.workspaceKeys.push(key)
      this._syncWorkspaceView()
      this.saveLibrary()
      return true
    },

    focusReferenceInLibrary(key, options = {}) {
      if (!key) return false
      const { mode = 'browse', addToWorkspace = false } = options || {}
      if (addToWorkspace) {
        this.addKeyToWorkspace(key)
      }
      this.activeKey = key
      this.libraryDetailMode = mode === 'edit' ? 'edit' : 'browse'
      const editorStore = useEditorStore()
      editorStore.openLibrarySurface('global')
      return true
    },

    closeLibraryDetailMode() {
      this.libraryDetailMode = 'browse'
    },

    hasKeyInWorkspace(key) {
      return !!key && this.workspaceKeys.includes(key)
    },

    removeReference(key) {
      if (!this.workspaceKeys.includes(key)) return false
      this.workspaceKeys = this.workspaceKeys.filter((item) => item !== key)
      this._syncWorkspaceView()

      if (this.activeKey === key) {
        this.activeKey = null
        this.libraryDetailMode = 'browse'
      }
      this.selectedKeys.delete(key)

      this.saveLibrary()
      return true
    },

    removeReferences(keys) {
      for (const key of keys) {
        this.removeReference(key)
      }
    },

    async removeReferenceFromGlobal(key) {
      const removed = await this.removeReferencesFromGlobal([key])
      return removed.length > 0
    },

    async removeReferencesFromGlobal(keys) {
      const uniqueKeys = Array.from(new Set((keys || []).filter(Boolean)))
      if (uniqueKeys.length === 0) return []

      const workspace = useWorkspaceStore()
      const removeSet = new Set()
      const assetPaths = []

      for (const key of uniqueKeys) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        const ref = this.globalLibrary[idx]
        removeSet.add(key)
        if (workspace.globalConfigDir && ref?._pdfFile) {
          assetPaths.push(resolveGlobalReferencePdfPath(workspace.globalConfigDir, ref._pdfFile))
        }
        if (workspace.globalConfigDir && ref?._textFile) {
          assetPaths.push(resolveGlobalReferenceFulltextPath(workspace.globalConfigDir, ref._textFile))
        }
      }

      if (removeSet.size === 0) return []

      this.globalLibrary = this.globalLibrary.filter((ref) => !removeSet.has(referenceKey(ref)))
      this.workspaceKeys = this.workspaceKeys.filter((key) => !removeSet.has(key))
      if (this.activeKey && removeSet.has(this.activeKey)) {
        this.activeKey = null
        this.libraryDetailMode = 'browse'
      }
      for (const key of removeSet) {
        this.selectedKeys.delete(key)
      }

      this._syncWorkspaceView()

      for (const path of assetPaths) {
        await this._deleteReferenceAsset(path)
      }

      await this._writeLibraries()
      return [...removeSet]
    },

    // --- Search ---

    searchRefs(query) {
      if (!query || !query.trim()) return this.sortedLibrary
      return filterReferences(this.library, query)
    },

    searchGlobalRefs(query) {
      if (!query || !query.trim()) return this.sortedGlobalLibrary
      return sortReferences(filterReferences(this.globalLibrary, query), this.sortBy, this.sortDir)
    },

    // --- Key generation ---

    generateKey(cslJson) {
      return buildReferenceKey(cslJson, new Set(Object.keys(this.globalKeyMap)))
    },

    // --- Dedup ---

    findDuplicate(cslJson) {
      return this.auditImportCandidate(cslJson).existingKey
    },

    isDuplicate(cslJson) {
      return this.findDuplicate(cslJson) !== null
    },

    auditImportCandidate(cslJson) {
      const incomingDoi = normalizeDoi(cslJson?.DOI)
      if (incomingDoi) {
        const strong = this.globalLibrary.find((ref) => normalizeDoi(ref?.DOI) === incomingDoi)
        if (strong) {
          return {
            existingKey: strong._key,
            matchType: 'strong',
            reason: 'doi',
          }
        }
      }

      const incomingTitle = normalizeTitle(cslJson?.title)
      const incomingAuthor = normalizeAuthorToken(cslJson?.author?.[0])
      const incomingYear = issuedYear(cslJson)

      if (incomingTitle && incomingAuthor && incomingYear) {
        const possible = this.globalLibrary.find((ref) => (
          normalizeTitle(ref?.title) === incomingTitle &&
          normalizeAuthorToken(ref?.author?.[0]) === incomingAuthor &&
          issuedYear(ref) === incomingYear
        ))
        if (possible) {
          return {
            existingKey: possible._key,
            matchType: 'possible',
            reason: 'title-author-year',
          }
        }
      }

      return {
        existingKey: null,
        matchType: null,
        reason: null,
      }
    },

    // --- PDF storage ---

    async storePdf(key, sourcePath) {
      const workspace = useWorkspaceStore()
      if (!workspace.globalConfigDir) return

      const pdfsDir = resolveGlobalReferencePdfsDir(workspace.globalConfigDir)
      const textDir = resolveGlobalReferenceFulltextDir(workspace.globalConfigDir)
      const destPdf = resolveGlobalReferencePdfPath(workspace.globalConfigDir, `${key}.pdf`)

      try {
        await invoke('create_dir', { path: pdfsDir }).catch(() => {})
        await invoke('copy_file', { src: sourcePath, dest: destPdf })
        this.updateReference(key, { _pdfFile: `${key}.pdf` })
      } catch (e) {
        console.warn('Failed to store PDF:', e)
      }

      // Extract text for full-text search
      try {
        const text = await extractTextFromPdf(destPdf)
        if (text) {
          await invoke('create_dir', { path: textDir }).catch(() => {})
          await invoke('write_file', {
            path: resolveGlobalReferenceFulltextPath(workspace.globalConfigDir, `${key}.txt`),
            content: text,
          })
          this.updateReference(key, { _textFile: `${key}.txt` })
        }
      } catch (e) {
        console.warn('Failed to extract PDF text:', e)
      }
    },

    // --- Export ---

    exportBibTeX(keys) {
      const refs = keys
        ? keys.map(k => this.getByKey(k)).filter(Boolean)
        : this.library

      return refs.map(ref => {
        const type = cslTypeToBibtex(ref.type)
        const key = ref._key || ref.id
        const fields = []

        if (ref.title) fields.push(`  title = {${ref.title}}`)
        if (ref.author) {
          const authors = ref.author.map(a =>
            `${a.family || ''}${a.given ? ', ' + a.given : ''}`
          ).join(' and ')
          fields.push(`  author = {${authors}}`)
        }
        if (ref.issued?.['date-parts']?.[0]?.[0]) {
          fields.push(`  year = {${ref.issued['date-parts'][0][0]}}`)
        }
        if (ref['container-title']) fields.push(`  journal = {${ref['container-title']}}`)
        if (ref.volume) fields.push(`  volume = {${ref.volume}}`)
        if (ref.issue) fields.push(`  number = {${ref.issue}}`)
        if (ref.page) fields.push(`  pages = {${ref.page}}`)
        if (ref.DOI) fields.push(`  doi = {${ref.DOI}}`)
        if (ref.publisher) fields.push(`  publisher = {${ref.publisher}}`)

        return `@${type}{${key},\n${fields.join(',\n')}\n}`
      }).join('\n\n')
    },

    exportRis(keys) {
      const refs = keys
        ? keys.map(k => this.getByKey(k)).filter(Boolean)
        : this.library

      return refs.map(ref => {
        const lines = []
        lines.push(`TY  - ${cslTypeToRis(ref.type)}`)

        if (ref.title) lines.push(`TI  - ${ref.title}`)
        if (ref.author) {
          for (const a of ref.author) {
            const name = a.family && a.given ? `${a.family}, ${a.given}` : (a.family || a.given || '')
            if (name) lines.push(`AU  - ${name}`)
          }
        }
        if (ref.issued?.['date-parts']?.[0]) {
          const parts = ref.issued['date-parts'][0]
          const yr = parts[0]
          const mo = parts[1] ? String(parts[1]).padStart(2, '0') : ''
          const dy = parts[2] ? String(parts[2]).padStart(2, '0') : ''
          lines.push(`PY  - ${yr}`)
          if (mo) lines.push(`DA  - ${yr}/${mo}${dy ? '/' + dy : ''}`)
        }
        if (ref['container-title']) lines.push(`JO  - ${ref['container-title']}`)
        if (ref.volume) lines.push(`VL  - ${ref.volume}`)
        if (ref.issue) lines.push(`IS  - ${ref.issue}`)
        if (ref.page) {
          const [sp, ep] = ref.page.split('-')
          lines.push(`SP  - ${sp.trim()}`)
          if (ep) lines.push(`EP  - ${ep.trim()}`)
        }
        if (ref.DOI) lines.push(`DO  - ${ref.DOI}`)
        if (ref.URL) lines.push(`UR  - ${ref.URL}`)
        if (ref.abstract) lines.push(`AB  - ${ref.abstract}`)
        if (ref.publisher) lines.push(`PB  - ${ref.publisher}`)
        if (ref.ISSN) lines.push(`SN  - ${ref.ISSN}`)
        else if (ref.ISBN) lines.push(`SN  - ${ref.ISBN}`)
        if (ref._tags?.length) {
          for (const tag of ref._tags) lines.push(`KW  - ${tag}`)
        }
        lines.push('ER  -')

        return lines.join('\n')
      }).join('\n\n')
    },

    pdfPathForKey(key) {
      const workspace = useWorkspaceStore()
      const ref = this.getByKey(key)
      if (!workspace.globalConfigDir || !ref?._pdfFile) return null
      return resolveGlobalReferencePdfPath(workspace.globalConfigDir, ref._pdfFile)
    },

    fulltextPathForKey(key) {
      const workspace = useWorkspaceStore()
      const ref = this.getByKey(key)
      const fileName = ref?._textFile || (key ? `${key}.txt` : '')
      if (!workspace.globalConfigDir || !fileName) return null
      return resolveGlobalReferenceFulltextPath(workspace.globalConfigDir, fileName)
    },
  },
})

function cslTypeToRis(type) {
  const map = {
    'article-journal': 'JOUR',
    'book': 'BOOK',
    'chapter': 'CHAP',
    'paper-conference': 'CONF',
    'report': 'RPRT',
    'thesis': 'THES',
    'webpage': 'ELEC',
    'article-magazine': 'MGZN',
    'article-newspaper': 'NEWS',
    'manuscript': 'UNPB',
    'legislation': 'BILL',
    'legal_case': 'CASE',
    'dataset': 'DATA',
    'patent': 'PAT',
    'motion_picture': 'VIDEO',
    'song': 'SOUND',
    'map': 'MAP',
  }
  return map[type] || 'GEN'
}

function cslTypeToBibtex(type) {
  const map = {
    'article-journal': 'article',
    'paper-conference': 'inproceedings',
    'book': 'book',
    'chapter': 'incollection',
    'thesis': 'phdthesis',
    'report': 'techreport',
    'webpage': 'misc',
  }
  return map[type] || 'misc'
}
