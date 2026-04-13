<template>
  <DialogRoot :open="searchOpen" @update:open="handleDialogOpenChange">
    <DialogPortal>
      <DialogOverlay v-if="showResults" class="workspace-quick-open-overlay" />

      <DialogContent
        v-if="showResults"
        class="workspace-quick-open-shell"
        @open-auto-focus="handleOpenAutoFocus"
      >
        <ComboboxRoot v-model="selectedPath" v-model:open="comboboxOpen" :ignore-filter="true">
          <div class="workspace-quick-open-panel">
            <div class="workspace-quick-open-input-wrap">
              <IconSearch
                :size="SEARCH_ICON_SIZE"
                :stroke-width="1.5"
                class="workspace-quick-open-search-icon shrink-0"
              />
              <ComboboxInput
                v-model="query"
                as-child
                :display-value="() => query"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                @keydown="onSearchKeydown"
              >
                <input
                  ref="searchInputRef"
                  class="workspace-quick-open-input"
                  :placeholder="searchPlaceholder"
                />
              </ComboboxInput>
            </div>

            <div class="workspace-quick-open-results">
              <div v-if="titleMatches.length > 0" class="quick-open-section">
                {{ query ? t('Files') : t('Recent files') }}
              </div>

              <ComboboxViewport v-if="titleMatches.length > 0" class="search-results-list">
                <ComboboxItem
                  v-for="file in titleMatches"
                  :key="file.path"
                  as-child
                  :value="file.path"
                  :text-value="`${file.name} ${relativePath(file.path)}`"
                >
                  <button type="button" class="quick-open-item">
                    <div class="quick-open-primary truncate">{{ file.name }}</div>
                    <div class="quick-open-secondary path">{{ relativePath(file.path) }}</div>
                  </button>
                </ComboboxItem>
              </ComboboxViewport>

              <div v-else-if="query" class="quick-open-item quick-open-item-empty">
                {{ t('No results found') }}
              </div>
            </div>
          </div>
        </ComboboxRoot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup>
import {
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  ComboboxViewport,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
} from 'reka-ui'
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { IconSearch } from '@tabler/icons-vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEditorStore } from '../../stores/editor'
import { useFilesStore } from '../../stores/files'
import { useI18n } from '../../i18n'
import { listWorkspaceFlatFileEntries } from '../../domains/files/workspaceSnapshotFlatFilesRuntime'

const workspace = useWorkspaceStore()
const editorStore = useEditorStore()
const files = useFilesStore()
const { t } = useI18n()

const SEARCH_ICON_SIZE = 12
const searchInputRef = ref(null)
const query = ref('')
const searchOpen = ref(false)
const comboboxOpen = ref(false)
const selectedPath = ref('')

const showResults = computed(() => searchOpen.value)
const searchPlaceholder = computed(() => t('Search files'))

onMounted(() => {
  files.ensureFlatFilesReady().catch((error) => {
    console.warn('[workspace-quick-open] flat file preload failed:', error)
  })
})

const workspaceFlatFiles = computed(() =>
  listWorkspaceFlatFileEntries({ flatFiles: files.flatFiles })
)

const titleMatches = computed(() => {
  const q = query.value.toLowerCase()
  if (!q) return workspaceFlatFiles.value.slice(0, 20)

  const list = workspaceFlatFiles.value.filter((file) => {
    const name = file.name.toLowerCase()
    const path = file.path.toLowerCase()
    let qi = 0
    for (let i = 0; i < name.length && qi < q.length; i += 1) {
      if (name[i] === q[qi]) qi += 1
    }
    return qi === q.length || path.includes(q)
  })

  list.sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    const aExact = aName.includes(q) ? 0 : 1
    const bExact = bName.includes(q) ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
    const aStarts = aName.startsWith(q) ? 0 : 1
    const bStarts = bName.startsWith(q) ? 0 : 1
    if (aStarts !== bStarts) return aStarts - bStarts
    return aName.localeCompare(bName)
  })

  return list.slice(0, 15)
})

watch(selectedPath, (path) => {
  if (typeof path === 'string' && path) {
    onSelectFile(path)
  }
})

function onSearchKeydown(event) {
  if (event.key === 'Escape') {
    closeSearchPalette()
    event.preventDefault()
  }
}

function onSelectFile(path) {
  workspace.openWorkspaceSurface()
  editorStore.openFile(path)
  closeSearchPalette()
}

function relativePath(path) {
  if (workspace.path && path.startsWith(workspace.path)) {
    return path.slice(workspace.path.length + 1)
  }
  return path
}

function focusSearchInput() {
  nextTick(() => {
    searchInputRef.value?.focus?.()
    searchInputRef.value?.select?.()
  })
}

function handleOpenAutoFocus(event) {
  event.preventDefault()
  focusSearchInput()
}

function handleDialogOpenChange(open) {
  if (open) {
    searchOpen.value = true
    comboboxOpen.value = true
    focusSearchInput()
    return
  }
  closeSearchPalette()
}

function focusSearch() {
  searchOpen.value = true
  comboboxOpen.value = true
  selectedPath.value = ''
  focusSearchInput()
}

function closeSearchPalette() {
  searchOpen.value = false
  comboboxOpen.value = false
  selectedPath.value = ''
  query.value = ''
  searchInputRef.value?.blur?.()
}

defineExpose({ focusSearch })
</script>

<style scoped>
.workspace-quick-open-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: color-mix(in srgb, var(--overlay-backdrop) 22%, transparent);
  backdrop-filter: blur(4px);
}

.workspace-quick-open-shell {
  position: fixed;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  width: min(640px, calc(100vw - 56px));
  z-index: 9999;
  border: none;
  background: transparent;
  box-shadow: none;
  padding: 0;
  outline: none;
}

.workspace-quick-open-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid color-mix(in srgb, var(--shell-border) 12%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--panel-surface) 48%, var(--shell-surface));
  box-shadow: 0 16px 32px color-mix(in srgb, black 8%, transparent);
  backdrop-filter: blur(18px) saturate(0.94);
}

.workspace-quick-open-input-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 38px;
  padding: 0 12px;
  border-color: color-mix(in srgb, var(--shell-border) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--shell-border) 9%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--workspace-paper) 14%, transparent);
  box-shadow: none;
}

.workspace-quick-open-input {
  width: 100%;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 14px;
  outline: none;
}

.workspace-quick-open-input::placeholder {
  color: color-mix(in srgb, var(--text-muted) 82%, transparent);
  opacity: 1;
}

.workspace-quick-open-search-icon {
  color: color-mix(in srgb, var(--text-muted) 86%, transparent);
}

.workspace-quick-open-input-wrap:focus-within {
  border-color: color-mix(in srgb, var(--shell-border) 12%, transparent);
  background: color-mix(in srgb, var(--workspace-paper) 18%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-ring) 22%, transparent);
}

.workspace-quick-open-results {
  position: relative;
  padding-top: 0;
}

.workspace-quick-open-results :deep(.search-results-list) {
  max-height: min(62vh, 440px);
}
</style>
