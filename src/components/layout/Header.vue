<template>
  <header
    class="header-root"
    data-tauri-drag-region
    :style="headerStyle"
  >
    <div class="header-nav-cluster" data-tauri-drag-region>
      <div class="header-brand-mark">
        <span class="header-brand-kicker">Altals</span>
        <span class="header-brand-copy">{{ workspace.isOpen ? t('Research workspace') : t('Local-first academic workspace') }}</span>
      </div>

      <div v-if="workspace.isOpen" class="header-workflow-nav">
        <button
          type="button"
          class="header-workflow-button"
          :class="{ 'is-active': isProjectHomeActive }"
          :title="t('Open project home')"
          @click="openProjectHome"
        >
          <IconFolderOpen :size="13" :stroke-width="1.7" />
          <span>{{ t('Project') }}</span>
        </button>
        <button
          type="button"
          class="header-workflow-button"
          :class="{ 'is-active': isWritingActive }"
          :title="t('Return to the current writing context')"
          @click="focusWritingWorkspace"
        >
          <IconFileText :size="13" :stroke-width="1.7" />
          <span>{{ t('Writing') }}</span>
        </button>
        <button
          type="button"
          class="header-workflow-button"
          :class="{ 'is-active': workspace.isLibrarySurface }"
          :title="t('Open evidence and references')"
          @click="openLibrary"
        >
          <IconBook2 :size="13" :stroke-width="1.7" />
          <span>{{ t('Evidence') }}</span>
        </button>
        <button
          type="button"
          class="header-workflow-button"
          :class="{ 'is-active': workspace.isAiSurface || aiDrawer.open }"
          :title="t('Open assist workspace')"
          @click="openAiWorkbench"
        >
          <IconSparkles :size="13" :stroke-width="1.7" />
          <span>{{ t('Assist') }}</span>
        </button>
      </div>
    </div>

    <button
      v-if="workspace.isOpen"
      type="button"
      class="header-context-card"
      :title="t('Quick open ({shortcut})', { shortcut: `${modKey}+P` })"
      @click="focusSearch"
    >
      <div class="header-context-kicker">{{ workspaceName }}</div>
      <div class="header-context-title-row">
        <span class="header-context-title">{{ activeContextTitle }}</span>
        <span
          v-if="buildSummaryLabel"
          class="header-state-pill"
          :class="`is-${buildSummaryTone}`"
        >
          {{ buildSummaryLabel }}
        </span>
      </div>
      <div class="header-context-meta">
        <span class="truncate">{{ activeContextMeta }}</span>
        <span class="header-context-shortcut">{{ modKey }}+P</span>
      </div>
    </button>

    <div v-else class="header-context-card is-launcher" data-tauri-drag-region>
      <div class="header-context-kicker">{{ t('Project-first workflow') }}</div>
      <div class="header-context-title-row">
        <span class="header-context-title">{{ t('Open a local project and continue the work.') }}</span>
      </div>
      <div class="header-context-meta">
        <span>{{ t('Writing, evidence, build, recovery, and assist stay in one local workspace.') }}</span>
      </div>
    </div>

    <div class="header-controls" data-tauri-drag-region>
      <div v-if="workspace.isOpen" class="header-status-strip">
        <button
          type="button"
          class="header-status-button"
          :class="`is-${changeSummaryTone}`"
          :title="changeSummaryTooltip"
          @click="$emit('open-workspace-snapshots')"
        >
          <span class="header-status-label">{{ t('Changes') }}</span>
          <span class="header-status-value">{{ changeSummaryLabel }}</span>
        </button>
        <button
          type="button"
          class="header-status-button is-neutral"
          :title="t('Open saved versions')"
          @click="$emit('open-workspace-snapshots')"
        >
          <span class="header-status-label">{{ t('Recovery') }}</span>
          <span class="header-status-value">{{ t('Saved versions') }}</span>
        </button>
      </div>

      <button
        v-if="workspace.isOpen"
        class="header-chrome-button"
        :class="{ 'is-active': workspace.leftSidebarOpen }"
        @click="workspace.toggleLeftSidebar()"
        :title="t('Toggle sidebar ({shortcut})', { shortcut: `${modKey}+B` })"
      >
        <component
          :is="workspace.leftSidebarOpen ? IconLayoutSidebarFilled : IconLayoutSidebar"
          :size="15"
          :stroke-width="1.5"
        />
      </button>
      <button
        v-if="workspace.isOpen && !workspace.isAiSurface"
        class="header-chrome-button"
        :class="{ 'is-accent': aiLauncherOpen }"
        @click="handleOpenAi"
        :title="aiButtonTitle"
      >
        <IconSparkles :size="15" :stroke-width="1.5" />
      </button>
      <button
        v-if="workspace.isOpen"
        class="header-chrome-button"
        @click="focusSearch"
        :title="t('Quick open ({shortcut})', { shortcut: `${modKey}+P` })"
      >
        <IconSearch :size="15" :stroke-width="1.5" />
      </button>
      <button
        class="header-chrome-button"
        @click="$emit('open-settings')"
        :title="t('Settings ({shortcut})', { shortcut: `${modKey}+,` })"
      >
        <IconSettings :size="15" :stroke-width="1.5" />
      </button>
    </div>
  </header>

  <Teleport to="body">
    <template v-if="showResults">
      <div class="header-command-overlay" @click="closeSearchPalette"></div>
      <div class="header-command-shell" :style="{ top: `${HEADER_HEIGHT + 12}px` }">
        <div class="header-command-panel">
          <div
            class="header-command-input-wrap"
            :style="{
              borderColor: searchFocused ? 'var(--fg-muted)' : 'var(--border)',
            }"
          >
            <IconSearch
              :size="HEADER_SEARCH_ICON_SIZE"
              :stroke-width="1.5"
              class="shrink-0"
              :style="{ color: searchFocused ? 'var(--fg-secondary)' : 'var(--fg-muted)' }"
            />
            <input
              ref="searchInputRef"
              v-model="query"
              class="header-command-input"
              :style="{ height: `${HEADER_SEARCH_INPUT_HEIGHT}px` }"
              :placeholder="searchPlaceholder"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              @focus="onFocus"
              @blur="onBlur"
              @keydown="onSearchKeydown"
            />
            <kbd class="header-command-kbd">
              {{ modKey }}+P
            </kbd>
          </div>

          <div class="header-command-results">
            <SearchResults
              ref="searchResultsRef"
              :query="query"
              @select-file="onSelectFile"
              @select-citation="onSelectCitation"
              @select-chat="onSelectChat"
              @select-typst-symbol="onSelectTypstSymbol"
              @mousedown.prevent
            />
          </div>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<script setup>
import { ref, computed, nextTick, defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEditorStore } from '../../stores/editor'
import { useAiDrawerStore } from '../../stores/aiDrawer'
import { useAiWorkbenchStore } from '../../stores/aiWorkbench'
import { useToastStore } from '../../stores/toast'
import { useReferencesStore } from '../../stores/references'
import { useReviewsStore } from '../../stores/reviews'
import { useDocumentWorkflowStore } from '../../stores/documentWorkflow'
import { useLatexStore } from '../../stores/latex'
import { useTypstStore } from '../../stores/typst'
import {
  IconBook2,
  IconFileText,
  IconFolderOpen,
  IconLayoutSidebar,
  IconLayoutSidebarFilled,
  IconSearch,
  IconSettings,
  IconSparkles,
} from '@tabler/icons-vue'
import {
  isAiWorkbenchPath,
  isChatTab,
  isLibraryPath,
  isNewTab,
  isPreviewPath,
  isReferencePath,
  previewSourcePathFromPath,
} from '../../utils/fileTypes'
import { isMac, modKey } from '../../platform'
import { useI18n } from '../../i18n'
import { insertCitationWithAssist } from '../../services/latexCitationAssist'
import { tinymistRangeToOffsets } from '../../services/tinymist/textEdits'

const SearchResults = defineAsyncComponent(() => import('../SearchResults.vue'))

const emit = defineEmits(['open-settings', 'open-workspace-snapshots'])

const workspace = useWorkspaceStore()
const editorStore = useEditorStore()
const aiDrawer = useAiDrawerStore()
const aiWorkbench = useAiWorkbenchStore()
const toastStore = useToastStore()
const referencesStore = useReferencesStore()
const reviews = useReviewsStore()
const workflowStore = useDocumentWorkflowStore()
const latexStore = useLatexStore()
const typstStore = useTypstStore()
const { t } = useI18n()
const isMacDesktop = isMac
  && typeof window !== 'undefined'
  && !!window.__TAURI_INTERNALS__
const isTauriDesktop = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__

const HEADER_HEIGHT = 56
const HEADER_SEARCH_INPUT_HEIGHT = 24
const HEADER_SEARCH_ICON_SIZE = 14
const DEFAULT_HEADER_SIDE_PADDING = 14
const MAC_TRAFFIC_LIGHT_SAFE_PADDING = 78
const EDITOR_WAIT_TIMEOUT_MS = 1500
const FULLSCREEN_HEADER_LEFT_PADDING = 14

function toPx(value) {
  return `${Math.round(value * 100) / 100}px`
}

function fileName(path = '') {
  return String(path || '').split('/').pop() || path
}

function isContextCandidate(path) {
  return !!path
    && !isChatTab(path)
    && !isLibraryPath(path)
    && !isAiWorkbenchPath(path)
    && !isReferencePath(path)
    && !isNewTab(path)
}

function countProblemsBySeverity(problems = []) {
  const entries = Array.isArray(problems) ? problems : []
  return {
    errorCount: entries.filter((entry) => entry?.severity === 'error').length,
    warningCount: entries.filter((entry) => entry?.severity === 'warning').length,
  }
}

const appZoomScale = computed(() => {
  const percent = Math.max(Number(workspace.appZoomPercent) || 100, 80)
  return percent / 100
})

const isNativeFullscreen = ref(false)
let unlistenWindowResize = null

const macHeaderLeftPadding = computed(() => {
  if (!isMac) return DEFAULT_HEADER_SIDE_PADDING
  if (!isMacDesktop) return MAC_TRAFFIC_LIGHT_SAFE_PADDING
  if (isNativeFullscreen.value) return FULLSCREEN_HEADER_LEFT_PADDING / appZoomScale.value
  return MAC_TRAFFIC_LIGHT_SAFE_PADDING / appZoomScale.value
})

const headerStyle = computed(() => ({
  gridTemplateColumns: 'auto minmax(320px, 1fr) auto',
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 92%, transparent), color-mix(in srgb, var(--bg-primary) 88%, transparent))',
  borderBottom: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
  paddingLeft: isMac ? toPx(macHeaderLeftPadding.value) : toPx(DEFAULT_HEADER_SIDE_PADDING),
  paddingRight: '12px',
  height: `${HEADER_HEIGHT}px`,
}))

const searchInputRef = ref(null)
const searchResultsRef = ref(null)
const query = ref('')
const searchFocused = ref(false)
const searchOpen = ref(false)

const showResults = computed(() => searchOpen.value)
const aiLauncherOpen = computed(() => aiDrawer.open)
const aiButtonTitle = computed(() => (aiDrawer.open ? t('Close Quick AI') : t('Open Quick AI')))

const searchPlaceholder = computed(() => t('Open document, citation, or AI conversation...'))

const workspaceName = computed(() => {
  const path = workspace.path || ''
  return path ? fileName(path) : t('No project open')
})

const activeContextPath = computed(() => {
  const activeTab = editorStore.activeTab
  if (isPreviewPath(activeTab)) {
    return previewSourcePathFromPath(activeTab) || ''
  }
  if (isContextCandidate(activeTab)) {
    return activeTab
  }
  return editorStore.preferredContextPath || ''
})

const activeContextTitle = computed(() => (
  activeContextPath.value
    ? fileName(activeContextPath.value)
    : t('Project home and recent work')
))

const activeContextMeta = computed(() => {
  if (!activeContextPath.value) {
    return t('Continue recent documents, build review, recovery, and assist from one place.')
  }
  if (!workspace.path || !activeContextPath.value.startsWith(`${workspace.path}/`)) {
    return activeContextPath.value
  }
  return activeContextPath.value.slice(workspace.path.length + 1)
})

const workflowOptions = computed(() => ({
  editorStore,
  workspace,
  latexStore,
  typstStore,
  referencesStore,
  t,
}))

const activeWorkflowState = computed(() => (
  activeContextPath.value
    ? workflowStore.getUiStateForFile(activeContextPath.value, workflowOptions.value)
    : null
))

const activeWorkflowProblems = computed(() => (
  activeContextPath.value
    ? workflowStore.getProblemsForFile(activeContextPath.value, workflowOptions.value)
    : []
))

const buildSummaryTone = computed(() => {
  const uiState = activeWorkflowState.value
  const { errorCount, warningCount } = countProblemsBySeverity(activeWorkflowProblems.value)
  if (uiState?.phase === 'compiling' || uiState?.phase === 'rendering') return 'running'
  if (errorCount > 0) return 'error'
  if (warningCount > 0) return 'warning'
  if (uiState?.phase === 'ready') return 'success'
  return 'neutral'
})

const buildSummaryLabel = computed(() => {
  const uiState = activeWorkflowState.value
  const { errorCount, warningCount } = countProblemsBySeverity(activeWorkflowProblems.value)
  if (uiState?.phase === 'compiling' || uiState?.phase === 'rendering') {
    return t('Building')
  }
  if (errorCount > 0) {
    return t('Needs attention')
  }
  if (warningCount > 0) {
    return t('Warnings')
  }
  if (uiState?.phase === 'ready') {
    return t('Ready')
  }
  return ''
})

const changeSummaryTone = computed(() => {
  if (reviews.pendingCount > 0) return 'warning'
  if (activeContextPath.value && editorStore.dirtyFiles.has(activeContextPath.value)) return 'accent'
  if (editorStore.dirtyFiles.size > 0) return 'accent'
  return 'neutral'
})

const changeSummaryLabel = computed(() => {
  if (reviews.pendingCount > 0) {
    return t('{count} proposal(s)', { count: reviews.pendingCount })
  }
  if (activeContextPath.value && editorStore.dirtyFiles.has(activeContextPath.value)) {
    return t('Draft changed')
  }
  if (editorStore.dirtyFiles.size > 0) {
    return t('{count} unsaved', { count: editorStore.dirtyFiles.size })
  }
  return t('Saved')
})

const changeSummaryTooltip = computed(() => {
  if (reviews.pendingCount > 0) {
    return t('Open saved versions and review workspace changes')
  }
  return t('Open saved versions and recovery tools')
})

const isProjectHomeActive = computed(() => (
  workspace.isWorkspaceSurface
  && (!editorStore.activeTab || isNewTab(editorStore.activeTab))
))

const isWritingActive = computed(() => (
  workspace.isWorkspaceSurface && !isProjectHomeActive.value
))

function onFocus() {
  searchFocused.value = true
}

function onBlur() {
  window.setTimeout(() => {
    searchFocused.value = false
  }, 80)
}

function onSearchKeydown(event) {
  if (event.key === 'Escape') {
    closeSearchPalette()
    event.preventDefault()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    searchResultsRef.value?.moveSelection(1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    searchResultsRef.value?.moveSelection(-1)
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    searchResultsRef.value?.confirmSelection()
  }
}

function onSelectFile(path) {
  workspace.openWorkspaceSurface()
  editorStore.openFile(path)
  closeSearchPalette()
}

function onSelectCitation(key) {
  const target = editorStore.findPreferredResearchInsertTarget()
  if (target?.path) {
    workspace.openWorkspaceSurface()
    referencesStore.addKeyToWorkspace(key)
    editorStore.openFileInPane(target.path, target.paneId, { activatePane: true, replaceNewTab: false })
    const view = editorStore.getEditorView(target.paneId, target.path)
    if (view) {
      insertCitationWithAssist({
        view,
        filePath: target.path,
        keys: key,
        t,
        toastStore,
      })
      view.focus()
    }
  }
  closeSearchPalette()
}

function onSelectChat(sessionId) {
  workspace.openAiSurface()
  aiWorkbench.openSession(sessionId)
  closeSearchPalette()
}

function handleOpenAi() {
  aiDrawer.toggle()
}

function openProjectHome() {
  if (!workspace.isOpen) return
  workspace.openWorkspaceSurface()
  const paneId = editorStore.activePaneId || 'pane-root'
  const activePane = editorStore.activePane
  if (activePane?.activeTab && isNewTab(activePane.activeTab)) {
    return
  }
  editorStore.openNewTab(paneId)
}

function focusWritingWorkspace() {
  if (!workspace.isOpen) return
  workspace.openWorkspaceSurface()
  const targetPath = editorStore.preferredContextPath || activeContextPath.value
  if (targetPath) {
    const existingPane = editorStore.findPaneWithTab(targetPath)
    if (existingPane) {
      existingPane.activeTab = targetPath
      editorStore.activePaneId = existingPane.id
      editorStore.saveEditorState()
      return
    }

    editorStore.openFileInPane(targetPath, editorStore.activePaneId, {
      activatePane: true,
      replaceNewTab: false,
    })
    return
  }

  openProjectHome()
}

function openAiWorkbench() {
  if (!workspace.isOpen) return
  workspace.openAiSurface()
}

function openLibrary() {
  if (!workspace.isOpen) return
  workspace.openLibrarySurface()
}

async function waitForEditorView(targetPath) {
  const startedAt = Date.now()
  let targetView = editorStore.getAnyEditorView(targetPath)

  while (!targetView && Date.now() - startedAt < EDITOR_WAIT_TIMEOUT_MS) {
    await new Promise((resolve) => window.setTimeout(resolve, 16))
    targetView = editorStore.getAnyEditorView(targetPath)
  }

  return targetView
}

async function onSelectTypstSymbol(symbol) {
  const filePath = String(symbol?.filePath || '')
  if (!filePath) return

  workspace.openWorkspaceSurface()
  editorStore.openFile(filePath)
  const targetView = await waitForEditorView(filePath)
  if (targetView) {
    const offsets = tinymistRangeToOffsets(targetView.state, symbol?.range)
    if (offsets) {
      targetView.dispatch({
        selection: {
          anchor: offsets.from,
          head: offsets.to,
        },
        scrollIntoView: true,
      })
      targetView.focus()
    }
  }

  closeSearchPalette()
}

function focusSearch() {
  searchOpen.value = true
  nextTick(() => {
    searchInputRef.value?.focus()
    searchInputRef.value?.select()
  })
}

function closeSearchPalette() {
  searchOpen.value = false
  searchFocused.value = false
  query.value = ''
  searchInputRef.value?.blur()
}

async function syncNativeWindowChromeState() {
  if (!isTauriDesktop) return
  try {
    isNativeFullscreen.value = await getCurrentWindow().isFullscreen()
  } catch {
    isNativeFullscreen.value = false
  }
}

onMounted(async () => {
  if (!isTauriDesktop) return
  await syncNativeWindowChromeState()
  try {
    unlistenWindowResize = await getCurrentWindow().onResized(() => {
      syncNativeWindowChromeState()
    })
  } catch {
    unlistenWindowResize = null
  }
})

onUnmounted(() => {
  unlistenWindowResize?.()
  unlistenWindowResize = null
})

defineExpose({ focusSearch })
</script>

<style scoped>
.header-root {
  display: grid;
  gap: 12px;
  align-items: center;
  position: relative;
  backdrop-filter: blur(18px);
}

.header-nav-cluster {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.header-brand-mark {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.header-brand-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-primary);
}

.header-brand-copy {
  font-size: 11px;
  color: var(--fg-muted);
  white-space: nowrap;
}

.header-workflow-nav {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-primary) 55%, transparent);
}

.header-workflow-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, transform 140ms ease;
  white-space: nowrap;
}

.header-workflow-button:hover {
  color: var(--fg-secondary);
  background: color-mix(in srgb, var(--bg-hover) 78%, transparent);
}

.header-workflow-button.is-active {
  color: var(--fg-primary);
  background: color-mix(in srgb, var(--accent) 14%, var(--bg-primary));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent);
}

.header-workflow-button span {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.header-context-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 9px 14px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 18px;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 12%, transparent), transparent 42%),
    color-mix(in srgb, var(--bg-primary) 72%, transparent);
  text-align: left;
  cursor: pointer;
  transition: border-color 140ms ease, transform 140ms ease, background-color 140ms ease;
  min-height: 40px;
}

.header-context-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
}

.header-context-card.is-launcher {
  cursor: default;
}

.header-context-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.header-context-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-context-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  line-height: 1.15;
  font-weight: 600;
  color: var(--fg-primary);
}

.header-context-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 12px;
  color: var(--fg-secondary);
}

.header-context-shortcut {
  padding: 2px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-secondary) 82%, transparent);
  color: var(--fg-muted);
  font-size: 11px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.header-state-pill,
.header-status-button {
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
}

.header-state-pill {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.header-state-pill.is-success {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.header-state-pill.is-warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
}

.header-state-pill.is-error {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
}

.header-state-pill.is-running {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.header-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.header-status-strip {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-status-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  background: color-mix(in srgb, var(--bg-primary) 62%, transparent);
  color: var(--fg-secondary);
  cursor: pointer;
  transition: border-color 140ms ease, color 140ms ease, background-color 140ms ease;
}

.header-status-button:hover {
  border-color: color-mix(in srgb, var(--accent) 18%, var(--border));
  color: var(--fg-primary);
}

.header-status-button.is-accent {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.header-status-button.is-warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
}

.header-status-button.is-neutral {
  color: var(--fg-secondary);
}

.header-status-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: inherit;
  opacity: 0.82;
}

.header-status-value {
  font-size: 12px;
  font-weight: 600;
  color: inherit;
  white-space: nowrap;
}

.header-chrome-button {
  width: 32px;
  height: 32px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-primary) 56%, transparent);
  color: var(--fg-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease, border-color 140ms ease;
}

.header-chrome-button:hover {
  color: var(--fg-primary);
  background: color-mix(in srgb, var(--bg-hover) 72%, transparent);
}

.header-chrome-button.is-active,
.header-chrome-button.is-accent {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.header-command-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(2px);
}

.header-command-shell {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  width: min(680px, calc(100vw - 28px));
  z-index: 9999;
}

.header-command-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-command-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-primary) 96%, transparent);
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.22);
}

.header-command-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--fg-primary);
  font-size: var(--ui-font-body);
  font-family: inherit;
}

.header-command-kbd {
  padding: 0 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  color: var(--fg-muted);
  font-size: 11px;
  line-height: 22px;
  white-space: nowrap;
}

.header-command-results {
  position: relative;
}

.header-command-results :deep(.search-results-dropdown) {
  position: static;
  top: auto;
  left: auto;
  transform: none;
  width: 100%;
  max-height: min(62vh, 520px);
  border-radius: 14px;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.22);
}

@media (max-width: 1180px) {
  .header-root {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .header-context-card {
    grid-column: 1 / -1;
    order: 3;
  }

  .header-controls {
    justify-content: flex-end;
  }
}

@media (max-width: 880px) {
  .header-root {
    gap: 10px;
    padding-right: 10px !important;
  }

  .header-workflow-nav {
    overflow-x: auto;
    max-width: min(100%, 420px);
  }

  .header-workflow-button span,
  .header-status-label {
    display: none;
  }

  .header-brand-copy,
  .header-context-shortcut {
    display: none;
  }
}

@media (max-width: 640px) {
  .header-root {
    grid-template-columns: 1fr auto;
    height: auto !important;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .header-nav-cluster {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .header-status-strip {
    display: none;
  }

  .header-context-card {
    padding: 10px 12px;
  }
}
</style>
