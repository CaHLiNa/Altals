<template>
  <div
    v-if="hasEverOpened"
    v-show="workspace.bottomPanelOpen"
    class="flex shrink-0 flex-col overflow-hidden"
    :style="{ height: `${props.panelHeight}px` }"
  >
    <TerminalWorkbench ref="workbenchRef" />
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { useTerminalStore } from '../../stores/terminal'
import { useWorkspaceStore } from '../../stores/workspace'
import TerminalWorkbench from '../terminal/TerminalWorkbench.vue'

const props = defineProps({
  panelHeight: {
    type: Number,
    required: true,
  },
})

const workspace = useWorkspaceStore()
const terminalStore = useTerminalStore()
const workbenchRef = ref(null)
const hasEverOpened = ref(workspace.bottomPanelOpen)

async function hydrateForWorkspace(force = false) {
  if (force) {
    await terminalStore.resetForWorkspace()
  }
  terminalStore.hydrateForWorkspace(force)
}

async function ensureVisibleWorkbench() {
  if (!hasEverOpened.value) hasEverOpened.value = true
  terminalStore.hydrateForWorkspace()
  if (terminalStore.instances.length === 0) {
    terminalStore.ensureDefaultShell()
  }
  workspace.openBottomPanel()
  await nextTick()
  workbenchRef.value?.focusActiveSurface?.()
}

watch(
  () => workspace.path,
  async (nextPath, previousPath) => {
    if (nextPath === previousPath) return
    if (!nextPath) {
      await terminalStore.resetForWorkspace()
      return
    }
    await hydrateForWorkspace(Boolean(previousPath))
    if (workspace.bottomPanelOpen && terminalStore.instances.length === 0) {
      terminalStore.ensureDefaultShell()
    }
  },
)

watch(
  () => workspace.bottomPanelOpen,
  async (open) => {
    if (!open) return
    hasEverOpened.value = true
    terminalStore.hydrateForWorkspace()
    if (terminalStore.instances.length === 0) {
      terminalStore.ensureDefaultShell()
    }
    await nextTick()
    workbenchRef.value?.refitAllSurfaces?.()
  },
)

onMounted(async () => {
  terminalStore.hydrateForWorkspace()
  if (workspace.bottomPanelOpen && terminalStore.instances.length === 0) {
    terminalStore.ensureDefaultShell()
  }
})

defineExpose({
  async focusTerminal() {
    await ensureVisibleWorkbench()
  },
})
</script>
