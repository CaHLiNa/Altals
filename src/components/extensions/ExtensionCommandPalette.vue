<template>
  <UiModalShell
    :visible="visible"
    size="lg"
    position="center"
    :body-padding="false"
    surface-class="extension-command-palette"
    overlay-class="extension-command-palette-overlay"
    @close="close"
  >
    <div class="command-palette-shell">
      <div
        v-if="promptRecoveryAvailable"
        class="command-palette-recovery"
        :class="activeBlockedState?.tone"
      >
        <div class="command-palette-recovery__copy">
          {{ activeBlockedMessage }}
        </div>
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="promptRecoveryBusy"
          :title="promptRecoveryTitle"
          @click="void recoverPrompt()"
        >
          {{ promptRecoveryLabel }}
        </UiButton>
      </div>

      <div class="command-palette-search">
        <UiInput
          ref="inputRef"
          v-model="query"
          size="lg"
          variant="ghost"
          :placeholder="t('Command')"
          @keydown="handleInputKeydown"
        />
      </div>

      <div class="command-palette-list" role="listbox">
        <button
          v-for="(entry, index) in filteredCommands"
          :key="`${entry.command.extensionId}:${entry.command.commandId}`"
          type="button"
          class="command-palette-row"
          :class="{
            'is-active': index === activeIndex,
            'is-blocked': entry.hostState.blocked,
          }"
          :disabled="busy || entry.hostState.blocked"
          role="option"
          :aria-selected="index === activeIndex"
          @mouseenter="activeIndex = index"
          @mousedown.prevent="execute(entry.command)"
        >
          <div class="command-palette-row-main">
            <span class="command-palette-title">{{ t(entry.command.title || entry.command.commandId) }}</span>
            <span class="command-palette-extension">{{ entry.command.extensionName }}</span>
          </div>
          <div class="command-palette-row-meta">
            <span
              v-if="entry.hostState.blocked"
              class="command-palette-status-pill"
              :class="entry.hostState.tone"
              :title="entry.hostMessage"
            >
              {{ entry.hostLabel }}
            </span>
            <span class="command-palette-id">{{ entry.command.commandId }}</span>
          </div>
        </button>

        <div v-if="filteredCommands.length === 0" class="command-palette-empty">
          {{ t('No extension commands found') }}
        </div>
      </div>
    </div>
  </UiModalShell>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from '../../i18n'
import { useExtensionsStore } from '../../stores/extensions'
import { useToastStore } from '../../stores/toast'
import { useWorkspaceStore } from '../../stores/workspace'
import { useExtensionPromptRecovery } from '../../composables/useExtensionPromptRecovery'
import { buildExtensionCommandHostState } from '../../domains/extensions/extensionCommandHostState'
import UiInput from '../shared/ui/UiInput.vue'
import UiButton from '../shared/ui/UiButton.vue'
import UiModalShell from '../shared/ui/UiModalShell.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  target: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close', 'executed'])

const { t } = useI18n()
const extensionsStore = useExtensionsStore()
const workspaceStore = useWorkspaceStore()
const toastStore = useToastStore()
const query = ref('')
const activeIndex = ref(0)
const inputRef = ref(null)
const busy = ref(false)

const availableCommands = computed(() => {
  return extensionsStore.commandPaletteCommandsForContext(props.context).map((command) => {
    const hostState = buildExtensionCommandHostState(
      extensionsStore.hostDiagnosticsFor(command.extensionId, workspaceStore.path || '')
    )

    return {
      command,
      hostState,
      hostLabel: hostState.blocked ? t(hostState.labelKey) : '',
      hostMessage: hostState.blocked ? t(hostState.messageKey, hostState.messageParams) : '',
    }
  })
})

const filteredCommands = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  if (!normalized) return availableCommands.value
  return availableCommands.value.filter((entry) =>
    [
      entry.command.title,
      entry.command.category,
      entry.command.commandId,
      entry.command.extensionName,
      entry.hostLabel,
      entry.hostMessage,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalized)
  )
})
const blockedEntries = computed(() => filteredCommands.value.filter((entry) => entry.hostState.blocked))
const activeBlockedState = computed(() => blockedEntries.value[0]?.hostState || null)
const activeBlockedMessage = computed(() => blockedEntries.value[0]?.hostMessage || '')
const blockedPromptOwner = computed(() => activeBlockedState.value?.pendingPromptOwner || null)
const ownPromptWorkspaceRoot = computed(() => activeBlockedState.value?.pendingPromptWorkspaceRoot || '')
const promptRecoveryOwner = computed(() => {
  const blockedState = activeBlockedState.value
  if (!blockedState?.blocked) return null
  if (blockedState.ownsPendingPrompt) {
    return {
      extensionId: blockedEntries.value[0]?.command?.extensionId || '',
      workspaceRoot: ownPromptWorkspaceRoot.value || workspaceStore.path || '',
    }
  }
  if (blockedState.blockedByForeignPrompt) {
    return {
      extensionId: blockedPromptOwner.value?.extensionId || '',
      workspaceRoot: blockedState.blockingPromptWorkspaceRoot || '',
    }
  }
  return null
})
const {
  busy: promptRecoveryBusy,
  descriptor: promptRecovery,
  cancel: cancelPromptRecovery,
} = useExtensionPromptRecovery(() => promptRecoveryOwner.value)
const promptRecoveryAvailable = computed(() => promptRecovery.value.available)
const promptRecoveryLabel = computed(() => promptRecovery.value.label)
const promptRecoveryTitle = computed(() => promptRecovery.value.title)

watch(
  () => props.visible,
  async (isVisible) => {
    if (!isVisible) return
    query.value = ''
    activeIndex.value = 0
    await extensionsStore.refreshRegistry().catch(() => {})
    await nextTick()
    inputRef.value?.focus?.()
  }
)

watch(filteredCommands, () => {
  if (activeIndex.value >= filteredCommands.value.length) {
    activeIndex.value = Math.max(0, filteredCommands.value.length - 1)
  }
})

function close() {
  emit('close')
}

function move(delta) {
  const total = filteredCommands.value.length
  if (!total) return
  activeIndex.value = (activeIndex.value + delta + total) % total
}

async function execute(command = null) {
  if (busy.value) return
  const selectedEntry = command
    ? filteredCommands.value.find((entry) =>
        entry.command.extensionId === command.extensionId &&
        entry.command.commandId === command.commandId
      ) || null
    : filteredCommands.value[activeIndex.value] || null
  if (!selectedEntry) return
  if (selectedEntry.hostState.blocked) {
    toastStore.show(selectedEntry.hostMessage, {
      type: 'warning',
      duration: 3200,
    })
    return
  }

  const selected = selectedEntry.command
  busy.value = true
  try {
    const task = await extensionsStore.executeCommand(selected, props.target)
    emit('executed', task)
    toastStore.show(t('Extension task started'), { type: 'success', duration: 2400 })
    close()
  } catch (error) {
    toastStore.show(error?.message || String(error || t('Failed to start extension task')), {
      type: 'error',
      duration: 4200,
    })
  } finally {
    busy.value = false
  }
}

async function recoverPrompt() {
  await cancelPromptRecovery()
}

function handleInputKeydown(event) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    void execute()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}
</script>

<style scoped>
:global(.extension-command-palette-overlay) {
  align-items: flex-start;
  padding-top: min(12vh, 92px);
}

:global(.extension-command-palette) {
  width: min(720px, calc(100vw - 32px));
  border-radius: 8px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-raised) 96%, white 4%), var(--surface-raised));
  box-shadow:
    0 22px 60px rgba(0, 0, 0, 0.28),
    0 0 0 1px color-mix(in srgb, var(--border-subtle) 85%, transparent);
}

.command-palette-shell {
  display: flex;
  min-height: 0;
  max-height: min(560px, calc(100vh - 140px));
  flex-direction: column;
}

.command-palette-recovery {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 42%, transparent);
  background: color-mix(in srgb, var(--warning) 8%, var(--surface-base));
}

.command-palette-recovery.is-blocked {
  background: color-mix(in srgb, var(--error) 7%, var(--surface-base));
}

.command-palette-recovery__copy {
  min-width: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.command-palette-search {
  flex: 0 0 auto;
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 42%, transparent);
}

.command-palette-search :deep(.ui-input-shell) {
  height: 38px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-base) 86%, transparent);
}

.command-palette-search :deep(.ui-input-control) {
  font-size: 14px;
}

.command-palette-list {
  min-height: 0;
  overflow-y: auto;
  padding: 4px;
}

.command-palette-row {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  border: 0;
  border-radius: 6px;
  padding: 9px 10px;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.command-palette-row:disabled {
  cursor: wait;
}

.command-palette-row.is-blocked:disabled {
  cursor: not-allowed;
  opacity: 0.9;
}

.command-palette-row.is-active,
.command-palette-row:hover {
  background: color-mix(in srgb, var(--accent) 16%, var(--surface-hover));
}

.command-palette-row-main {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.command-palette-title {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette-extension,
.command-palette-id {
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette-row-meta {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.command-palette-status-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  background: color-mix(in srgb, var(--surface-hover) 82%, transparent);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.command-palette-status-pill.is-warning {
  background: color-mix(in srgb, var(--warning) 18%, transparent);
}

.command-palette-status-pill.is-blocked {
  background: color-mix(in srgb, var(--error) 16%, transparent);
  color: color-mix(in srgb, var(--error) 78%, var(--text-primary));
}

.command-palette-id {
  justify-self: end;
  font-family: var(--font-mono);
}

.command-palette-empty {
  padding: 22px 12px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

@media (max-width: 640px) {
  :global(.extension-command-palette-overlay) {
    padding: 10px;
  }

  .command-palette-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }

  .command-palette-id {
    justify-self: start;
  }
}
</style>
