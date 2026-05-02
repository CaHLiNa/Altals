<template>
  <div class="document-plugin-page">
    <div v-if="!container" class="document-plugin-page__empty">
      {{ t('No document plugins available') }}
    </div>

    <div v-else class="document-plugin-page__shell">
      <div class="document-plugin-page__meta">
        <div class="document-plugin-page__title-row">
          <div class="document-plugin-page__title">{{ containerTitle }}</div>
          <span
            v-if="containerBadge != null"
            class="document-plugin-page__badge"
            :title="containerBadgeTooltip"
          >
            {{ containerBadge }}
          </span>
        </div>
        <div v-if="containerDescription" class="document-plugin-page__description">
          {{ containerDescription }}
        </div>
        <div v-if="targetSummary" class="document-plugin-page__target">
          {{ targetSummary }}
        </div>
        <ExtensionHostStatusSurface
          v-if="hostDiagnosticSummary"
          :title="t('Host Runtime')"
          :description="hostDiagnosticSummary"
          :tone-class="hostDiagnosticToneClass"
          :recovery-action="recoveryAction"
          compact
          @recover="void triggerRecoveryAction()"
        />
      </div>

      <div class="document-plugin-page__content">
        <div class="document-plugin-page__stack">
          <ExtensionSidebarPanel
            :key="container.panelId"
            :container="container"
            :context="extensionContext"
            :target="resolvedTarget"
          />
        </div>
        <section v-if="extensionTasks.length > 0" class="document-plugin-page__tasks">
          <div class="document-plugin-page__section-title">{{ t('Plugin Tasks') }}</div>
          <ExtensionTaskPanel :extension-id="container.extensionId" />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useExtensionsStore } from '../../stores/extensions'
import { useWorkspaceStore } from '../../stores/workspace'
import { useI18n } from '../../i18n'
import { useExtensionHostStatusPresentation } from '../../composables/useExtensionHostStatusPresentation'
import { buildExtensionContext } from '../../domains/extensions/extensionContext.js'
import { buildExtensionHostStatusSurface } from '../../domains/extensions/extensionHostStatusSurface'
import ExtensionHostStatusSurface from '../extensions/ExtensionHostStatusSurface.vue'
import ExtensionSidebarPanel from '../extensions/ExtensionSidebarPanel.vue'
import ExtensionTaskPanel from '../extensions/ExtensionTaskPanel.vue'

const props = defineProps({
  filePath: { type: String, default: '' },
  panelId: { type: String, required: true },
})

const { t } = useI18n()
const workspace = useWorkspaceStore()
const extensionsStore = useExtensionsStore()

const fallbackTarget = computed(() => ({
  kind: String(props.filePath || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'workspace',
  referenceId: '',
  path: String(props.filePath || ''),
}))

const container = computed(() => extensionsStore.containerForPanelId(props.panelId))
const resolvedTarget = computed(() =>
  extensionsStore.sidebarTargetForPanel(props.panelId, fallbackTarget.value)
)

const extensionContext = computed(() =>
  buildExtensionContext(resolvedTarget.value, {
    workbench: {
      surface: 'workspace',
      panel: 'documentDock',
      activeView: String(props.panelId || ''),
      hasWorkspace: workspace.isOpen,
      workspaceFolder: workspace.path || '',
    },
  })
)

const firstView = computed(() => {
  const currentContainer = container.value
  if (!currentContainer) return null
  return extensionsStore.viewsForContainer(currentContainer.id, extensionContext.value)[0] || null
})

const firstViewState = computed(() => {
  const view = firstView.value
  if (!view) return null
  return extensionsStore.viewStateFor(`${view.extensionId}:${view.id}`) || null
})

const containerTitle = computed(() =>
  t(container.value?.title || container.value?.id || 'Plugin')
)
const containerDescription = computed(() => String(firstViewState.value?.description || ''))
const containerBadge = computed(() => firstViewState.value?.badgeValue ?? null)
const containerBadgeTooltip = computed(() => String(firstViewState.value?.badgeTooltip || ''))
const extensionTasks = computed(() =>
  container.value?.extensionId
    ? extensionsStore.recentTasksForExtension(container.value.extensionId)
    : []
)
const hostDiagnostics = computed(() =>
  container.value?.extensionId
    ? extensionsStore.hostDiagnosticsFor(container.value.extensionId, workspace.path || '')
    : null
)
const hostStatusSurface = computed(() =>
  buildExtensionHostStatusSurface(hostDiagnostics.value || {})
)
const {
  presentation: hostStatusPresentation,
  recoveryAction,
  triggerRecoveryAction,
} = useExtensionHostStatusPresentation(() => hostStatusSurface.value)

const targetSummary = computed(() => {
  const target = resolvedTarget.value
  if (target.referenceId && target.path) {
    return t('Target: {path} · ref:{referenceId}', {
      path: target.path,
      referenceId: target.referenceId,
    })
  }
  if (target.path) {
    return t('Target: {path}', { path: target.path })
  }
  if (target.referenceId) {
    return t('Target reference: {referenceId}', { referenceId: target.referenceId })
  }
  return ''
})

const hostDiagnosticSummary = computed(() => {
  return hostStatusPresentation.value.summaryText
})

const hostDiagnosticToneClass = computed(() => {
  return hostStatusPresentation.value.toneClass || ''
})

</script>

<style scoped>
.document-plugin-page {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
}

.document-plugin-page__shell {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.document-plugin-page__meta {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px 0;
}

.document-plugin-page__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.document-plugin-page__title {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.document-plugin-page__badge {
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

.document-plugin-page__description,
.document-plugin-page__target,
.document-plugin-page__empty {
  color: var(--text-muted);
  font-size: 11px;
}

.document-plugin-page__content {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  padding: 8px;
  overflow: hidden;
}

.document-plugin-page__stack {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.document-plugin-page__tasks {
  flex: 0 0 auto;
  border-top: 1px solid color-mix(in srgb, var(--border) 36%, transparent);
  padding-top: 8px;
}

.document-plugin-page__section-title {
  padding: 0 8px 6px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.document-plugin-page__empty {
  padding: 16px;
}
</style>
