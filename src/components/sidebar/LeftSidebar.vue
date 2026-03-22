<template>
  <div ref="containerEl" class="flex flex-col h-full overflow-hidden bg-[var(--bg-secondary)]">
    <!-- Explorer section -->
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

    <!-- Resize handle: explorer ↔ refs (when both expanded) -->
    <div
      v-if="showHandleExplorerRefs"
      class="relative h-0.5 shrink-0 cursor-row-resize bg-transparent"
      @mousedown="startResizeRefs"
    >
      <!-- Visual handle, stays at 1px -->
      <div
        class="absolute left-0 right-0 top-0.5 -translate-y-1/2 h-4 w-full z-10"
        
      ></div>
      <!-- Hover indicator remains at 1px high for visual, but you can increase its opacity or style on hover if needed -->
    </div>

    <!-- References section -->
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

    <!-- Resize handle: refs ↔ outline (when both expanded) -->
    <div
      v-if="showOutlineSection && showHandleRefsOutline"
      class="relative h-0.5 shrink-0 cursor-row-resize bg-transparent"
      @mousedown="startResizeOutline"
    >
      <div class="absolute left-0 right-0 top-0.5 -translate-y-1/2 h-4 w-full z-10"></div>
    </div>

    <!-- Outline section -->
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
        <span class="ui-text-xs font-medium uppercase tracking-wider">Outline</span>
      </button>

      <div v-if="!outlineCollapsed" class="flex-1 min-h-0">
        <OutlinePanel v-if="outlineLoaded" embedded />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, defineAsyncComponent, computed } from 'vue'
import { useLeftSidebarPanels } from '../../composables/useLeftSidebarPanels'
import { useWorkspaceStore } from '../../stores/workspace'
import { useI18n } from '../../i18n'
import FileTree from './FileTree.vue'

const ReferenceList = defineAsyncComponent(() => import('./ReferenceList.vue'))
const OutlinePanel = defineAsyncComponent(() => import('../panel/OutlinePanel.vue'))

const emit = defineEmits(['file-version-history', 'open-folder', 'open-workspace', 'close-folder'])

const workspace = useWorkspaceStore()
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
const fileTreeHeadingLabel = computed(() => (
  workspace.primarySurface === 'workspace' ? '' : t('Project files')
))
const referencesHeadingLabel = computed(() => (
  workspace.primarySurface === 'workspace' ? t('References') : t('Project references')
))

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
