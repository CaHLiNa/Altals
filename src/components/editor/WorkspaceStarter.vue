<template>
  <div class="workspace-starter">
    <div class="workspace-starter-scroll">
      <div class="workspace-starter-shell">
        <section class="workspace-starter-hero">
          <div class="workspace-starter-kicker">{{ t('Project workspace') }}</div>
          <h1 class="workspace-starter-title">{{ workspaceName }}</h1>
          <p class="workspace-starter-copy">{{ t('Write, compute, cite, and iterate from one place.') }}</p>

          <div class="workspace-starter-stats">
            <div class="workspace-starter-stat">
              <span class="workspace-starter-stat-label">{{ t('Files') }}</span>
              <span class="workspace-starter-stat-value">{{ fileCount }}</span>
            </div>
            <div class="workspace-starter-stat">
              <span class="workspace-starter-stat-label">{{ t('References') }}</span>
              <span class="workspace-starter-stat-value">{{ referenceCount }}</span>
            </div>
          </div>

          <div class="workspace-starter-actions">
            <button type="button" class="workspace-starter-primary" @click="openSearch">
              {{ t('Open file') }}
            </button>
            <button type="button" class="workspace-starter-secondary" @click="createNewFile('.md')">
              {{ t('Create file') }}
            </button>
          </div>
        </section>

        <div class="workspace-starter-grid">
          <section class="workspace-starter-panel">
            <div class="workspace-starter-panel-head">
              <div class="workspace-starter-panel-title">{{ t('Recent files') }}</div>
            </div>

            <div v-if="recentFiles.length" class="workspace-starter-list">
              <button
                v-for="entry in recentFiles"
                :key="entry.path"
                type="button"
                class="workspace-starter-list-item"
                @click="openFile(entry.path)"
              >
                <span class="workspace-starter-list-label">{{ fileName(entry.path) }}</span>
                <span class="workspace-starter-list-meta">{{ formatRelativeFromNow(entry.openedAt) }}</span>
              </button>
            </div>
            <div v-else class="workspace-starter-empty">
              {{ t('No recent files yet') }}
            </div>
          </section>

          <section class="workspace-starter-panel">
            <div class="workspace-starter-panel-head">
              <div class="workspace-starter-panel-title">{{ t('Create manuscript') }}</div>
            </div>

            <div class="workspace-starter-create-grid">
              <button
                v-for="item in createItems"
                :key="item.ext"
                type="button"
                class="workspace-starter-create-card"
                @click="createNewFile(item.ext)"
              >
                <span class="workspace-starter-create-label">{{ item.label }}</span>
                <span class="workspace-starter-create-meta">{{ item.ext }}</span>
              </button>
            </div>
          </section>
        </div>

        <section class="workspace-starter-panel">
          <div class="workspace-starter-panel-head">
            <div class="workspace-starter-panel-title">{{ t('Global workbenches') }}</div>
            <div class="workspace-starter-panel-copy">{{ t('Open library or AI without leaving the current project context.') }}</div>
          </div>

          <div class="workspace-starter-surface-grid">
            <button type="button" class="workspace-starter-surface-card" @click="workspace.openLibrarySurface()">
              <span class="workspace-starter-surface-label">{{ t('Library') }}</span>
              <span class="workspace-starter-surface-meta">{{ t('Manage references and project citations.') }}</span>
            </button>
            <button type="button" class="workspace-starter-surface-card" @click="workspace.openAiSurface()">
              <span class="workspace-starter-surface-label">{{ t('AI') }}</span>
              <span class="workspace-starter-surface-meta">{{ t('Open long-form AI workflows and research assistance.') }}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../../stores/editor'
import { useFilesStore } from '../../stores/files'
import { useReferencesStore } from '../../stores/references'
import { useWorkspaceStore } from '../../stores/workspace'
import { useI18n, formatRelativeFromNow } from '../../i18n'

const props = defineProps({
  paneId: { type: String, default: '' },
})

const editorStore = useEditorStore()
const filesStore = useFilesStore()
const referencesStore = useReferencesStore()
const workspace = useWorkspaceStore()
const { t } = useI18n()

const workspaceName = computed(() => {
  const path = workspace.path || ''
  return path ? (String(path).split('/').pop() || path) : t('Current workspace')
})

const fileCount = computed(() => filesStore.flatFiles.length)
const referenceCount = computed(() => referencesStore.refCount || 0)

const recentFiles = computed(() => editorStore.recentFilesForEmptyState.slice(0, 6))

const createItems = computed(() => ([
  { ext: '.md', label: t('Markdown') },
  { ext: '.tex', label: 'LaTeX' },
  { ext: '.typ', label: 'Typst' },
  { ext: '.ipynb', label: t('Jupyter notebook') },
  { ext: '.py', label: 'Python' },
  { ext: '.r', label: 'R' },
]))

function fileName(path) {
  return path.split('/').pop() || path
}

function openSearch() {
  window.dispatchEvent(new CustomEvent('app:focus-search'))
}

function openFile(path) {
  if (!path) return
  if (props.paneId) editorStore.setActivePane(props.paneId)
  editorStore.openFile(path)
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
.workspace-starter {
  display: flex;
  height: 100%;
  background: var(--bg-primary);
  container-type: inline-size;
  --starter-kicker-size: var(--surface-font-kicker);
  --starter-meta-size: var(--surface-font-meta);
  --starter-body-size: var(--surface-font-body);
  --starter-title-size: var(--surface-font-title);
  --starter-card-title-size: var(--surface-font-card);
  --starter-stat-size: var(--surface-font-detail);
  --starter-hero-size: var(--surface-font-hero);
  --starter-hero-size-compact: var(--surface-font-hero-compact);
}

.workspace-starter-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.workspace-starter-shell {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px 28px 40px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-sizing: border-box;
}

.workspace-starter-hero {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 2px 2px;
}

.workspace-starter-kicker,
.workspace-starter-panel-copy,
.workspace-starter-stat-label {
  font-size: var(--starter-kicker-size);
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
}

.workspace-starter-title {
  margin: 0;
  font-size: var(--starter-hero-size);
  line-height: 1.08;
  font-weight: 600;
  color: var(--fg-primary);
}

.workspace-starter-copy {
  margin: 0;
  max-width: 56ch;
  font-size: var(--starter-body-size);
  line-height: 1.55;
  color: var(--fg-secondary);
}

.workspace-starter-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}

.workspace-starter-stat {
  min-width: 120px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-secondary) 84%, transparent);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workspace-starter-stat-value {
  font-size: var(--starter-stat-size);
  font-weight: 600;
  line-height: 1;
  color: var(--fg-primary);
}

.workspace-starter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 2px;
}

.workspace-starter-primary,
.workspace-starter-secondary,
.workspace-starter-list-item,
.workspace-starter-create-card,
.workspace-starter-surface-card {
  cursor: pointer;
  transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease, transform 140ms ease;
}

.workspace-starter-primary,
.workspace-starter-secondary {
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: var(--starter-body-size);
  font-weight: 600;
}

.workspace-starter-primary {
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-primary));
  color: var(--fg-primary);
}

.workspace-starter-secondary {
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-secondary);
}

.workspace-starter-primary:hover,
.workspace-starter-secondary:hover,
.workspace-starter-create-card:hover,
.workspace-starter-surface-card:hover {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--border));
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-primary));
}

.workspace-starter-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 14px;
}

.workspace-starter-panel {
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-secondary) 78%, var(--bg-primary));
  padding: 14px;
}

.workspace-starter-panel-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.workspace-starter-panel-title {
  font-size: var(--starter-title-size);
  font-weight: 600;
  color: var(--fg-primary);
}

.workspace-starter-list {
  display: flex;
  flex-direction: column;
}

.workspace-starter-list-item {
  width: 100%;
  padding: 9px 0;
  border: none;
  border-top: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: transparent;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  text-align: left;
}

.workspace-starter-list-item:first-child {
  border-top: none;
}

.workspace-starter-list-item:hover {
  color: var(--fg-primary);
}

.workspace-starter-list-label {
  min-width: 0;
  font-size: var(--starter-body-size);
  line-height: 1.45;
  color: var(--fg-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-starter-list-meta {
  flex-shrink: 0;
  font-size: var(--starter-meta-size);
  color: var(--fg-muted);
}

.workspace-starter-empty {
  font-size: var(--starter-body-size);
  color: var(--fg-muted);
  padding: 8px 0 2px;
}

.workspace-starter-create-grid,
.workspace-starter-surface-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.workspace-starter-create-card,
.workspace-starter-surface-card {
  min-height: 84px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  text-align: left;
}

.workspace-starter-create-label,
.workspace-starter-surface-label {
  font-size: var(--starter-card-title-size);
  font-weight: 600;
  line-height: 1.35;
  color: var(--fg-primary);
}

.workspace-starter-create-meta,
.workspace-starter-surface-meta {
  font-size: var(--starter-meta-size);
  line-height: 1.45;
  color: var(--fg-muted);
}

@container (max-width: 900px) {
  .workspace-starter-shell {
    padding: 24px 18px 28px;
  }

  .workspace-starter-grid {
    grid-template-columns: 1fr;
  }
}

@container (max-width: 680px) {
  .workspace-starter-title {
    font-size: var(--starter-hero-size-compact);
  }

  .workspace-starter-create-grid,
  .workspace-starter-surface-grid {
    grid-template-columns: 1fr;
  }

  .workspace-starter-list-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
