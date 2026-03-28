<template>
  <footer
    class="grid items-center px-3 ui-text-xs select-none shrink-0"
    style="grid-template-columns: 1fr auto 1fr; background: var(--bg-primary); border-top: 1px solid var(--border); color: var(--fg-muted); height: 26px; font-variant-numeric: tabular-nums;"
  >
    <div class="flex items-center gap-2 justify-self-start whitespace-nowrap">
      <template v-if="stats.words > 0">
        <span :style="{ color: stats.selWords > 0 ? 'var(--accent)' : 'var(--fg-muted)' }">
          <span style="display:inline-block;min-width:3ch;text-align:right;">{{ activeWords.toLocaleString() }}</span>
          {{ t('words') }}
        </span>
        <span :style="{ color: stats.selChars > 0 ? 'var(--accent)' : 'var(--fg-muted)' }">
          <span style="display:inline-block;min-width:3ch;text-align:right;">{{ activeChars.toLocaleString() }}</span>
          {{ t('chars') }}
        </span>
      </template>
    </div>

    <div class="footer-center justify-self-center">
      <div class="footer-center-layer" :class="{ 'footer-center-hidden': snapshotLabelPromptActive || centerMessage || uxStatusEntry }"></div>

      <div class="footer-center-layer flex items-center gap-1" :class="{ 'footer-center-hidden': !snapshotLabelPromptActive }">
        <IconCheck width="12" height="12" style="color: var(--success);" />
        <div class="font-medium ui-text-sm pe-2" style="color: var(--success);">
          {{ t('Saved') }}
        </div>
        <div
          class="cursor-pointer underline hover:opacity-80 ui-text-sm font-medium"
          style="color: var(--accent);"
          @click="openSnapshotLabelDialog"
        >
          {{ t('Name this version?') }}
        </div>
      </div>

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

    <SnapshotDialog
      :visible="snapshotLabelDialogVisible"
      @resolve="resolveSnapshotLabelDialog"
    />

    <div class="flex items-center gap-2 justify-self-end whitespace-nowrap">
      <button
        class="w-6 h-6 flex items-center justify-center rounded hover:opacity-80 bg-transparent border-none cursor-pointer"
        style="color: var(--fg-muted);"
        @click="$emit('open-workspace-snapshots')"
        :title="t('Saved versions')"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3.5 2.5h6a1.5 1.5 0 011.5 1.5v9l-2.75-1.9L5.5 13V4a1.5 1.5 0 011.5-1.5z"/>
          <path d="M11 4.5h1.5A1.5 1.5 0 0114 6v7.5l-2-1.4"/>
        </svg>
      </button>
      <button
        class="w-6 h-6 flex items-center justify-center rounded hover:opacity-80 bg-transparent border-none cursor-pointer"
        style="color: var(--fg-muted);"
        @click="showShortcuts = !showShortcuts"
        :title="t('Keyboard shortcuts')"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="4" width="14" height="9" rx="1.5"/>
          <path d="M4 7h1M7 7h2M11 7h1M5 10h6"/>
        </svg>
      </button>
      <button
        class="w-6 h-6 flex items-center justify-center rounded hover:opacity-80 bg-transparent border-none cursor-pointer"
        :style="{ color: workspace.softWrap ? 'var(--accent)' : 'var(--fg-muted)' }"
        @click="workspace.toggleSoftWrap()"
        :title="workspace.softWrap ? t('Word wrap: on') : t('Word wrap: off')"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2 3h12"/>
          <path d="M2 7h10a2 2 0 010 4H8"/>
          <path d="M10 13l-2-2 2-2"/>
          <path d="M2 11h3"/>
        </svg>
      </button>

      <div v-if="cursorPos.line > 0" class="w-px h-3 shrink-0" style="background: var(--border);"></div>

      <span v-if="cursorPos.line > 0">
        {{ t('Ln {line}, Col {col}', { line: cursorPos.line, col: cursorPos.col }) }}
      </span>

      <span
        v-if="saveMessage"
        class="transition-opacity"
        :style="{ color: 'var(--success)', opacity: saveMessageFading ? 0 : 1 }"
      >
        {{ saveMessage }}
      </span>
    </div>
  </footer>

  <Teleport to="body">
    <div v-if="showShortcuts" class="fixed inset-0 z-50" @click="showShortcuts = false">
      <div
        class="fixed z-50 rounded-lg border overflow-hidden"
        style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 8px 24px rgba(0,0,0,0.4); width: 300px; bottom: 44px; right: 12px;"
        @click.stop
      >
        <div
          class="px-3 py-2 ui-text-xs font-medium uppercase tracking-wider"
          style="color: var(--fg-muted); border-bottom: 1px solid var(--border);"
        >
          {{ t('Keyboard shortcuts') }}
        </div>
        <div class="px-3 py-2 space-y-1.5 ui-text-sm" style="color: var(--fg-secondary);">
          <div class="flex justify-between"><span>{{ t('Toggle left sidebar') }}</span><kbd>{{ modKey }}+B</kbd></div>
          <div class="flex justify-between"><span>{{ t('Quick open') }}</span><kbd>{{ modKey }}+P</kbd></div>
          <div class="flex justify-between"><span>{{ t('Save') }}</span><kbd>{{ modKey }}+S</kbd></div>
          <div class="flex justify-between"><span>{{ t('Close tab') }}</span><kbd>{{ modKey }}+W</kbd></div>
          <div class="flex justify-between"><span>{{ t('Split vertical') }}</span><kbd>{{ modKey }}+\\</kbd></div>
          <div class="flex justify-between"><span>{{ t('Split horizontal') }}</span><kbd>{{ modKey }}+Shift+\\</kbd></div>
          <div class="flex justify-between"><span>{{ t('Add comment') }}</span><kbd>{{ modKey }}+Shift+L</kbd></div>
          <div class="flex justify-between"><span>{{ t('Toggle word wrap') }}</span><kbd>{{ altKey }}+Z</kbd></div>
          <div class="mt-2 pt-2" style="border-top: 1px solid var(--border); color: var(--fg-muted);">{{ t('File Explorer') }}</div>
          <div class="flex justify-between"><span>{{ t('Navigate') }}</span><kbd>↑ / ↓</kbd></div>
          <div class="flex justify-between"><span>{{ t('Expand folder') }}</span><kbd>→</kbd></div>
          <div class="flex justify-between"><span>{{ t('Collapse / parent') }}</span><kbd>←</kbd></div>
          <div class="flex justify-between"><span>{{ t('Open') }}</span><kbd>Space</kbd></div>
          <div class="flex justify-between"><span>{{ t('Rename') }}</span><kbd>Enter</kbd></div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useUxStatusStore } from '../../stores/uxStatus'
import { useSnapshotLabelPrompt } from '../../app/changes/useSnapshotLabelPrompt.js'
import { modKey, altKey } from '../../platform'
import { useI18n } from '../../i18n'
import SnapshotDialog from './SnapshotDialog.vue'
import { IconCheck } from '@tabler/icons-vue'

const emit = defineEmits(['open-settings', 'open-workspace-snapshots'])

const workspace = useWorkspaceStore()
const uxStatusStore = useUxStatusStore()
const { t } = useI18n()

const stats = ref({ words: 0, chars: 0, selWords: 0, selChars: 0 })
const cursorPos = ref({ line: 0, col: 0 })
const saveMessage = ref('')
const saveMessageFading = ref(false)
const showShortcuts = ref(false)
const centerMessage = ref('')

let saveTimer = null
let centerMessageTimer = null

const {
  beginSnapshotLabelConfirmation,
  snapshotLabelDialogVisible,
  snapshotLabelPromptActive,
  openSnapshotLabelDialog,
  resolveSnapshotLabelDialog,
} = useSnapshotLabelPrompt()

const uxStatusEntry = computed(() => uxStatusStore.current)
const activeWords = computed(() => (stats.value.selWords > 0 ? stats.value.selWords : stats.value.words))
const activeChars = computed(() => (stats.value.selChars > 0 ? stats.value.selChars : stats.value.chars))

const uxStatusColor = computed(() => {
  switch (uxStatusEntry.value?.type) {
    case 'success': return 'var(--success)'
    case 'error': return 'var(--error)'
    case 'warning': return 'var(--warning)'
    default: return 'var(--fg-secondary)'
  }
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

defineExpose({
  setEditorStats(nextStats) {
    stats.value = nextStats
  },
  setCursorPos(pos) {
    cursorPos.value = pos
  },
  showSaveMessage,
  showCenterMessage,
  beginSnapshotLabelConfirmation,
})
</script>
