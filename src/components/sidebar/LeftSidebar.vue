<template>
  <div ref="containerEl" class="left-sidebar-shell">
    <WorkspaceSidebarOverview
      @focus-search="focusSearch"
      @create-save-point="createSavePoint"
      @open-saved-versions="openWorkspaceSnapshots"
      @open-active-file-history="openActiveFileHistory"
    />

    <div class="left-sidebar-resources">
      <div
        class="overflow-hidden"
        :style="explorerStyle"
      >
        <FileTree
          ref="fileTreeRef"
          :collapsed="explorerCollapsed"
          :heading-label="fileTreeHeadingLabel"
          @toggle-collapse="toggleExplorer"
          @file-version-history="$emit('file-version-history', $event)"
          @open-folder="$emit('open-folder')"
          @open-workspace="$emit('open-workspace', $event)"
          @close-folder="$emit('close-folder')"
        />
      </div>

      <div
        v-if="showHandleExplorerRefs"
        class="relative h-0.5 shrink-0 cursor-row-resize bg-transparent"
        @mousedown="startResizeRefs"
      >
        <div class="absolute left-0 right-0 top-0.5 -translate-y-1/2 h-4 w-full z-10"></div>
      </div>

      <div
        class="overflow-hidden relative border-t border-[var(--border)]"
        :style="refsStyle"
      >
        <ReferenceList
          v-if="refsLoaded"
          :collapsed="refsCollapsed"
          :heading-label="referencesHeadingLabel"
          @toggle-collapse="toggleRefs"
        />
        <button
          v-else
          type="button"
          class="flex items-center w-full h-7 px-2 gap-1 select-none"
          :style="{ color: 'var(--fg-muted)' }"
          @click="toggleRefs"
        >
          <svg
            width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
          >
            <path d="M6 4l4 4-4 4"/>
          </svg>
          <span class="ui-text-xs font-medium uppercase tracking-wider">{{ referencesHeadingLabel }}</span>
        </button>
      </div>

      <div
        v-if="showOutlineSection && showHandleRefsOutline"
        class="relative h-0.5 shrink-0 cursor-row-resize bg-transparent"
        @mousedown="startResizeOutline"
      >
        <div class="absolute left-0 right-0 top-0.5 -translate-y-1/2 h-4 w-full z-10"></div>
      </div>

      <div
        v-if="showOutlineSection"
        class="overflow-hidden relative border-t border-[var(--border)] flex flex-col"
        :style="outlineStyle"
      >
        <button
          type="button"
          class="flex items-center w-full h-7 px-2 gap-1 select-none shrink-0"
          :style="{ color: 'var(--fg-muted)' }"
          @click="toggleOutline"
        >
          <svg
            width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
            :style="{ transform: outlineCollapsed ? '' : 'rotate(90deg)', transition: 'transform 0.1s' }"
          >
            <path d="M6 4l4 4-4 4"/>
          </svg>
          <span class="ui-text-xs font-medium uppercase tracking-wider">{{ t('Document outline') }}</span>
        </button>

        <div v-if="!outlineCollapsed" class="flex-1 min-h-0">
          <OutlinePanel v-if="outlineLoaded" embedded />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, defineAsyncComponent, computed } from 'vue'
import { useLeftSidebarPanels } from '../../composables/useLeftSidebarPanels'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEditorStore } from '../../stores/editor'
import { useI18n } from '../../i18n'
import FileTree from './FileTree.vue'
import WorkspaceSidebarOverview from './WorkspaceSidebarOverview.vue'

const ReferenceList = defineAsyncComponent(() => import('./ReferenceList.vue'))
const OutlinePanel = defineAsyncComponent(() => import('../panel/OutlinePanel.vue'))

const emit = defineEmits(['file-version-history', 'open-folder', 'open-workspace', 'close-folder'])

const workspace = useWorkspaceStore()
const editorStore = useEditorStore()
const { t } = useI18n()
const containerEl = ref(null)
const fileTreeRef = ref(null)
const {
  explorerCollapsed,
  refsCollapsed,
  outlineCollapsed,
  refsLoaded,
  outlineLoaded,
  explorerStyle,
  refsStyle,
  outlineStyle,
  showHandleExplorerRefs,
  showHandleRefsOutline,
  toggleExplorer,
  toggleRefs,
  toggleOutline,
  startResizeRefs,
  startResizeOutline,
} = useLeftSidebarPanels(containerEl)

const showOutlineSection = computed(() => workspace.primarySurface === 'workspace')
const fileTreeHeadingLabel = computed(() => t('Project files'))
const referencesHeadingLabel = computed(() => t('Evidence sources'))

function focusSearch() {
  window.dispatchEvent(new CustomEvent('app:focus-search'))
}

function createSavePoint() {
  window.dispatchEvent(new CustomEvent('app:create-snapshot'))
}

function openWorkspaceSnapshots() {
  window.dispatchEvent(new CustomEvent('app:open-workspace-snapshots'))
}

function openActiveFileHistory() {
  const path = editorStore.preferredContextPath || ''
  if (!path) return
  emit('file-version-history', { path })
}

// Expose FileTree methods for App.vue
defineExpose({
  createNewFile(ext = '.md') {
    fileTreeRef.value?.createNewFile(ext)
  },
  activateFilter() {
    fileTreeRef.value?.activateFilter()
  },
})
</script>

<style scoped>
.left-sidebar-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 92%, #f8f4ea 8%), var(--bg-secondary));
}

.left-sidebar-resources {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}
</style>
