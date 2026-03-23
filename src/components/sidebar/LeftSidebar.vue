<template>
  <div class="flex flex-col h-full overflow-hidden bg-[var(--bg-secondary)]">
    <template v-if="workspace.isWorkspaceSurface && activePanel !== 'references'">
      <FileTree
        ref="fileTreeRef"
        :collapsed="false"
        :heading-collapsible="false"
        :heading-label="fileTreeHeadingLabel"
        @file-version-history="$emit('file-version-history', $event)"
        @open-folder="$emit('open-folder')"
        @open-workspace="$emit('open-workspace', $event)"
        @close-folder="$emit('close-folder')"
      />
    </template>

    <template v-else-if="workspace.isWorkspaceSurface">
      <ReferenceList
        :collapsed="false"
        :heading-collapsible="false"
        :heading-label="referencesHeadingLabel"
      />
    </template>

    <LibrarySidebar v-else-if="workspace.isLibrarySurface" />

    <AiWorkbenchSidebar v-else class="flex-1 min-h-0 overflow-hidden" />
  </div>
</template>

<script setup>
import { ref, defineAsyncComponent, computed, nextTick } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useI18n } from '../../i18n'
import { normalizeWorkbenchSidebarPanel } from '../../shared/workbenchSidebarPanels'
import FileTree from './FileTree.vue'

const ReferenceList = defineAsyncComponent(() => import('./ReferenceList.vue'))
const LibrarySidebar = defineAsyncComponent(() => import('./LibrarySidebar.vue'))
const AiWorkbenchSidebar = defineAsyncComponent(() => import('./AiWorkbenchSidebar.vue'))

const emit = defineEmits(['file-version-history', 'open-folder', 'open-workspace', 'close-folder'])

const workspace = useWorkspaceStore()
const { t } = useI18n()
const fileTreeRef = ref(null)
const activePanel = computed(() => normalizeWorkbenchSidebarPanel(
  workspace.primarySurface,
  workspace.leftSidebarPanel,
))

const fileTreeHeadingLabel = computed(() => (
  workspace.primarySurface === 'workspace' ? '' : t('Project files')
))
const referencesHeadingLabel = computed(() => (
  workspace.primarySurface === 'workspace' ? t('References') : t('Project references')
))

async function focusFileTree(method, ...args) {
  if (!workspace.isWorkspaceSurface) {
    workspace.openWorkspaceSurface()
    await nextTick()
  }
  if (activePanel.value !== 'files') {
    workspace.setLeftSidebarPanel('files')
    await nextTick()
  }
  fileTreeRef.value?.[method]?.(...args)
}

// Expose FileTree methods for App.vue
defineExpose({
  async createNewFile(ext = '.md') {
    await focusFileTree('createNewFile', ext)
  },
  async activateFilter() {
    await focusFileTree('activateFilter')
  },
})
</script>
