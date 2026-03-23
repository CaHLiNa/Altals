<template>
  <div class="project-home">
    <div class="project-home-scroll">
      <div class="project-home-shell">
        <section class="project-home-hero">
          <div class="project-home-kicker">{{ t('Project home') }}</div>
          <div class="project-home-title-row">
            <h1 class="project-home-title">{{ workspaceName }}</h1>
            <span class="project-home-state-pill" :class="`is-${attentionTone}`">
              {{ attentionLabel }}
            </span>
          </div>
          <p class="project-home-copy">
            {{ t('Continue writing, inspect build readiness, recover saved versions, and move between evidence and assist without leaving this local project.') }}
          </p>

          <div class="project-home-stats">
            <div class="project-home-stat">
              <span class="project-home-stat-label">{{ t('Files') }}</span>
              <span class="project-home-stat-value">{{ fileCount }}</span>
            </div>
            <div class="project-home-stat">
              <span class="project-home-stat-label">{{ t('References') }}</span>
              <span class="project-home-stat-value">{{ referenceCount }}</span>
            </div>
            <div class="project-home-stat">
              <span class="project-home-stat-label">{{ t('Pending proposals') }}</span>
              <span class="project-home-stat-value">{{ pendingProposalCount }}</span>
            </div>
            <div class="project-home-stat">
              <span class="project-home-stat-label">{{ t('Open comments') }}</span>
              <span class="project-home-stat-value">{{ unresolvedCommentCount }}</span>
            </div>
          </div>

          <div class="project-home-actions">
            <button type="button" class="project-home-primary" @click="continueWriting">
              {{ continueCtaLabel }}
            </button>
            <button type="button" class="project-home-secondary" @click="openSearch">
              {{ t('Quick open') }}
            </button>
            <button type="button" class="project-home-secondary" @click="openWorkspaceSnapshots">
              {{ t('Saved versions') }}
            </button>
          </div>
        </section>

        <div class="project-home-grid project-home-grid-primary">
          <section class="project-home-card project-home-card-feature">
            <div class="project-home-card-head">
              <div>
                <div class="project-home-card-kicker">{{ t('Continue') }}</div>
                <div class="project-home-card-title">{{ t('Resume the current draft') }}</div>
              </div>
            </div>

            <button
              v-if="continuePath"
              type="button"
              class="project-home-continue-card"
              @click="openFile(continuePath)"
            >
              <div class="project-home-continue-title">{{ fileName(continuePath) }}</div>
              <div class="project-home-continue-meta">
                <span>{{ relativePath(continuePath) }}</span>
                <span v-if="continueMeta">{{ continueMeta }}</span>
              </div>
            </button>

            <div v-if="recentFiles.length" class="project-home-list">
              <button
                v-for="entry in recentFiles"
                :key="entry.path"
                type="button"
                class="project-home-list-item"
                @click="openFile(entry.path)"
              >
                <span class="project-home-list-main">
                  <span class="project-home-list-title">{{ fileName(entry.path) }}</span>
                  <span class="project-home-list-path">{{ relativePath(entry.path) }}</span>
                </span>
                <span class="project-home-list-meta">{{ formatRelativeFromNow(entry.openedAt) }}</span>
              </button>
            </div>
            <div v-else class="project-home-empty">
              {{ t('No recent documents yet. Start by opening a file or creating a new manuscript.') }}
            </div>
          </section>

          <section class="project-home-card">
            <div class="project-home-card-head">
              <div>
                <div class="project-home-card-kicker">{{ t('Attention') }}</div>
                <div class="project-home-card-title">{{ t('What needs attention now') }}</div>
              </div>
            </div>

            <div v-if="attentionItems.length" class="project-home-list">
              <button
                v-for="item in attentionItems"
                :key="item.id"
                type="button"
                class="project-home-list-item"
                @click="openAttentionItem(item)"
              >
                <span class="project-home-list-main">
                  <span class="project-home-list-title">{{ item.title }}</span>
                  <span class="project-home-list-path">{{ item.detail }}</span>
                </span>
                <span class="project-home-inline-pill" :class="`is-${item.tone}`">
                  {{ item.pill }}
                </span>
              </button>
            </div>
            <div v-else class="project-home-empty">
              {{ t('No active blockers right now. The workspace is ready for focused writing.') }}
            </div>
          </section>
        </div>

        <div class="project-home-grid project-home-grid-secondary">
          <section class="project-home-card">
            <div class="project-home-card-head">
              <div>
                <div class="project-home-card-kicker">{{ t('Recovery') }}</div>
                <div class="project-home-card-title">{{ t('Recent saved versions') }}</div>
              </div>
              <button type="button" class="project-home-link" @click="openWorkspaceSnapshots">
                {{ t('Open all') }}
              </button>
            </div>

            <div v-if="savePointsLoading" class="project-home-empty">
              {{ t('Loading saved versions...') }}
            </div>
            <div v-else-if="recentSavePoints.length" class="project-home-list">
              <button
                v-for="snapshot in recentSavePoints"
                :key="snapshot.id || snapshot.sourceId || snapshot.createdAt"
                type="button"
                class="project-home-list-item"
                @click="openWorkspaceSnapshots"
              >
                <span class="project-home-list-main">
                  <span class="project-home-list-title">{{ snapshotTitle(snapshot) }}</span>
                  <span class="project-home-list-path">{{ snapshotMeta(snapshot) }}</span>
                </span>
                <span class="project-home-list-meta">{{ formatRelativeFromNow(snapshot.createdAt) }}</span>
              </button>
            </div>
            <div v-else class="project-home-empty">
              {{ t('No saved versions yet. Use Save to create the first recovery point.') }}
            </div>
          </section>

          <section class="project-home-card">
            <div class="project-home-card-head">
              <div>
                <div class="project-home-card-kicker">{{ t('Start') }}</div>
                <div class="project-home-card-title">{{ t('Create new work') }}</div>
              </div>
            </div>

            <div class="project-home-create-grid">
              <button
                v-for="item in createItems"
                :key="item.ext"
                type="button"
                class="project-home-create-card"
                @click="createNewFile(item.ext)"
              >
                <span class="project-home-create-label">{{ item.label }}</span>
                <span class="project-home-create-meta">{{ item.ext }}</span>
              </button>
            </div>
          </section>

          <section class="project-home-card">
            <div class="project-home-card-head">
              <div>
                <div class="project-home-card-kicker">{{ t('Context') }}</div>
                <div class="project-home-card-title">{{ t('Evidence and assist') }}</div>
              </div>
            </div>

            <div class="project-home-surface-grid">
              <button type="button" class="project-home-surface-card" @click="workspace.openLibrarySurface()">
                <span class="project-home-surface-label">{{ t('Evidence layer') }}</span>
                <span class="project-home-surface-meta">
                  {{ t('Open references, source PDFs, tags, and project evidence.') }}
                </span>
              </button>
              <button type="button" class="project-home-surface-card" @click="workspace.openAiSurface()">
                <span class="project-home-surface-label">{{ t('Assist workflows') }}</span>
                <span class="project-home-surface-meta">
                  {{ t('Use proposal-first AI help without turning the project into a chat-first interface.') }}
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listWorkspaceSavePoints } from '../../domains/changes/workspaceSnapshot.js'
import { useEditorStore } from '../../stores/editor'
import { useFilesStore } from '../../stores/files'
import { useReferencesStore } from '../../stores/references'
import { useWorkspaceStore } from '../../stores/workspace'
import { useReviewsStore } from '../../stores/reviews'
import { useCommentsStore } from '../../stores/comments'
import { useDocumentWorkflowStore } from '../../stores/documentWorkflow'
import { useLatexStore } from '../../stores/latex'
import { useTypstStore } from '../../stores/typst'
import { isLatex, isMarkdown, isTypst } from '../../utils/fileTypes'
import { useI18n, formatRelativeFromNow } from '../../i18n'

const props = defineProps({
  paneId: { type: String, default: '' },
})

const editorStore = useEditorStore()
const filesStore = useFilesStore()
const referencesStore = useReferencesStore()
const workspace = useWorkspaceStore()
const reviewsStore = useReviewsStore()
const commentsStore = useCommentsStore()
const workflowStore = useDocumentWorkflowStore()
const latexStore = useLatexStore()
const typstStore = useTypstStore()
const { t } = useI18n()

const savePoints = ref([])
const savePointsLoading = ref(false)
let savePointLoadGeneration = 0

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

const workflowOptions = computed(() => ({
  editorStore,
  filesStore,
  workspace,
  latexStore,
  typstStore,
  referencesStore,
  t,
}))

const workspaceName = computed(() => {
  const path = workspace.path || ''
  return path ? fileName(path) : t('Current workspace')
})

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

const recentFiles = computed(() => editorStore.recentFilesForEmptyState.slice(0, 6))
const continuePath = computed(() => (
  editorStore.preferredContextPath || recentFiles.value[0]?.path || ''
))

const continueMeta = computed(() => {
  const entry = recentFiles.value.find((item) => item.path === continuePath.value)
  return entry?.openedAt ? formatRelativeFromNow(entry.openedAt) : ''
})

const buildCandidatePaths = computed(() => {
  const candidates = []
  if (continuePath.value) candidates.push(continuePath.value)
  for (const entry of recentFiles.value) {
    candidates.push(entry.path)
  }
  return [...new Set(candidates)].filter((path) => isMarkdown(path) || isLatex(path) || isTypst(path))
})

const buildAttentionItems = computed(() => (
  buildCandidatePaths.value
    .map((path) => {
      const uiState = workflowStore.getUiStateForFile(path, workflowOptions.value)
      const problems = workflowStore.getProblemsForFile(path, workflowOptions.value)
      const { errorCount, warningCount } = countProblemsBySeverity(problems)
      if (uiState?.phase === 'compiling' || uiState?.phase === 'rendering') {
        return {
          id: `build:${path}`,
          tone: 'accent',
          pill: t('building'),
          title: fileName(path),
          detail: t('Output is updating for this document.'),
          path,
        }
      }
      if (errorCount > 0) {
        return {
          id: `build:${path}`,
          tone: 'error',
          pill: t('blocked'),
          title: fileName(path),
          detail: t('{count} blocker(s) are preventing a clean output.', { count: errorCount }),
          path,
        }
      }
      if (warningCount > 0) {
        return {
          id: `build:${path}`,
          tone: 'warning',
          pill: t('review'),
          title: fileName(path),
          detail: t('{count} issue(s) still need review.', { count: warningCount }),
          path,
        }
      }
      return null
    })
    .filter(Boolean)
    .slice(0, 3)
))

const attentionItems = computed(() => {
  const items = [...buildAttentionItems.value]

  if (pendingProposalCount.value > 0) {
    items.unshift({
      id: 'pending-proposals',
      tone: 'warning',
      pill: t('review'),
      title: t('Pending AI changes'),
      detail: t('{count} proposal(s) are waiting for approval or rejection.', {
        count: pendingProposalCount.value,
      }),
      action: 'pending-proposals',
    })
  }

  if (unresolvedCommentCount.value > 0) {
    items.push({
      id: 'open-comments',
      tone: 'neutral',
      pill: t('notes'),
      title: t('Open comments'),
      detail: t('{count} active comment(s) remain across the project.', {
        count: unresolvedCommentCount.value,
      }),
      action: 'open-comments',
    })
  }

  return items.slice(0, 5)
})

const attentionTone = computed(() => {
  if (buildAttentionItems.value.some((item) => item.tone === 'error')) return 'error'
  if (attentionItems.value.length > 0) return 'warning'
  return 'success'
})

const attentionLabel = computed(() => {
  if (buildAttentionItems.value.some((item) => item.tone === 'error')) {
    return t('Needs attention')
  }
  if (attentionItems.value.length > 0) {
    return t('In progress')
  }
  return t('Ready to write')
})

const continueCtaLabel = computed(() => (
  continuePath.value ? t('Continue writing') : t('Open a document')
))

const recentSavePoints = computed(() => savePoints.value.slice(0, 4))

const createItems = computed(() => ([
  { ext: '.md', label: t('Markdown draft') },
  { ext: '.tex', label: 'LaTeX paper' },
  { ext: '.typ', label: 'Typst paper' },
  { ext: '.ipynb', label: t('Notebook') },
  { ext: '.py', label: 'Python script' },
  { ext: '.r', label: 'R script' },
]))

watch(
  [() => workspace.path, () => workspace.workspaceDataDir],
  async ([workspacePath, workspaceDataDir]) => {
    const generation = ++savePointLoadGeneration
    if (!workspacePath) {
      savePoints.value = []
      savePointsLoading.value = false
      return
    }

    savePointsLoading.value = true
    try {
      const snapshots = await listWorkspaceSavePoints({
        workspacePath,
        workspaceDataDir: workspaceDataDir || '',
        limit: 6,
        t,
      })
      if (generation !== savePointLoadGeneration) return
      savePoints.value = Array.isArray(snapshots) ? snapshots : []
    } catch (error) {
      if (generation !== savePointLoadGeneration) return
      console.warn('[project-home] failed to load workspace save points:', error)
      savePoints.value = []
    } finally {
      if (generation === savePointLoadGeneration) {
        savePointsLoading.value = false
      }
    }
  },
  { immediate: true },
)

function openSearch() {
  window.dispatchEvent(new CustomEvent('app:focus-search'))
}

function openWorkspaceSnapshots() {
  window.dispatchEvent(new CustomEvent('app:open-workspace-snapshots'))
}

function openFile(path) {
  if (!path) return
  if (props.paneId) editorStore.setActivePane(props.paneId)
  editorStore.openFile(path)
}

function continueWriting() {
  if (continuePath.value) {
    openFile(continuePath.value)
    return
  }
  openSearch()
}

function openAttentionItem(item) {
  if (item?.path) {
    openFile(item.path)
    return
  }

  if (item?.action === 'pending-proposals') {
    const nextPath = reviewsStore.filesWithEdits[0]
    if (nextPath) openFile(nextPath)
    return
  }

  if (item?.action === 'open-comments') {
    const nextPath = unresolvedCommentEntries.value[0]?.path
    if (nextPath) openFile(nextPath)
  }
}

function snapshotTitle(snapshot = null) {
  return String(snapshot?.metadata?.title || snapshot?.label || snapshot?.message || '').trim() || t('Saved version')
}

function snapshotMeta(snapshot = null) {
  return snapshot?.metadata?.isNamed
    ? t('Named save point')
    : t('Workspace save point')
}

async function createNewFile(ext) {
  if (!workspace.path) return
  if (props.paneId) editorStore.setActivePane(props.paneId)

  const baseName = 'untitled'
  let name = `${baseName}${ext}`
  let counter = 2

  while (true) {
    const fullPath = `${workspace.path}/${name}`
    try {
      const exists = await invoke('path_exists', { path: fullPath })
      if (!exists) break
    } catch {
      break
    }
    name = `${baseName}-${counter}${ext}`
    counter += 1
  }

  const created = await filesStore.createFile(workspace.path, name)
  if (created) {
    editorStore.openFile(created)
  }
}
</script>

<style scoped>
.project-home {
  display: flex;
  height: 100%;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--warning) 10%, transparent), transparent 28%),
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 12%, transparent), transparent 34%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 76%, transparent), var(--bg-primary) 46%);
  container-type: inline-size;
}

.project-home-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.project-home-shell {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 34px 28px 42px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-sizing: border-box;
}

.project-home-hero,
.project-home-card {
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 74%, transparent);
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.12);
}

.project-home-hero {
  border-radius: 28px;
  padding: 28px 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 12%, transparent), transparent 38%),
    radial-gradient(circle at bottom right, color-mix(in srgb, var(--warning) 8%, transparent), transparent 34%),
    color-mix(in srgb, var(--bg-primary) 78%, transparent);
}

.project-home-kicker,
.project-home-card-kicker,
.project-home-stat-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.project-home-title-row,
.project-home-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.project-home-title {
  margin: 0;
  font-family: 'STIX Two Text', 'Lora', serif;
  font-size: clamp(34px, 4vw, 56px);
  line-height: 0.98;
  font-weight: 600;
  color: var(--fg-primary);
}

.project-home-copy {
  margin: 0;
  max-width: 66ch;
  font-size: var(--ui-font-title);
  line-height: 1.6;
  color: var(--fg-secondary);
}

.project-home-state-pill,
.project-home-inline-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

.project-home-state-pill.is-success,
.project-home-inline-pill.is-success {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.project-home-state-pill.is-warning,
.project-home-inline-pill.is-warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
}

.project-home-state-pill.is-error,
.project-home-inline-pill.is-error {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
}

.project-home-state-pill.is-accent,
.project-home-inline-pill.is-accent,
.project-home-inline-pill.is-neutral {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.project-home-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.project-home-stat {
  min-width: 0;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 66%, transparent);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.project-home-stat-value {
  font-size: clamp(20px, 2vw, 28px);
  line-height: 1;
  font-weight: 700;
  color: var(--fg-primary);
}

.project-home-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.project-home-primary,
.project-home-secondary,
.project-home-link,
.project-home-continue-card,
.project-home-list-item,
.project-home-create-card,
.project-home-surface-card {
  transition: transform 140ms ease, border-color 140ms ease, background-color 140ms ease, color 140ms ease;
}

.project-home-primary,
.project-home-secondary,
.project-home-link {
  min-height: 40px;
  padding: 0 16px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.project-home-primary {
  color: var(--fg-primary);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--bg-primary) 74%, transparent));
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
}

.project-home-secondary,
.project-home-link {
  color: var(--fg-secondary);
  background: color-mix(in srgb, var(--bg-primary) 60%, transparent);
}

.project-home-primary:hover,
.project-home-secondary:hover,
.project-home-link:hover,
.project-home-continue-card:hover,
.project-home-list-item:hover,
.project-home-create-card:hover,
.project-home-surface-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
}

.project-home-grid {
  display: grid;
  gap: 18px;
}

.project-home-grid-primary {
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr);
}

.project-home-grid-secondary {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.project-home-card {
  border-radius: 24px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.project-home-card-title {
  font-size: 18px;
  line-height: 1.2;
  font-weight: 600;
  color: var(--fg-primary);
}

.project-home-continue-card {
  width: 100%;
  padding: 16px 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));
  border-radius: 18px;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 12%, transparent), transparent 44%),
    color-mix(in srgb, var(--bg-secondary) 68%, transparent);
  text-align: left;
  cursor: pointer;
}

.project-home-continue-title,
.project-home-list-title,
.project-home-create-label,
.project-home-surface-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg-primary);
}

.project-home-continue-meta,
.project-home-list-path,
.project-home-create-meta,
.project-home-surface-meta,
.project-home-empty {
  font-size: 12px;
  line-height: 1.55;
  color: var(--fg-secondary);
}

.project-home-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-home-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-secondary) 62%, transparent);
  text-align: left;
  cursor: pointer;
}

.project-home-list-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.project-home-list-meta {
  flex: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-muted);
  white-space: nowrap;
}

.project-home-create-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.project-home-create-card,
.project-home-surface-card {
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--bg-secondary) 64%, transparent);
  text-align: left;
  cursor: pointer;
}

.project-home-surface-grid {
  display: grid;
  gap: 10px;
}

@media (max-width: 1040px) {
  .project-home-grid-primary,
  .project-home-grid-secondary {
    grid-template-columns: 1fr;
  }

  .project-home-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .project-home-shell {
    padding: 22px 16px 28px;
    gap: 14px;
  }

  .project-home-hero,
  .project-home-card {
    padding: 18px;
    border-radius: 20px;
  }

  .project-home-title-row,
  .project-home-card-head,
  .project-home-list-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .project-home-stats,
  .project-home-create-grid {
    grid-template-columns: 1fr;
  }
}
</style>
