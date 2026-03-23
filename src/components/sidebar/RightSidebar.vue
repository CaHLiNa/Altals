<template>
  <div class="right-shell-sidebar">
    <div v-if="workspace.isLibrarySurface" class="right-shell-pane">
      <LibraryInspectorSidebar />
    </div>

    <div v-else-if="activePanel === 'outline'" class="right-shell-pane">
      <OutlinePanel embedded :override-active-file="documentTab" />
    </div>

    <div v-else class="right-shell-pane">
      <Backlinks :override-active-file="documentTab" />
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import { normalizeWorkbenchInspectorPanel } from '../../shared/workbenchInspectorPanels.js'
import { isAiLauncher, isChatTab, isLibraryPath, isNewTab } from '../../utils/fileTypes'

const OutlinePanel = defineAsyncComponent(() => import('../panel/OutlinePanel.vue'))
const Backlinks = defineAsyncComponent(() => import('../panel/Backlinks.vue'))
const LibraryInspectorSidebar = defineAsyncComponent(() => import('./LibraryInspectorSidebar.vue'))

const editorStore = useEditorStore()
const workspace = useWorkspaceStore()

const lastDocumentTab = ref(null)

const activePanel = computed(() => (
  normalizeWorkbenchInspectorPanel(workspace.primarySurface, workspace.rightSidebarPanel)
))

const documentTab = computed(() => {
  const active = editorStore.activeTab
  if (
    active
    && !isChatTab(active)
    && !isAiLauncher(active)
    && !isNewTab(active)
    && !isLibraryPath(active)
  ) {
    return active
  }
  return lastDocumentTab.value
})

watch(
  () => editorStore.activeTab,
  (tab) => {
    if (
      tab
      && !isChatTab(tab)
      && !isAiLauncher(tab)
      && !isNewTab(tab)
      && !isLibraryPath(tab)
    ) {
      lastDocumentTab.value = tab
    }
  },
  { flush: 'post', immediate: true },
)
</script>

<style scoped>
.right-shell-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-secondary);
}

.right-shell-pane {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
</style>
