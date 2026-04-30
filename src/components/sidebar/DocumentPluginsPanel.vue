<template>
  <div class="document-plugins-panel">
    <div v-if="containers.length === 0" class="document-plugins-panel__empty">
      {{ t('No document plugins available') }}
    </div>

    <div v-else class="document-plugins-panel__stack">
      <ExtensionSidebarPanel
        v-for="container in containers"
        :key="container.panelId"
        :container="container"
        :context="extensionContext"
        :target="extensionTarget"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useExtensionsStore } from '../../stores/extensions'
import { useI18n } from '../../i18n'
import { buildExtensionContext } from '../../domains/extensions/extensionContext.js'
import ExtensionSidebarPanel from '../extensions/ExtensionSidebarPanel.vue'

const props = defineProps({
  filePath: { type: String, required: true },
})

const { t } = useI18n()
const extensionsStore = useExtensionsStore()

const extensionTarget = computed(() => ({
  kind: String(props.filePath || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'workspace',
  referenceId: '',
  path: String(props.filePath || ''),
}))

const extensionContext = computed(() =>
  buildExtensionContext(extensionTarget.value, {
    workbench: {
      surface: 'workspace',
      panel: 'documentDock',
      activeView: 'documentDock.plugins',
      hasWorkspace: true,
    },
  })
)

const containers = computed(() =>
  extensionsStore.sidebarViewContainers.filter((container) =>
    extensionsStore.viewsForContainer(container.id, extensionContext.value).length > 0
  )
)
</script>

<style scoped>
.document-plugins-panel {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
}

.document-plugins-panel__stack {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  padding: 8px;
  overflow-y: auto;
}

.document-plugins-panel__empty {
  padding: 16px;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
