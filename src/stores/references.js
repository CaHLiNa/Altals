import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { events } from '../services/telemetry'
import { useWorkspaceStore } from './workspace'
import { useEditorStore } from './editor'
import { useFilesStore } from './files'
import { extractTextFromPdf } from '../utils/pdfMetadata'
import { buildReferenceKey } from '../utils/referenceKeys'
import {
  addReferenceTags,
  normalizeReferenceCollections,
  normalizeReferenceTags,
  removeReferenceTags,
  replaceReferenceTags,
  sanitizeReferenceRecord,
  updateReferenceWorkflowField,
} from '../domains/reference/referenceMetadata'
import {
  addReferenceCollection,
  createReferenceSavedView,
  createReferenceWorkbenchCollection,
  deleteReferenceSavedView,
  deleteReferenceWorkbenchCollection,
  sanitizeReferenceWorkbenchState,
  toggleReferenceCollection,
  removeReferenceCollection,
} from '../domains/reference/referenceWorkbench'
import {
  exportReferencesAsBibTeX,
  exportReferencesAsRis,
  searchReferences,
  searchSortedReferences,
  sortReferences,
} from '../domains/reference/referenceSearchExport'
import {
  auditReferenceImportCandidate,
  buildMergedReference,
  cloneReferenceValue,
  prepareReferenceImport,
} from '../domains/reference/referenceImportMerge'
import {
  copyFileIfPresent,
  deleteLegacyWorkspaceReferenceLibrary,
  ensureReferenceStorageReady,
  loadPersistedCitationStyle,
  loadReferenceUserStyles,
  readFileIfExists,
  readJsonArray,
  readWorkspaceReferenceCollection,
} from '../domains/reference/referenceStorageIO'
import {
  createEmptyGlobalReferenceWorkbench,
  createEmptyWorkspaceReferenceCollection,
  parseGlobalReferenceWorkbench,
  resolveGlobalReferenceFulltextPath,
  resolveGlobalReferenceLibraryPath,
  resolveGlobalReferencePdfPath,
  resolveGlobalReferencePdfsDir,
  resolveGlobalReferenceWorkbenchPath,
  resolveGlobalReferenceFulltextDir,
  resolveLegacyWorkspaceReferenceFulltextDir,
  resolveLegacyWorkspaceReferenceLibraryPath,
  resolveLegacyWorkspaceReferencePdfsDir,
  resolveWorkspaceReferenceCollectionPath,
  resolveWorkspaceReferencesDir,
} from '../services/referenceLibraryPaths'

const EDITABLE_REFERENCE_KEY_RE = /^[A-Za-z][A-Za-z0-9:_.-]*$/

function normalizeEditableReferenceKey(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
}

function referenceKey(ref = {}) {
  return ref?._key || ref?.id || null
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
          await ensureReferenceStorageReady(context)
          if (this._isLoadStale(context)) return

          let globalLibrary = await readJsonArray(resolveGlobalReferenceLibraryPath(context.globalConfigDir))
          if (this._isLoadStale(context)) return

          let workspaceCollection = await readWorkspaceReferenceCollection(resolveWorkspaceReferenceCollectionPath(context.projectDir))
          if (this._isLoadStale(context)) return

          const workbenchState = sanitizeReferenceWorkbenchState(
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

          if (migration.legacyLibraryFound) {
            await deleteLegacyWorkspaceReferenceLibrary(context)
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

        const citationStyle = await loadPersistedCitationStyle(context.projectDir)
        if (citationStyle) this.citationStyle = citationStyle

        if (this._isLoadStale(context)) return

        await loadReferenceUserStyles(context.projectDir).catch(() => {})

        if (this._isLoadStale(context)) return

        this.initialized = true
        await this.startWatching(context)
      } finally {
        if (!this._isLoadStale(context)) {
          this.loading = false
        }
      }
    },

    _saveTimer: null,
    async saveLibrary(options = {}) {
      const { immediate = false } = options || {}
      const context = this._captureWorkspaceContext()
      clearTimeout(this._saveTimer)
      this._saveTimer = null

      if (immediate) {
        await this._doSave(context)
        return
      }

      this._saveTimer = setTimeout(() => {
        this._saveTimer = null
        void this._doSave(context)
      }, 500)
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

    async _migrateLegacyWorkspaceData(context = this._captureWorkspaceContext(), { globalLibrary = [], workspaceKeys = [] } = {}) {
      const legacyLibraryPath = resolveLegacyWorkspaceReferenceLibraryPath(context.projectDir)
      const legacyRefs = await readJsonArray(legacyLibraryPath)
      if (legacyRefs.length === 0) {
        return {
          globalLibrary,
          workspaceKeys,
          didChange: false,
          legacyLibraryFound: false,
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
            ...cloneReferenceValue(legacyRef),
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
        legacyLibraryFound: true,
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
      const nextRef = prepareReferenceImport(cslJson, {
        generateKey: (ref) => this.generateKey(ref),
      })

      const duplicateAudit = this.auditImportCandidate(nextRef)
      if (duplicateAudit.existingKey) {
        this.addKeyToWorkspace(duplicateAudit.existingKey)
        return {
          key: duplicateAudit.existingKey,
          status: 'duplicate',
          existingKey: duplicateAudit.existingKey,
          matchType: duplicateAudit.matchType,
        }
      }

      if (!nextRef._addedAt) {
        nextRef._addedAt = new Date().toISOString()
      }

      this.globalLibrary.push(nextRef)
      this.workspaceKeys.push(nextRef._key)
      this._syncWorkspaceView()
      this.saveLibrary()
      events.refImport(nextRef._importMethod || 'manual')

      return { key: nextRef._key, status: 'added' }
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
      const result = createReferenceWorkbenchCollection(this.collections, nameRaw)
      if (!result.ok) return result
      if (result.duplicated) {
        return { ok: true, collection: result.collection, duplicated: true }
      }
      this.collections = result.collections
      this.saveLibrary()
      return { ok: true, collection: result.collection, duplicated: false }
    },

    deleteCollection(collectionId = '') {
      const result = deleteReferenceWorkbenchCollection({
        collections: this.collections,
        globalLibrary: this.globalLibrary,
        savedViews: this.savedViews,
        collectionId,
      })
      if (!result.ok) return false

      this.collections = result.collections
      this.savedViews = result.savedViews
      this._commitGlobalReferenceMutations(result.changedGlobalLibrary)
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
        changed = addReferenceCollection(this.globalLibrary[idx], id) || changed
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
        changed = removeReferenceCollection(this.globalLibrary[idx], id) || changed
      }
      return this._commitGlobalReferenceMutations(changed)
    },

    toggleCollectionForReference(key, collectionId = '') {
      const id = String(collectionId || '').trim()
      if (!id) return false
      const idx = this.globalKeyMap[key]
      if (idx === undefined) return false
      const changed = toggleReferenceCollection(this.globalLibrary[idx], id)
      if (!changed) return false
      this._syncWorkspaceView()
      this.saveLibrary()
      return true
    },

    createSavedView({ name = '', filters = {} } = {}) {
      const result = createReferenceSavedView(this.savedViews, { name, filters })
      if (!result.ok) return result
      if (result.duplicated) {
        return { ok: true, savedView: result.savedView, duplicated: true }
      }
      this.savedViews = result.savedViews
      this.saveLibrary()
      return { ok: true, savedView: result.savedView, duplicated: false }
    },

    deleteSavedView(savedViewId = '') {
      const result = deleteReferenceSavedView(this.savedViews, savedViewId)
      if (!result.ok) return false
      this.savedViews = result.savedViews
      this.saveLibrary()
      return true
    },

    setReadingState(keys = [], state = '') {
      let changed = false
      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        changed = updateReferenceWorkflowField(this.globalLibrary[idx], '_readingState', state) || changed
      }
      return this._commitGlobalReferenceMutations(changed)
    },

    setPriority(keys = [], priority = '') {
      let changed = false
      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        changed = updateReferenceWorkflowField(this.globalLibrary[idx], '_priority', priority) || changed
      }
      return this._commitGlobalReferenceMutations(changed)
    },

    setRating(keys = [], rating = 0) {
      let changed = false
      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        changed = updateReferenceWorkflowField(this.globalLibrary[idx], '_rating', rating) || changed
      }
      return this._commitGlobalReferenceMutations(changed)
    },

    saveReferenceSummary(key, summary = '') {
      const idx = this.globalKeyMap[key]
      if (idx === undefined) return false
      if (!updateReferenceWorkflowField(this.globalLibrary[idx], '_summary', summary)) return false
      this._syncWorkspaceView()
      this.saveLibrary()
      return true
    },

    saveReferenceReadingNote(key, note = '') {
      const idx = this.globalKeyMap[key]
      if (idx === undefined) return false
      if (!updateReferenceWorkflowField(this.globalLibrary[idx], '_readingNote', note)) return false
      this._syncWorkspaceView()
      this.saveLibrary()
      return true
    },

    addTagsToReferences(keys = [], tags = []) {
      let changed = false
      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        changed = addReferenceTags(this.globalLibrary[idx], tags) || changed
      }

      return this._commitGlobalReferenceMutations(changed)
    },

    replaceTagsForReferences(keys = [], tags = []) {
      let changed = false

      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        changed = replaceReferenceTags(this.globalLibrary[idx], tags) || changed
      }

      return this._commitGlobalReferenceMutations(changed)
    },

    removeTagsFromReferences(keys = [], tags = []) {
      let changed = false
      for (const key of new Set((keys || []).filter(Boolean))) {
        const idx = this.globalKeyMap[key]
        if (idx === undefined) continue
        changed = removeReferenceTags(this.globalLibrary[idx], tags) || changed
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

      const merged = buildMergedReference(existingRef, importedRef, fieldSelections)
      if (!merged) return { status: 'missing' }

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
      return searchReferences(this.library, query)
    },

    searchGlobalRefs(query) {
      if (!query || !query.trim()) return this.sortedGlobalLibrary
      return searchSortedReferences(this.globalLibrary, query, this.sortBy, this.sortDir)
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
      return auditReferenceImportCandidate(this.globalLibrary, cslJson)
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
        ? keys.map((key) => this.getByKey(key)).filter(Boolean)
        : this.library

      return exportReferencesAsBibTeX(refs)
    },

    exportRis(keys) {
      const refs = keys
        ? keys.map((key) => this.getByKey(key)).filter(Boolean)
        : this.library

      return exportReferencesAsRis(refs)
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
