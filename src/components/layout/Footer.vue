<template>
  <footer class="footer-shell">
    <div class="footer-side footer-left">
      <span v-if="wordSummary" class="footer-chip">
        {{ wordSummary }}
      </span>

      <button
        v-if="workspace.githubUser"
        ref="syncTriggerRef"
        type="button"
        class="footer-chip footer-chip-button"
        :class="`is-${syncTone}`"
        @click="toggleSyncPopover"
        :title="syncTooltip"
      >
        {{ syncLabel || t('GitHub connected') }}
      </button>

      <button
        v-if="reviews.pendingCount > 0"
        ref="pendingTriggerRef"
        type="button"
        class="footer-chip footer-chip-button is-warning"
        @click="togglePendingPopover"
      >
        {{ t('{count} pending change(s)', { count: reviews.pendingCount }) }}
      </button>
    </div>

    <!-- CENTER: snapshot-label prompt or transient status messaging -->
    <div class="footer-center">
      <div class="footer-center-layer" :class="{ 'footer-center-hidden': snapshotLabelPromptActive || centerMessage || uxStatusEntry }"></div>

      <!-- Snapshot-label prompt (shown during 8s window) -->
      <div class="footer-center-layer flex items-center gap-1" :class="{ 'footer-center-hidden': !snapshotLabelPromptActive }">
      
        <IconCheck width="12" height="12" style="color: var(--success);" />
        <div class="font-medium ui-text-sm pe-2" style="color: var(--success);">
          {{ t('Saved') }}
        </div>
        <div
          class="cursor-pointer underline hover:opacity-80 ui-text-sm font-medium"
          style="color: var(--accent);"
          @click="openSnapshotLabelDialog"
        >{{ t('Name this version?') }}</div>
      </div>

      <!-- Transient center message (e.g. "All saved (no changes)") -->
      <div class="footer-center-layer" :class="{ 'footer-center-hidden': !centerMessage }">
        <span class="flex items-center gap-1.5 ui-text-sm" style="color: var(--success);">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5 6.5-7"/></svg>
          {{ centerMessage }}
        </span>
      </div>

      <div class="footer-center-layer" :class="{ 'footer-center-hidden': !!centerMessage || snapshotLabelPromptActive || !uxStatusEntry }">
        <span class="flex items-center gap-1.5 ui-text-sm" :style="{ color: uxStatusColor }">
          <svg v-if="uxStatusEntry?.type === 'success'" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5 6.5-7"/></svg>
          <svg v-else-if="uxStatusEntry?.type === 'error' || uxStatusEntry?.type === 'warning'" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5l5.5 9.5H2.5L8 2.5z"/><path d="M8 6v3"/><path d="M8 11.25h.01"/></svg>
          <svg v-else width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 6v2.5"/><path d="M8 10.75h.01"/></svg>
          <span>{{ uxStatusEntry?.message }}</span>
          <button
            v-if="uxStatusEntry?.action"
            class="bg-transparent border-none cursor-pointer underline ui-text-sm"
            :style="{ color: 'var(--accent)' }"
            @click="handleUxStatusAction"
          >
            {{ uxStatusEntry.action.label }}
          </button>
        </span>
      </div>
    </div>

    <!-- Snapshot-label naming dialog -->
    <SnapshotDialog
      :visible="snapshotLabelDialogVisible"
      @resolve="resolveSnapshotLabelDialog"
    />

    <div class="footer-side footer-right">
      <button
        class="footer-quiet-button"
        :class="{ 'is-active': workspace.bottomPanelOpen }"
        @click="toggleTerminalPanel"
        :title="t('Toggle terminal ({shortcut})', { shortcut: `${modKey}+\`` })"
      >
        {{ t('Terminal') }}
      </button>
      <button
        class="footer-quiet-button"
        @click="$emit('open-workspace-snapshots')"
        :title="t('Saved versions')"
      >
        {{ t('Saved versions') }}
      </button>
      <button
        class="footer-quiet-button"
        @click="showShortcuts = !showShortcuts"
        :title="t('Keyboard shortcuts')"
      >
        {{ t('Shortcuts') }}
      </button>
      <button
        class="footer-quiet-button"
        :class="{ 'is-active': workspace.softWrap }"
        @click="workspace.toggleSoftWrap()"
        :title="workspace.softWrap ? t('Word wrap: on') : t('Word wrap: off')"
      >
        {{ t('Wrap') }}
      </button>

      <!-- Billing context display -->
      <template v-if="usageStore.showInFooter && footerBillingVisible">
        <span
          v-if="billingRoute?.route === 'direct'"
          class="footer-chip footer-chip-button"
          :class="{ 'is-danger': usageStore.isOverBudget, 'is-warning': usageStore.isNearBudget }"
          :title="t('Estimated API cost this month - check provider dashboards for actual charges')"
          @click="$emit('open-settings', 'models')">
          {{ t('{cost} this month', { cost: `~${formatCost(usageStore.directCost)}` }) }}
        </span>
      </template>

      <!-- Save message -->
      <span v-if="saveMessage"
        class="footer-inline-message transition-opacity"
        :style="{ opacity: saveMessageFading ? 0 : 1 }">
        {{ saveMessage }}
      </span>
    </div>
  </footer>

  <!-- Shortcuts popover -->
  <Teleport to="body">
    <div v-if="showShortcuts" class="fixed inset-0 z-50" @click="showShortcuts = false">
      <div class="fixed z-50 rounded-lg border overflow-hidden"
        style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 8px 24px rgba(0,0,0,0.4); width: 300px; bottom: 44px; right: 12px;"
        @click.stop>
        <div class="px-3 py-2 ui-text-xs font-medium uppercase tracking-wider"
          style="color: var(--fg-muted); border-bottom: 1px solid var(--border);">
          {{ t('Keyboard shortcuts') }}
        </div>
        <div class="px-3 py-2 space-y-1.5 ui-text-sm" style="color: var(--fg-secondary);">
          <div class="flex justify-between"><span>{{ t('Toggle left sidebar') }}</span><kbd>{{ modKey }}+B</kbd></div>
          <div class="flex justify-between"><span>{{ t('Quick open') }}</span><kbd>{{ modKey }}+P</kbd></div>
          <div class="flex justify-between"><span>{{ t('Save') }}</span><kbd>{{ modKey }}+S</kbd></div>
          <div class="flex justify-between"><span>{{ t('Close tab') }}</span><kbd>{{ modKey }}+W</kbd></div>
          <div class="flex justify-between"><span>{{ t('Split vertical') }}</span><kbd>{{ modKey }}+\</kbd></div>
          <div class="flex justify-between"><span>{{ t('Split horizontal') }}</span><kbd>{{ modKey }}+Shift+\</kbd></div>
          <div class="flex justify-between"><span>{{ t('Add comment') }}</span><kbd>{{ modKey }}+Shift+L</kbd></div>
          <div class="flex justify-between"><span>{{ t('Insert citation') }}</span><kbd>{{ modKey }}+Shift+C</kbd></div>
          <div class="flex justify-between"><span>{{ t('Toggle terminal') }}</span><kbd>{{ modKey }}+`</kbd></div>
          <div class="flex justify-between"><span>{{ t('Toggle word wrap') }}</span><kbd>{{ altKey }}+Z</kbd></div>
          <div class="mt-2 pt-2" style="border-top: 1px solid var(--border); color: var(--fg-muted);">{{ t('File Explorer') }}</div>
          <div class="flex justify-between"><span>{{ t('Navigate') }}</span><kbd>↑ / ↓</kbd></div>
          <div class="flex justify-between"><span>{{ t('Expand folder') }}</span><kbd>→</kbd></div>
          <div class="flex justify-between"><span>{{ t('Collapse / parent') }}</span><kbd>←</kbd></div>
          <div class="flex justify-between"><span>{{ t('Open') }}</span><kbd>Space</kbd></div>
          <div class="flex justify-between"><span>{{ t('Rename') }}</span><kbd>Enter</kbd></div>
          <div class="mt-2 pt-2" style="border-top: 1px solid var(--border); color: var(--fg-muted);">{{ t('Ghost Suggestions') }}</div>
          <div class="flex justify-between"><span>{{ t('Trigger') }}</span><kbd>++</kbd></div>
          <div class="flex justify-between"><span>{{ t('Accept') }}</span><kbd>Tab / Enter / Right</kbd></div>
          <div class="flex justify-between"><span>{{ t('Cycle') }}</span><kbd>Up / Down</kbd></div>
          <div class="flex justify-between"><span>{{ t('Cancel') }}</span><kbd>Esc / Left / click</kbd></div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Pending changes popover -->
  <Teleport to="body">
    <div v-if="showPendingPopover" class="fixed inset-0 z-50" @click="showPendingPopover = false">
      <div class="fixed z-50 rounded-lg border overflow-hidden"
        :style="pendingPopoverPos"
        style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 8px 24px rgba(0,0,0,0.4); min-width: 200px; max-width: 360px;"
        @click.stop>
        <div class="px-3 py-2 ui-text-xs font-medium uppercase tracking-wider"
          style="color: var(--fg-muted); border-bottom: 1px solid var(--border);">
          {{ t('Pending Changes') }}
        </div>
        <div class="py-1 max-h-48 overflow-y-auto">
          <div v-for="file in reviews.filesWithEdits" :key="file"
            class="px-3 py-1.5 ui-text-sm cursor-pointer flex items-center gap-2 hover:bg-[var(--bg-hover)]"
            style="color: var(--fg-secondary);"
            :title="file"
            @click="openPendingFile(file)">
            <span class="truncate">{{ file.split('/').pop() }}</span>
            <span class="ml-auto ui-text-xs shrink-0 px-1.5 rounded-full"
              style="background: rgba(224, 175, 104, 0.2); color: var(--warning);">
              {{ reviews.editsForFile(file).length }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Sync popover -->
  <Teleport to="body">
    <div v-if="showSyncPopover" class="fixed inset-0 z-50" @click="showSyncPopover = false">
      <div class="fixed z-50 rounded-lg border overflow-hidden"
        :style="syncPopoverPos"
        style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 8px 24px rgba(0,0,0,0.4);"
        @click.stop>
        <SyncPopover
          @sync-now="handleSyncNow"
          @refresh="handleSyncRefresh"
          @open-settings="handleOpenGitHubSettings"
        />
      </div>
    </div>
  </Teleport>

  <!-- Conflict dialog -->
  <GitHubConflictDialog
    :visible="showConflictDialog"
    @close="showConflictDialog = false"
  />
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useReviewsStore } from '../../stores/reviews'
import { useEditorStore } from '../../stores/editor'
import { useUsageStore } from '../../stores/usage'
import { useToastStore } from '../../stores/toast'
import { useUxStatusStore } from '../../stores/uxStatus'
import { getBillingRoute } from '../../services/apiClient'
import { ensureGitHubSyncReady } from '../../services/environmentPreflight'
import { useSnapshotLabelPrompt } from '../../app/changes/useSnapshotLabelPrompt.js'
import { modKey, altKey } from '../../platform'
import { useI18n } from '../../i18n'
import SyncPopover from './SyncPopover.vue'
import SnapshotDialog from './SnapshotDialog.vue'
import GitHubConflictDialog from '../GitHubConflictDialog.vue'
import { IconCheck } from '@tabler/icons-vue'

const emit = defineEmits(['open-settings', 'open-workspace-snapshots'])

const workspace = useWorkspaceStore()
const reviews = useReviewsStore()
const editorStore = useEditorStore()
const usageStore = useUsageStore()
const toastStore = useToastStore()
const uxStatusStore = useUxStatusStore()
const { t } = useI18n()

const stats = ref({ words: 0, chars: 0, selWords: 0, selChars: 0 })
const cursorPos = ref({ line: 0, col: 0 })
const saveMessage = ref('')
const saveMessageFading = ref(false)
let saveTimer = null
const showShortcuts = ref(false)
const showPendingPopover = ref(false)
const pendingTriggerRef = ref(null)
const pendingPopoverPos = ref({})
const showSyncPopover = ref(false)
const syncTriggerRef = ref(null)
const syncPopoverPos = ref({})
const showConflictDialog = ref(false)
const {
  beginSnapshotLabelConfirmation,
  snapshotLabelDialogVisible,
  snapshotLabelPromptActive,
  openSnapshotLabelDialog,
  resolveSnapshotLabelDialog,
} = useSnapshotLabelPrompt()

// Transient center message (e.g. "All saved (no changes)")
const centerMessage = ref('')
let centerMessageTimer = null
const uxStatusEntry = computed(() => uxStatusStore.current)

// Model-aware billing route
const billingRoute = computed(() => {
  if (!workspace.selectedModelId) return null
  return getBillingRoute(workspace.selectedModelId, workspace)
})

// Footer shows billing when the current model's route has something to show
const footerBillingVisible = computed(() => {
  const route = billingRoute.value
  if (!route) return false
  if (route.route === 'direct') return usageStore.showCostEstimates && usageStore.directCost > 0
  return false
})

const uxStatusColor = computed(() => {
  switch (uxStatusEntry.value?.type) {
    case 'success': return 'var(--success)'
    case 'error': return 'var(--error)'
    case 'warning': return 'var(--warning)'
    default: return 'var(--fg-secondary)'
  }
})

function formatCost(val) {
  if (!val) return '$0.00'
  return '$' + val.toFixed(2)
}

const syncColor = computed(() => {
  switch (workspace.syncStatus) {
    case 'synced': return 'var(--fg-muted)'
    case 'syncing': return 'var(--fg-muted)'
    case 'error': return 'var(--error)'
    case 'conflict': return 'var(--warning)'
    default: return 'var(--fg-muted)'
  }
})

const syncTooltip = computed(() => {
  switch (workspace.syncStatus) {
    case 'synced': return t('Synced with GitHub')
    case 'syncing': return t('Syncing with GitHub...')
    case 'conflict': return t('Needs your input - click for details')
    case 'error': return t('Needs attention - click for details')
    case 'idle': return t('GitHub: connected')
    default: return t('GitHub: not connected')
  }
})

const syncLabel = computed(() => {
  switch (workspace.syncStatus) {
    case 'synced': return t('Backed up')
    case 'syncing': return t('Saving...')
    case 'error':
    case 'conflict': return t('Sync issue')
    default: return null
  }
})

const syncTone = computed(() => {
  switch (workspace.syncStatus) {
    case 'error': return 'danger'
    case 'conflict': return 'warning'
    case 'syncing': return 'accent'
    default: return 'neutral'
  }
})

const wordSummary = computed(() => {
  if (stats.value.words <= 0) return ''
  if (stats.value.selWords > 0) {
    return t('{count} words selected', {
      count: stats.value.selWords.toLocaleString(),
    })
  }
  return t('{count} words', {
    count: stats.value.words.toLocaleString(),
  })
})

function toggleSyncPopover() {
  showSyncPopover.value = !showSyncPopover.value
  if (showSyncPopover.value) {
    nextTick(() => {
      const rect = syncTriggerRef.value?.getBoundingClientRect()
      if (rect) {
        syncPopoverPos.value = {
          bottom: (window.innerHeight - rect.top + 4) + 'px',
          left: rect.left + 'px',
        }
      }
    })
  }
}

async function handleSyncNow() {
  showSyncPopover.value = false
  if (!(await ensureGitHubSyncReady())) {
    return
  }
  const statusId = uxStatusStore.show(t('Syncing with GitHub...'), {
    type: 'info',
    duration: 0,
  })
  try {
    const result = await workspace.syncNow()
    if (result?.ok) {
      uxStatusStore.update(statusId, t('Synced with GitHub'), {
        type: 'success',
        duration: 3000,
      })
    } else if (workspace.syncStatus === 'conflict') {
      uxStatusStore.update(statusId, t('Sync conflict needs attention'), {
        type: 'warning',
        duration: 5000,
      })
    } else if (workspace.syncStatus === 'error') {
      uxStatusStore.update(statusId, workspace.syncError || t('Sync failed. Click for details.'), {
        type: 'error',
        duration: 5000,
      })
    } else {
      uxStatusStore.update(statusId, t('GitHub sync finished'), {
        type: 'success',
        duration: 3000,
      })
    }
  } catch (e) {
    uxStatusStore.update(statusId, String(e?.message || e || t('Sync failed. Click for details.')), {
      type: 'error',
      duration: 5000,
    })
  }
}

async function handleSyncRefresh() {
  showSyncPopover.value = false
  await workspace.fetchRemoteChanges()
}

function handleOpenGitHubSettings() {
  showSyncPopover.value = false
  emit('open-settings', 'github')
}

// Show conflict dialog and toasts when sync status changes
watch(() => workspace.syncStatus, (status) => {
  if (status === 'conflict') {
    showConflictDialog.value = true
    toastStore.showOnce('sync-conflict', t('Your changes conflict with updates on GitHub. Click to resolve.'), {
      type: 'warning',
      duration: 8000,
      action: { label: t('Resolve'), onClick: () => { showConflictDialog.value = true } },
    })
  } else if (status === 'error') {
    const errorType = workspace.syncErrorType
    if (errorType === 'auth') {
      toastStore.showOnce('sync-auth', t('GitHub connection expired. Reconnect in Settings.'), {
        type: 'error',
        duration: 8000,
        action: { label: t('Settings'), onClick: () => emit('open-settings', 'github') },
      })
    } else if (errorType === 'network') {
      // Network errors are quiet — no toast, just icon change
    } else {
      toastStore.showOnce('sync-error', workspace.syncError || t('Sync failed. Click for details.'), {
        type: 'error',
        duration: 6000,
        action: { label: t('Details'), onClick: () => { toggleSyncPopover() } },
      })
    }
  }
})

function togglePendingPopover() {
  showPendingPopover.value = !showPendingPopover.value
  if (showPendingPopover.value) {
    nextTick(() => {
      const rect = pendingTriggerRef.value?.getBoundingClientRect()
      if (rect) {
        pendingPopoverPos.value = {
          bottom: (window.innerHeight - rect.top + 4) + 'px',
          left: rect.left + 'px',
        }
      }
    })
  }
}

function toggleTerminalPanel() {
  window.dispatchEvent(new CustomEvent('app:toggle-terminal'))
}

function openPendingFile(file) {
  editorStore.openFile(file)
  showPendingPopover.value = false
}

// Auto-close popover when no more pending edits
watch(() => reviews.pendingCount, (count) => {
  if (count === 0) showPendingPopover.value = false
})

function showSaveMessage(msg) {
  saveMessage.value = msg
  saveMessageFading.value = false
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveMessageFading.value = true
    setTimeout(() => {
      saveMessage.value = ''
      saveMessageFading.value = false
    }, 500)
  }, 2000)
}

function showCenterMessage(msg, duration = 2000) {
  clearTimeout(centerMessageTimer)
  centerMessage.value = msg
  centerMessageTimer = setTimeout(() => {
    centerMessage.value = ''
  }, duration)
}

function handleUxStatusAction() {
  const action = uxStatusEntry.value?.action
  if (!action) return
  if (action.type === 'open-settings') {
    emit('open-settings', action.section ?? null)
  }
  uxStatusStore.clear(uxStatusEntry.value?.id)
}

// Expose methods for editor to call
defineExpose({
  setEditorStats(s) {
    stats.value = s
  },
  setCursorPos(pos) {
    cursorPos.value = pos
  },
  showSaveMessage,
  showCenterMessage,
  beginSnapshotLabelConfirmation,
})

</script>

<style scoped>
.footer-shell {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  min-height: 34px;
  border-top: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 78%, transparent), color-mix(in srgb, var(--bg-primary) 86%, transparent));
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}

.footer-side {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.footer-left {
  justify-content: flex-start;
}

.footer-right {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.footer-chip,
.footer-quiet-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 58%, transparent);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.footer-chip {
  color: var(--fg-secondary);
}

.footer-chip-button,
.footer-quiet-button {
  cursor: pointer;
  transition: color 140ms ease, border-color 140ms ease, background-color 140ms ease;
}

.footer-chip-button:hover,
.footer-quiet-button:hover {
  color: var(--fg-primary);
  border-color: color-mix(in srgb, var(--accent) 18%, var(--border));
  background: color-mix(in srgb, var(--bg-hover) 72%, transparent);
}

.footer-quiet-button {
  color: var(--fg-muted);
}

.footer-quiet-button.is-active {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.footer-chip.is-warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
}

.footer-chip.is-danger {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
}

.footer-chip.is-accent {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.footer-center {
  position: relative;
  min-width: 240px;
  justify-self: center;
}

.footer-center-layer {
  transition: opacity 160ms ease;
}

.footer-center-hidden {
  opacity: 0;
  pointer-events: none;
  position: absolute;
  inset: 0;
}

.footer-inline-message {
  color: var(--success);
  font-size: 11px;
  font-weight: 600;
}

.sync-pulse {
  animation: syncPulse 2s ease-in-out infinite;
}

@keyframes syncPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (max-width: 980px) {
  .footer-shell {
    grid-template-columns: 1fr;
    padding: 8px 12px;
  }

  .footer-center {
    order: 3;
    justify-self: stretch;
    min-width: 0;
  }

  .footer-right {
    justify-content: flex-start;
  }
}
</style>
