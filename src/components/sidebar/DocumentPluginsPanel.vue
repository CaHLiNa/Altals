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
        <div v-if="hostDiagnosticSummary" class="document-plugin-page__diagnostics" :class="hostDiagnosticToneClass">
          <div class="document-plugin-page__diagnostics-header">
            <div class="document-plugin-page__diagnostics-title">
              {{ t('Host Runtime') }}
            </div>
            <button
              v-if="showPromptRecoveryAction"
              type="button"
              class="document-plugin-page__diagnostics-action"
              :disabled="promptRecoveryBusy"
              @click="void recoverPrompt()"
            >
              {{ promptRecoveryBusy ? t('Cancelling...') : t('Cancel Prompt') }}
            </button>
          </div>
          <div class="document-plugin-page__diagnostics-copy">
            {{ hostDiagnosticSummary }}
          </div>
        </div>
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
import { useExtensionPromptRecovery } from '../../composables/useExtensionPromptRecovery'
import { buildExtensionContext } from '../../domains/extensions/extensionContext.js'
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
  const diagnostics = hostDiagnostics.value
  if (!diagnostics?.hasLiveRuntime && !diagnostics?.ownsPendingPrompt && !diagnostics?.blockedByForeignPrompt) return ''

  const segments = []
  if (diagnostics.hasActiveWorkspaceRuntime) {
    const label = diagnostics.activeWorkspaceSlotCount > 1
      ? t('Active in {count} slots for this workspace', { count: diagnostics.activeWorkspaceSlotCount })
      : t('Active in this workspace')
    segments.push(label)
  } else if (diagnostics.activated) {
    segments.push(t('Runtime activated but no active slot is attached to this workspace'))
  }

  if (diagnostics.hasOtherWorkspaceRuntime) {
    const roots = diagnostics.otherWorkspaceRoots.join(' · ')
    segments.push(
      diagnostics.otherWorkspaceSlotCount > 1
        ? t('Also active in other workspaces: {roots}', { roots })
        : t('Also active in another workspace: {roots}', { roots }),
    )
  }

  if (diagnostics.blockedByForeignPrompt) {
    segments.push(
      t('Blocked by prompt from {extensionId} in {workspace}', {
        extensionId: diagnostics.pendingPromptOwner?.extensionId || '',
        workspace: diagnostics.blockingPromptWorkspaceRoot || '/',
      }),
    )
  }

  if (diagnostics.ownsPendingPrompt) {
    segments.push(
      diagnostics.pendingPromptInActiveWorkspace
        ? t('Waiting for prompt input in this workspace')
        : t('Waiting for prompt input in {workspace}', {
          workspace: diagnostics.pendingPromptWorkspaceRoot || '/',
        }),
    )
  }

  return segments.join(' · ')
})

const hostDiagnosticToneClass = computed(() => {
  const diagnostics = hostDiagnostics.value
  if (!diagnostics?.hasLiveRuntime && !diagnostics?.ownsPendingPrompt && !diagnostics?.blockedByForeignPrompt) return ''
  if (diagnostics?.ownsPendingPrompt || diagnostics?.blockedByForeignPrompt) return 'is-warning'
  if (diagnostics?.hasOtherWorkspaceRuntime) return 'is-info'
  return 'is-active'
})

const showPromptRecoveryAction = computed(() => {
  return promptRecovery.value.available
})

const promptRecoveryExtensionId = computed(() => {
  const diagnostics = hostDiagnostics.value
  if (diagnostics?.ownsPendingPrompt && diagnostics?.pendingPromptInActiveWorkspace) {
    return container.value?.extensionId || ''
  }
  if (diagnostics?.blockedByForeignPrompt) {
    return diagnostics.pendingPromptOwner?.extensionId || ''
  }
  return ''
})

const promptRecoveryWorkspaceRoot = computed(() => {
  const diagnostics = hostDiagnostics.value
  if (diagnostics?.ownsPendingPrompt && diagnostics?.pendingPromptInActiveWorkspace) {
    return workspace.path || ''
  }
  if (diagnostics?.blockedByForeignPrompt) {
    return diagnostics.blockingPromptWorkspaceRoot || ''
  }
  return ''
})

async function recoverPrompt() {
  await cancelPromptRecovery()
}

const {
  busy: promptRecoveryBusy,
  descriptor: promptRecovery,
  cancel: cancelPromptRecovery,
} = useExtensionPromptRecovery(() => ({
  extensionId: promptRecoveryExtensionId.value,
  workspaceRoot: promptRecoveryWorkspaceRoot.value,
}))
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

.document-plugin-page__diagnostics {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-elevated) 78%, transparent);
}

.document-plugin-page__diagnostics-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.document-plugin-page__diagnostics.is-active {
  border-color: color-mix(in srgb, var(--accent) 26%, var(--border));
}

.document-plugin-page__diagnostics.is-info {
  border-color: color-mix(in srgb, var(--accent) 20%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-elevated));
}

.document-plugin-page__diagnostics.is-warning {
  border-color: color-mix(in srgb, #d97706 32%, var(--border));
  background: color-mix(in srgb, #d97706 8%, var(--surface-elevated));
}

.document-plugin-page__diagnostics-title {
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.document-plugin-page__diagnostics-action {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.document-plugin-page__diagnostics-action:disabled {
  cursor: default;
  opacity: 0.6;
}

.document-plugin-page__diagnostics-copy {
  color: var(--text-primary);
  font-size: 11px;
  line-height: 1.45;
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
