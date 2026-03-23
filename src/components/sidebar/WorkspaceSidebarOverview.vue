<template>
  <section class="sidebar-overview">
    <div class="sidebar-overview-hero">
      <div class="sidebar-overview-kicker">{{ t('Project navigation') }}</div>
      <div class="sidebar-overview-title">{{ workspaceName }}</div>
      <p class="sidebar-overview-copy">
        {{ heroCopy }}
      </p>

      <div class="sidebar-overview-metrics">
        <span class="sidebar-overview-metric">{{ t('{count} project file(s)', { count: fileCount }) }}</span>
        <span class="sidebar-overview-metric">{{ evidenceSummaryTitle }}</span>
        <span class="sidebar-overview-metric">{{ changeSummaryTitle }}</span>
      </div>

      <div class="sidebar-overview-nav">
        <button
          type="button"
          class="sidebar-overview-nav-button"
          :class="{ 'is-active': isProjectHomeActive }"
          @click="openProjectHome"
        >
          <IconFolderOpen :size="13" :stroke-width="1.7" />
          <span>{{ t('Project') }}</span>
        </button>
        <button
          type="button"
          class="sidebar-overview-nav-button"
          :class="{ 'is-active': isWritingActive }"
          @click="focusWritingWorkspace"
        >
          <IconFileText :size="13" :stroke-width="1.7" />
          <span>{{ t('Writing') }}</span>
        </button>
        <button
          type="button"
          class="sidebar-overview-nav-button"
          :class="{ 'is-active': workspace.isLibrarySurface }"
          @click="openEvidence"
        >
          <IconBook2 :size="13" :stroke-width="1.7" />
          <span>{{ t('Evidence') }}</span>
        </button>
        <button
          type="button"
          class="sidebar-overview-nav-button"
          :class="{ 'is-active': workspace.isAiSurface }"
          @click="openAssist"
        >
          <IconSparkles :size="13" :stroke-width="1.7" />
          <span>{{ t('Assist') }}</span>
        </button>
      </div>
    </div>

    <div class="sidebar-overview-cards">
      <button type="button" class="sidebar-overview-card is-primary" @click="focusWritingWorkspace">
        <span class="sidebar-overview-card-kicker">{{ t('Current work') }}</span>
        <span class="sidebar-overview-card-title">{{ currentWorkTitle }}</span>
        <span class="sidebar-overview-card-detail">{{ currentWorkDetail }}</span>
      </button>

      <button
        type="button"
        class="sidebar-overview-card"
        :class="`is-${buildTone}`"
        @click="handleBuildFocus"
      >
        <span class="sidebar-overview-card-kicker">{{ t('Build focus') }}</span>
        <span class="sidebar-overview-card-title">{{ buildSummaryTitle }}</span>
        <span class="sidebar-overview-card-detail">{{ buildSummaryDetail }}</span>
      </button>

      <button type="button" class="sidebar-overview-card is-neutral" @click="openEvidence">
        <span class="sidebar-overview-card-kicker">{{ t('Evidence layer') }}</span>
        <span class="sidebar-overview-card-title">{{ evidenceSummaryTitle }}</span>
        <span class="sidebar-overview-card-detail">{{ evidenceSummaryDetail }}</span>
      </button>

      <button
        type="button"
        class="sidebar-overview-card"
        :class="`is-${changeTone}`"
        @click="handleChangeFocus"
      >
        <span class="sidebar-overview-card-kicker">{{ t('Change safety') }}</span>
        <span class="sidebar-overview-card-title">{{ changeSummaryTitle }}</span>
        <span class="sidebar-overview-card-detail">{{ changeSummaryDetail }}</span>
      </button>
    </div>

    <div class="sidebar-overview-actions">
      <button type="button" class="sidebar-overview-action" @click="emit('focus-search')">
        <IconSearch :size="13" :stroke-width="1.7" />
        <span>{{ t('Quick open') }}</span>
      </button>
      <button type="button" class="sidebar-overview-action" @click="emit('create-save-point')">
        <IconBookmarkPlus :size="13" :stroke-width="1.7" />
        <span>{{ t('Create save point') }}</span>
      </button>
      <button type="button" class="sidebar-overview-action" @click="emit('open-saved-versions')">
        <IconHistory :size="13" :stroke-width="1.7" />
        <span>{{ t('Saved versions') }}</span>
      </button>
      <button
        type="button"
        class="sidebar-overview-action"
        :disabled="!hasActiveFileHistory"
        @click="emit('open-active-file-history')"
      >
        <IconFileText :size="13" :stroke-width="1.7" />
        <span>{{ t('Open file history') }}</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import {
  IconBookmarkPlus,
  IconBook2,
  IconFileText,
  IconFolderOpen,
  IconHistory,
  IconSearch,
  IconSparkles,
} from '@tabler/icons-vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEditorStore } from '../../stores/editor'
import { useFilesStore } from '../../stores/files'
import { useReviewsStore } from '../../stores/reviews'
import { useCommentsStore } from '../../stores/comments'
import { useReferencesStore } from '../../stores/references'
import { useDocumentWorkflowStore } from '../../stores/documentWorkflow'
import { useLatexStore } from '../../stores/latex'
import { useTypstStore } from '../../stores/typst'
import { useI18n } from '../../i18n'
import { isLatex, isMarkdown, isTypst } from '../../utils/fileTypes'
import { useWorkspaceShellNavigation } from '../../app/shell/useWorkspaceShellNavigation'

const emit = defineEmits([
  'focus-search',
  'create-save-point',
  'open-saved-versions',
  'open-active-file-history',
])

const workspace = useWorkspaceStore()
const editorStore = useEditorStore()
const filesStore = useFilesStore()
const reviewsStore = useReviewsStore()
const commentsStore = useCommentsStore()
const referencesStore = useReferencesStore()
const workflowStore = useDocumentWorkflowStore()
const latexStore = useLatexStore()
const typstStore = useTypstStore()
const { t } = useI18n()

function fileName(path = '') {
  return String(path || '').split('/').pop() || path
}

function relativePath(path = '') {
  if (!path) return ''
  if (workspace.path && path.startsWith(`${workspace.path}/`)) {
    return path.slice(workspace.path.length + 1)
  }
  return path
}

function countProblemsBySeverity(problems = []) {
  const entries = Array.isArray(problems) ? problems : []
  return {
    errorCount: entries.filter((entry) => entry?.severity === 'error').length,
    warningCount: entries.filter((entry) => entry?.severity === 'warning').length,
  }
}

function openPath(path = '') {
  if (!path) return
  workspace.openWorkspaceSurface()
  editorStore.openFile(path)
}

const activeContextPath = computed(() => editorStore.preferredContextPath || '')
const workflowOptions = computed(() => ({
  editorStore,
  filesStore,
  workspace,
  latexStore,
  typstStore,
  referencesStore,
  t,
}))

const {
  openProjectHome,
  focusWritingWorkspace,
  openEvidence,
  openAssist,
} = useWorkspaceShellNavigation({
  workspace,
  editorStore,
  getFallbackContextPath: () => activeContextPath.value,
})

const workspaceName = computed(() => fileName(workspace.path || '') || t('Current workspace'))
const fileCount = computed(() => filesStore.flatFiles.length)
const referenceCount = computed(() => referencesStore.refCount || 0)
const pendingProposalCount = computed(() => reviewsStore.pendingCount || 0)

const unresolvedCommentEntries = computed(() => {
  const map = new Map()
  const entries = Array.isArray(commentsStore.comments) ? commentsStore.comments : []
  for (const comment of entries) {
    if (!comment?.filePath || comment?.status !== 'active') continue
    map.set(comment.filePath, (map.get(comment.filePath) || 0) + 1)
  }
  return [...map.entries()].map(([path, count]) => ({ path, count }))
})

const unresolvedCommentCount = computed(() => (
  unresolvedCommentEntries.value.reduce((total, entry) => total + entry.count, 0)
))

const hasActiveFileHistory = computed(() => !!activeContextPath.value)
const currentWorkTitle = computed(() => (
  activeContextPath.value ? fileName(activeContextPath.value) : t('Project home')
))
const currentWorkDetail = computed(() => (
  activeContextPath.value
    ? relativePath(activeContextPath.value)
    : t('Project home and workspace overview')
))

const heroCopy = computed(() => (
  activeContextPath.value
    ? t('Continue from the current draft, evidence, and review queues.')
    : t('Project home is ready when you need to zoom back out.')
))

const isProjectHomeActive = computed(() => (
  workspace.isWorkspaceSurface
  && (!editorStore.activeTab || String(editorStore.activeTab).startsWith('newtab:'))
))

const isWritingActive = computed(() => (
  workspace.isWorkspaceSurface && !isProjectHomeActive.value
))

const buildPath = computed(() => {
  const path = activeContextPath.value
  return isMarkdown(path) || isLatex(path) || isTypst(path) ? path : ''
})

const buildUiState = computed(() => (
  buildPath.value ? workflowStore.getUiStateForFile(buildPath.value, workflowOptions.value) : null
))

const buildProblems = computed(() => (
  buildPath.value ? workflowStore.getProblemsForFile(buildPath.value, workflowOptions.value) : []
))

const buildIssueCounts = computed(() => countProblemsBySeverity(buildProblems.value))

const buildTone = computed(() => {
  if (!buildPath.value) return 'neutral'
  if (buildUiState.value?.phase === 'compiling' || buildUiState.value?.phase === 'rendering') return 'running'
  if (buildIssueCounts.value.errorCount > 0) return 'error'
  if (buildIssueCounts.value.warningCount > 0) return 'warning'
  if (buildUiState.value?.phase === 'ready') return 'success'
  return 'neutral'
})

const buildSummaryTitle = computed(() => {
  if (!buildPath.value) return t('Build focus follows the current draft.')
  if (buildUiState.value?.phase === 'compiling' || buildUiState.value?.phase === 'rendering') return t('Building')
  if (buildIssueCounts.value.errorCount > 0 || buildIssueCounts.value.warningCount > 0) {
    return t('Output attention needed')
  }
  return t('Ready for output')
})

const buildSummaryDetail = computed(() => {
  if (!buildPath.value) return t('Open a Markdown, LaTeX, or Typst document to inspect output health.')
  if (buildUiState.value?.phase === 'compiling' || buildUiState.value?.phase === 'rendering') {
    return fileName(buildPath.value)
  }
  if (buildIssueCounts.value.errorCount > 0) {
    return t('{count} blocker(s) need a fix before output is clean.', {
      count: buildIssueCounts.value.errorCount,
    })
  }
  if (buildIssueCounts.value.warningCount > 0) {
    return t('{count} issue(s) still need review before export.', {
      count: buildIssueCounts.value.warningCount,
    })
  }
  return t('No build issues in the current draft.')
})

const evidenceSummaryTitle = computed(() => (
  referenceCount.value > 0
    ? t('{count} project reference(s)', { count: referenceCount.value })
    : t('No project references yet')
))

const evidenceSummaryDetail = computed(() => (
  t('Project citations, PDFs, and source notes stay one move away.')
))

const changeTone = computed(() => {
  if (pendingProposalCount.value > 0) return 'warning'
  if (unresolvedCommentCount.value > 0) return 'neutral'
  return 'success'
})

const changeSummaryTitle = computed(() => {
  if (pendingProposalCount.value > 0) {
    return t('{count} pending proposal(s)', { count: pendingProposalCount.value })
  }
  if (unresolvedCommentCount.value > 0) {
    return t('{count} active comment(s)', { count: unresolvedCommentCount.value })
  }
  return t('All review queues clear')
})

const changeSummaryDetail = computed(() => (
  t('Open saved versions, file history, and review queues without leaving the project.')
))

function handleBuildFocus() {
  if (buildPath.value) {
    openPath(buildPath.value)
    return
  }
  focusWritingWorkspace()
}

function handleChangeFocus() {
  const reviewPath = reviewsStore.filesWithEdits[0]
  if (reviewPath) {
    openPath(reviewPath)
    return
  }

  const commentPath = unresolvedCommentEntries.value[0]?.path
  if (commentPath) {
    openPath(commentPath)
    return
  }

  emit('open-saved-versions')
}
</script>

<style scoped>
.sidebar-overview {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.9rem 0.85rem 0.8rem;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 16%, transparent), transparent 50%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 72%, #f5f1e7 28%), var(--bg-secondary));
}

.sidebar-overview-hero {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.95rem;
  border-radius: 1.05rem;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--bg-primary) 78%, #f0ece3 22%), color-mix(in srgb, var(--bg-secondary) 82%, #ede6d7 18%));
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  box-shadow:
    0 18px 28px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.sidebar-overview-kicker {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--fg-muted) 90%, #556070 10%);
}

.sidebar-overview-title {
  font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif;
  font-size: 1.2rem;
  line-height: 1.1;
  color: var(--fg-primary);
}

.sidebar-overview-copy {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.45;
  color: color-mix(in srgb, var(--fg-secondary) 88%, #495363 12%);
}

.sidebar-overview-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.38rem;
}

.sidebar-overview-metric {
  display: inline-flex;
  align-items: center;
  min-height: 1.45rem;
  padding: 0 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-secondary) 65%, white 35%);
  color: color-mix(in srgb, var(--fg-secondary) 86%, #4b5563 14%);
  font-size: 0.64rem;
  letter-spacing: 0.05em;
}

.sidebar-overview-nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
}

.sidebar-overview-nav-button,
.sidebar-overview-card,
.sidebar-overview-action {
  border: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 88%, white 12%);
  color: var(--fg-primary);
  transition:
    transform 140ms ease,
    border-color 140ms ease,
    background 140ms ease,
    box-shadow 140ms ease;
}

.sidebar-overview-nav-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.38rem;
  min-height: 2rem;
  padding: 0 0.7rem;
  border-radius: 999px;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
}

.sidebar-overview-nav-button:hover,
.sidebar-overview-card:hover,
.sidebar-overview-action:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 46%, var(--border) 54%);
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
}

.sidebar-overview-nav-button.is-active {
  background: color-mix(in srgb, var(--accent) 14%, var(--bg-primary) 86%);
  border-color: color-mix(in srgb, var(--accent) 48%, var(--border) 52%);
  color: color-mix(in srgb, var(--fg-primary) 90%, var(--accent) 10%);
}

.sidebar-overview-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.sidebar-overview-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.28rem;
  min-height: 5.4rem;
  padding: 0.75rem 0.8rem;
  border-radius: 0.95rem;
  text-align: left;
}

.sidebar-overview-card-kicker {
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--fg-muted);
}

.sidebar-overview-card-title {
  font-size: 0.82rem;
  line-height: 1.25;
  color: var(--fg-primary);
}

.sidebar-overview-card-detail {
  font-size: 0.69rem;
  line-height: 1.45;
  color: var(--fg-secondary);
}

.sidebar-overview-card.is-primary {
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, var(--bg-primary) 90%), color-mix(in srgb, var(--bg-primary) 92%, white 8%));
}

.sidebar-overview-card.is-running {
  background: linear-gradient(180deg, rgba(191, 219, 254, 0.55), color-mix(in srgb, var(--bg-primary) 94%, white 6%));
}

.sidebar-overview-card.is-warning {
  background: linear-gradient(180deg, rgba(254, 240, 138, 0.42), color-mix(in srgb, var(--bg-primary) 94%, white 6%));
}

.sidebar-overview-card.is-error {
  background: linear-gradient(180deg, rgba(254, 202, 202, 0.5), color-mix(in srgb, var(--bg-primary) 94%, white 6%));
}

.sidebar-overview-card.is-success {
  background: linear-gradient(180deg, rgba(187, 247, 208, 0.45), color-mix(in srgb, var(--bg-primary) 94%, white 6%));
}

.sidebar-overview-card.is-neutral {
  background: color-mix(in srgb, var(--bg-primary) 92%, white 8%);
}

.sidebar-overview-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.48rem;
}

.sidebar-overview-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.38rem;
  min-height: 2rem;
  padding: 0 0.68rem;
  border-radius: 0.85rem;
  font-size: 0.69rem;
}

.sidebar-overview-action:disabled {
  cursor: not-allowed;
  opacity: 0.46;
  transform: none;
  box-shadow: none;
}
</style>
