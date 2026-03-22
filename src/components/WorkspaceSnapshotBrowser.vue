<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="overlayEl"
      class="version-overlay"
      tabindex="-1"
      @click.self="$emit('close')"
      @keydown.esc="$emit('close')"
    >
      <div class="version-modal">
        <button class="version-close-btn" @click="$emit('close')" :title="t('Close (Esc)')">
          <IconX :size="18" :stroke-width="1.5" />
        </button>

        <div class="version-list">
          <div
            class="px-3 py-2 text-xs font-medium uppercase tracking-wider"
            style="color: var(--fg-muted); border-bottom: 1px solid var(--border);"
          >
            {{ t('Saved versions') }}
          </div>
          <div v-if="loading" class="px-3 py-4 text-xs" style="color: var(--fg-muted);">
            {{ t('Loading...') }}
          </div>
          <div v-else-if="snapshots.length === 0" class="px-3 py-4 text-xs" style="color: var(--fg-muted);">
            {{ t('No saved versions yet') }}
          </div>
          <div
            v-for="(snapshot, idx) in snapshots"
            :key="snapshot.id"
            class="version-item"
            :class="{ active: idx === selectedIndex, 'version-item-named': isNamedSnapshot(snapshot) }"
            @click="selectedIndex = idx"
          >
            <div class="timestamp">{{ formatDisplayDate(snapshot.createdAt) }}</div>
            <div class="message" :class="{ 'version-named-message': isNamedSnapshot(snapshot) }">
              <svg
                v-if="isNamedSnapshot(snapshot)"
                class="version-bookmark-icon"
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M3 1.5A1.5 1.5 0 014.5 0h7A1.5 1.5 0 0113 1.5v14a.5.5 0 01-.77.42L8 13.06l-4.23 2.86A.5.5 0 013 15.5V1.5z"/>
              </svg>
              {{ getSnapshotMessage(snapshot) }}
            </div>
          </div>
        </div>

        <div class="version-preview">
          <div v-if="selectedSnapshot" class="version-preview-header">
            <div class="workspace-snapshot-headline">
              <span class="text-xs" style="color: var(--fg-muted);">
                {{ formatDisplayDate(selectedSnapshot.createdAt) }}
              </span>
              <span class="text-sm font-medium" style="color: var(--fg-primary);">
                {{ selectedSnapshotMetadata.title }}
              </span>
            </div>
          </div>

          <div v-if="loading" class="version-empty-state">
            <div class="text-xs" style="color: var(--fg-muted);">{{ t('Loading...') }}</div>
          </div>
          <div v-else-if="!selectedSnapshot && snapshots.length === 0" class="version-empty-state">
            <div style="color: var(--fg-muted); font-size: var(--ui-font-body);">
              {{ t('No saved versions yet') }}
            </div>
            <div style="color: var(--fg-muted); opacity: 0.6; font-size: var(--ui-font-caption); margin-top: 6px;">
              {{ t('Create one with Save first, then browse it here.') }}
            </div>
          </div>
          <div v-else-if="!selectedSnapshot" class="version-empty-state">
            <div style="color: var(--fg-muted); font-size: var(--ui-font-body);">
              {{ t('Select a saved version') }}
            </div>
            <div style="color: var(--fg-muted); opacity: 0.5; font-size: var(--ui-font-caption); margin-top: 6px;">
              {{ t('Choose a workspace save point on the left.') }}
            </div>
          </div>
          <div v-else class="workspace-snapshot-detail">
            <div class="workspace-snapshot-card">
              <div class="workspace-snapshot-kicker">{{ t('Workspace save point') }}</div>
              <div class="workspace-snapshot-title">{{ selectedSnapshotMetadata.title }}</div>
              <div class="workspace-snapshot-meta">
                {{ isNamedSnapshot(selectedSnapshot) ? t('Named save point') : t('Saved automatically through the normal save flow') }}
              </div>
              <div v-if="selectedPayloadFileCount > 0" class="workspace-snapshot-meta">
                {{ t('{count} captured file(s) available for local restore', { count: selectedPayloadFileCount }) }}
              </div>
            </div>

            <div class="workspace-snapshot-note">
              {{ t('This browser lists workspace-level save points separately from File Version History.') }}
            </div>
            <div class="workspace-snapshot-note">
              {{ t('Workspace save points now have a local Altals index while still pointing at Git-backed milestones underneath.') }}
            </div>
            <div v-if="canRestoreSelectedSnapshot" class="workspace-snapshot-note">
              {{ t('This save point can restore its captured files through the local snapshot payload without rewinding Git history.') }}
            </div>
            <div v-else class="workspace-snapshot-note">
              {{ t('Older workspace save points may appear here without a local payload yet. Use File Version History for per-file restores.') }}
            </div>

            <div v-if="payloadManifestLoading" class="workspace-snapshot-note">
              {{ t('Loading captured files...') }}
            </div>
            <div v-else-if="selectedPayloadFiles.length > 0" class="workspace-snapshot-payload-list">
              <div class="workspace-snapshot-payload-title">{{ t('Captured files') }}</div>
              <div
                v-for="file in selectedPayloadFiles"
                :key="file.path"
                class="workspace-snapshot-payload-item"
              >
                {{ file.relativePath || file.path }}
              </div>
            </div>

            <div class="workspace-snapshot-actions">
              <button
                class="workspace-snapshot-action workspace-snapshot-action-restore"
                :disabled="!canRestoreSelectedSnapshot || restoring"
                @click="restoreSelectedSnapshot"
              >
                {{ restoring ? t('Restoring...') : t('Restore captured files') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { IconX } from '@tabler/icons-vue'
import { ask } from '@tauri-apps/plugin-dialog'
import { useEditorStore } from '../stores/editor'
import { useFilesStore } from '../stores/files'
import { useToastStore } from '../stores/toast'
import { useWorkspaceStore } from '../stores/workspace'
import {
  getWorkspaceSnapshotMetadata,
  isNamedWorkspaceSnapshot,
  listWorkspaceSavePoints,
  loadWorkspaceSavePointPayloadManifest,
  restoreWorkspaceSavePoint,
} from '../domains/changes/workspaceSnapshot.js'
import { useI18n, formatDate as formatLocaleDate } from '../i18n'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const workspace = useWorkspaceStore()
const editorStore = useEditorStore()
const filesStore = useFilesStore()
const toastStore = useToastStore()
const { t } = useI18n()
const overlayEl = ref(null)
const loading = ref(false)
const restoring = ref(false)
const payloadManifestLoading = ref(false)
const snapshots = ref([])
const selectedIndex = ref(-1)
const selectedPayloadManifest = ref(null)

const selectedSnapshot = computed(() =>
  selectedIndex.value >= 0 ? snapshots.value[selectedIndex.value] : null
)
const selectedSnapshotMetadata = computed(() => getSnapshotMetadata(selectedSnapshot.value))
const selectedPayloadFileCount = computed(() =>
  Number.parseInt(selectedSnapshotMetadata.value?.payload?.fileCount, 10) || 0
)
const selectedPayloadFiles = computed(() =>
  Array.isArray(selectedPayloadManifest.value?.files) ? selectedPayloadManifest.value.files : []
)
const canRestoreSelectedSnapshot = computed(() =>
  !!selectedSnapshotMetadata.value?.capabilities?.canRestore
)

watch(() => props.visible, async (visible) => {
  if (visible) {
    await loadWorkspaceSnapshots()
    await nextTick()
    overlayEl.value?.focus()
    return
  }

  snapshots.value = []
  selectedIndex.value = -1
  selectedPayloadManifest.value = null
})

watch(() => workspace.isOpen, (isOpen) => {
  if (!isOpen && props.visible) {
    emit('close')
  }
})

watch(selectedSnapshot, (snapshot) => {
  if (!props.visible) {
    return
  }
  void loadSelectedSnapshotPayloadManifest(snapshot)
})

async function loadWorkspaceSnapshots() {
  if (!workspace.path) {
    snapshots.value = []
    selectedIndex.value = -1
    return
  }

  loading.value = true
  try {
    snapshots.value = await listWorkspaceSavePoints({
      workspacePath: workspace.path,
      workspaceDataDir: workspace.workspaceDataDir,
    })
    selectedIndex.value = snapshots.value.length > 0 ? 0 : -1
  } catch (error) {
    console.error('Failed to load workspace snapshots:', error)
    snapshots.value = []
    selectedIndex.value = -1
  } finally {
    loading.value = false
  }
}

function getSnapshotMetadata(snapshot) {
  return getWorkspaceSnapshotMetadata(snapshot)
}

function getSnapshotMessage(snapshot) {
  return getSnapshotMetadata(snapshot).title
}

function isNamedSnapshot(snapshot) {
  return getSnapshotMetadata(snapshot).isNamed && isNamedWorkspaceSnapshot(snapshot)
}

async function loadSelectedSnapshotPayloadManifest(snapshot) {
  if (!snapshot || !canRestoreSelectedSnapshot.value) {
    selectedPayloadManifest.value = null
    payloadManifestLoading.value = false
    return
  }

  payloadManifestLoading.value = true
  try {
    selectedPayloadManifest.value = await loadWorkspaceSavePointPayloadManifest({
      workspace,
      snapshot,
    })
  } catch (error) {
    console.error('Failed to load workspace snapshot payload manifest:', error)
    selectedPayloadManifest.value = null
  } finally {
    payloadManifestLoading.value = false
  }
}

async function restoreSelectedSnapshot() {
  const snapshot = selectedSnapshot.value
  if (!snapshot || !canRestoreSelectedSnapshot.value || restoring.value) {
    return
  }

  const count = selectedPayloadFileCount.value
  const confirmed = await ask(
    t('Restore {count} captured file(s) from {date}? This overwrites the current contents of those files.', {
      count,
      date: formatDisplayDate(snapshot.createdAt),
    }),
    { title: t('Restore Workspace Save Point'), kind: 'warning' },
  )
  if (!confirmed) {
    return
  }

  restoring.value = true
  try {
    const result = await restoreWorkspaceSavePoint({
      workspace,
      filesStore,
      editorStore,
      snapshot,
    })
    if (!result?.restored) {
      const message = result?.reason === 'missing-payload'
        ? t('This saved version does not have a local restore payload yet.')
        : t('Failed to restore the selected workspace save point.')
      toastStore.show(message, { type: 'warning', duration: 5000 })
      return
    }

    toastStore.show(t('Restored {count} file(s) from the selected workspace save point.', {
      count: result.restoredFiles?.length || count,
    }), {
      type: 'success',
      duration: 4000,
    })
    emit('close')
  } catch (error) {
    console.error('Failed to restore workspace save point:', error)
    toastStore.show(t('Failed to restore the selected workspace save point.'), {
      type: 'error',
      duration: 5000,
    })
  } finally {
    restoring.value = false
  }
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return formatLocaleDate(date, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.workspace-snapshot-headline {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.workspace-snapshot-detail {
  flex: 1;
  padding: 18px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.workspace-snapshot-card {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg-hover) 65%, var(--bg-secondary));
}

.workspace-snapshot-kicker {
  font-size: var(--ui-font-label);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-muted);
}

.workspace-snapshot-title {
  margin-top: 6px;
  font-size: var(--ui-font-body);
  font-weight: 600;
  color: var(--fg-primary);
}

.workspace-snapshot-meta {
  margin-top: 6px;
  font-size: var(--ui-font-caption);
  color: var(--fg-muted);
}

.workspace-snapshot-note {
  font-size: var(--ui-font-body);
  color: var(--fg-secondary);
  line-height: 1.5;
}

.workspace-snapshot-actions {
  display: flex;
  justify-content: flex-start;
  padding-top: 4px;
}

.workspace-snapshot-payload-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg-hover) 45%, var(--bg-primary));
}

.workspace-snapshot-payload-title {
  font-size: var(--ui-font-label);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-muted);
}

.workspace-snapshot-payload-item {
  font-size: var(--ui-font-body);
  color: var(--fg-primary);
  word-break: break-word;
}

.workspace-snapshot-action {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: var(--ui-font-body);
  font-weight: 500;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.workspace-snapshot-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.workspace-snapshot-action-restore {
  color: var(--fg-primary);
  background: color-mix(in srgb, var(--bg-hover) 72%, var(--bg-secondary));
}

.workspace-snapshot-action-restore:not(:disabled):hover {
  transform: translateY(-1px);
}
</style>
