<template>
  <div class="document-plugins-panel">
    <div v-if="containers.length === 0" class="document-plugins-panel__empty">
      {{ t('No document plugins available') }}
    </div>

    <div v-else class="document-plugins-panel__shell">
      <div class="document-plugins-panel__switcher" role="tablist" :aria-label="t('Document plugins')">
        <button
          v-for="container in containers"
          :key="container.panelId"
          type="button"
          class="document-plugins-panel__switcher-button"
          :class="{ 'is-active': activePanelId === container.panelId }"
          :title="containerTitle(container)"
          :aria-selected="activePanelId === container.panelId"
          role="tab"
          @click="activePanelId = container.panelId"
        >
          <span class="document-plugins-panel__switcher-label">{{ containerTitle(container) }}</span>
          <span
            v-if="containerBadge(container) != null"
            class="document-plugins-panel__switcher-badge"
            :title="containerBadgeTooltip(container)"
          >
            {{ containerBadge(container) }}
          </span>
        </button>
      </div>

      <div class="document-plugins-panel__active-meta">
        <div class="document-plugins-panel__active-title">{{ activeContainerTitle }}</div>
        <div v-if="activeContainerDescription" class="document-plugins-panel__active-description">
          {{ activeContainerDescription }}
        </div>
      </div>

      <div class="document-plugins-panel__stack">
        <ExtensionSidebarPanel
          v-if="activeContainer"
          :key="activeContainer.panelId"
          :container="activeContainer"
          :context="extensionContext"
          :target="extensionTarget"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useExtensionsStore } from '../../stores/extensions'
import { useI18n } from '../../i18n'
import { buildExtensionContext } from '../../domains/extensions/extensionContext.js'
import ExtensionSidebarPanel from '../extensions/ExtensionSidebarPanel.vue'

const props = defineProps({
  filePath: { type: String, required: true },
})

const { t } = useI18n()
const extensionsStore = useExtensionsStore()
const activePanelId = ref('')

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

watch(containers, (next) => {
  if (!next.length) {
    activePanelId.value = ''
    return
  }
  if (!next.some((container) => container.panelId === activePanelId.value)) {
    activePanelId.value = next[0].panelId
  }
}, { immediate: true })

const activeContainer = computed(() =>
  containers.value.find((container) => container.panelId === activePanelId.value) || containers.value[0] || null
)

const activeContainerTitle = computed(() =>
  activeContainer.value ? containerTitle(activeContainer.value) : ''
)

const activeContainerDescription = computed(() => {
  const container = activeContainer.value
  if (!container) return ''
  const firstView = extensionsStore.viewsForContainer(container.id, extensionContext.value)[0]
  if (!firstView) return ''
  return extensionsStore.viewStateFor(`${firstView.extensionId}:${firstView.id}`)?.description || ''
})

function containerTitle(container = {}) {
  return t(container.title || container.id || 'Plugin')
}

function containerBadge(container = {}) {
  const firstView = extensionsStore.viewsForContainer(container.id, extensionContext.value)[0]
  if (!firstView) return null
  return extensionsStore.viewStateFor(`${firstView.extensionId}:${firstView.id}`)?.badgeValue ?? null
}

function containerBadgeTooltip(container = {}) {
  const firstView = extensionsStore.viewsForContainer(container.id, extensionContext.value)[0]
  if (!firstView) return ''
  return extensionsStore.viewStateFor(`${firstView.extensionId}:${firstView.id}`)?.badgeTooltip || ''
}
</script>

<style scoped>
.document-plugins-panel {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
}

.document-plugins-panel__shell {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.document-plugins-panel__switcher {
  display: flex;
  gap: 6px;
  padding: 8px 8px 0;
  overflow-x: auto;
}

.document-plugins-panel__switcher-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 28px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-base) 88%, transparent);
  color: var(--text-secondary);
  font-size: 12px;
}

.document-plugins-panel__switcher-button.is-active {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
  background: color-mix(in srgb, var(--accent) 14%, var(--surface-hover));
  color: var(--text-primary);
}

.document-plugins-panel__switcher-label {
  white-space: nowrap;
}

.document-plugins-panel__switcher-badge {
  display: inline-flex;
  align-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 18%, var(--surface-hover));
  color: var(--text-primary);
  font-size: 10px;
}

.document-plugins-panel__active-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px 0;
}

.document-plugins-panel__active-title {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.document-plugins-panel__active-description {
  color: var(--text-muted);
  font-size: 11px;
}

.document-plugins-panel__stack {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  padding: 8px;
  overflow: hidden;
}

.document-plugins-panel__empty {
  padding: 16px;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
