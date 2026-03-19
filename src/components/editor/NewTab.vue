<template>
  <div class="flex flex-col h-full" style="background: var(--bg-primary);">

    <!-- Close pane button (split panes only) -->
    <div v-if="paneId !== 'pane-root'"
      class="flex items-center justify-end h-7 shrink-0 border-b px-1"
      style="border-color: var(--border);">
      <button
        class="p-1 rounded cursor-pointer"
        style="color: var(--fg-muted);"
        :title="t('Close pane')"
        @click="editorStore.collapsePane(paneId)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Content — anchored at a fixed viewport-relative top position.
         The top of the block never moves when switching tabs (content grows down).
         No jiggle. No magic pixels. -->
    <div class="flex-1 overflow-y-auto min-h-0" ref="itemListRef">
      <div class="w-full mx-auto pb-10" style="max-width: min(80ch, 90%); padding-top: clamp(1rem, 20vh, 8rem);">

        <!-- Tab labels — pl-3 aligns with item text (› in gutter) -->
        <div class="flex gap-5 mb-6 pl-5">
          <button
            v-for="tab in visibleTabs"
            :key="tab.id"
            class="ui-text-label font-semibold tracking-[0.06em] uppercase bg-transparent border-none cursor-pointer pb-0.5 transition-colors duration-75"
            :style="{
              color: activeTabId === tab.id ? 'var(--fg-primary)' : 'var(--fg-muted)',
              borderBottom: activeTabId === tab.id ? '1px solid var(--fg-primary)' : '1px solid transparent',
            }"
            @click="setTab(tab.id)"
          >{{ tab.label }}</button>
        </div>

        <template v-for="(item, i) in currentItems" :key="activeTabId + '-' + i">
          <div
            v-if="item.groupHeader"
            class="ui-text-caption font-semibold tracking-[0.06em] uppercase pl-5 pb-1"
            :class="i > 0 ? 'mt-4' : ''"
            style="color: var(--fg-muted);"
          >{{ item.groupHeader }}</div>
          <button
            class="newtab-item flex items-center gap-2 w-full border-none bg-transparent text-left py-1.5 cursor-pointer transition-colors duration-75"
            :style="{ color: selectedIdx === i ? 'var(--fg-primary)' : (item.muted ? 'var(--fg-muted)' : 'var(--fg-secondary)') }"
            @click="activate(item)"
            @mouseenter="selectedIdx = i"
          >
            <span
              class="w-3 shrink-0 leading-none select-none"
              style="font-size: var(--ui-font-title);"
              :style="{ color: selectedIdx === i ? 'var(--fg-muted)' : 'transparent' }"
            >›</span>
            <span class="flex-1 ui-text-title truncate min-w-0">{{ item.label }}</span>
            <span
              v-if="item.meta"
              class="ui-text-label shrink-0 whitespace-nowrap mx-4"
              style="color: var(--fg-muted);"
            >{{ item.meta }}</span>
          </button>
        </template>

      </div>
    </div>

    <!-- Sticky bottom: ChatInput -->
    <div class="shrink-0 flex justify-center">
      <div class="w-full max-w-[80ch]">
        <ChatInput
          ref="chatInputRef"
          :isStreaming="false"
          :modelId="selectedModelId"
          :estimatedTokens="null"
          @send="sendChat"
          @update-model="selectModel"
        />
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../../stores/editor'
import { useAiWorkbenchStore } from '../../stores/aiWorkbench'
import { useFilesStore } from '../../stores/files'
import { useChatStore } from '../../stores/chat'
import { useWorkspaceStore } from '../../stores/workspace'
import { useI18n, formatRelativeFromNow } from '../../i18n'
import { getAiLauncherItems } from '../../services/ai/taskCatalog'
import { launchAiTask, startAiConversation } from '../../services/ai/launch'
import ChatInput from '../chat/ChatInput.vue'

const props = defineProps({
  paneId: { type: String, required: true },
})

const editorStore = useEditorStore()
const aiWorkbench = useAiWorkbenchStore()
const filesStore  = useFilesStore()
const chatStore   = useChatStore()
const workspace   = useWorkspaceStore()
const { t } = useI18n()

// ─── Refs ──────────────────────────────────────────────────────────

const chatInputRef    = ref(null)
const itemListRef     = ref(null)
const selectedModelId = ref(workspace.selectedModelId || null)
const activeTabId     = ref(aiWorkbench.launcherTab || 'ai')
const selectedIdx     = ref(0)
const chatsLimit      = ref(10)
const recentFiles     = ref([])

let recentFilesGeneration = 0

// ─── Tab definitions ───────────────────────────────────────────────

const TABS = [
  { id: 'ai',        label: t('AI') },
  { id: 'recent',    label: t('Files') },
  { id: 'new',       label: t('Create') },
  { id: 'chats',     label: t('Chats') },
]

const fileTypes = [
  { ext: '.md',    label: t('Markdown') },
  { ext: '.tex',   label: 'LaTeX' },
  { ext: '.typ',   label: 'Typst' },
  { ext: '.ipynb', label: t('Jupyter notebook') },
  { ext: '.py',    label: 'Python' },
]

// ─── Data computeds ────────────────────────────────────────────────

const allRecentFiles = computed(() => {
  return recentFiles.value
})

const allChats = computed(() =>
  [...chatStore.allSessionsMeta].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
)

// ─── Tab visibility ────────────────────────────────────────────────

const visibleTabs = computed(() => TABS)

// ─── AI tab items ──────────────────────────────────────────────────

const aiItems = computed(() => {
  return getAiLauncherItems({
    recentFiles: allRecentFiles.value,
    t,
  }).map((item) => ({
    label: item.label,
    meta: item.meta,
    groupHeader: item.groupHeader,
    muted: item.muted,
    action: () => runAiTask(item.task, item.label),
  }))
})

// ─── Current tab items ─────────────────────────────────────────────

const currentItems = computed(() => {
  switch (activeTabId.value) {
    case 'ai':
      return aiItems.value
    case 'recent':
      return allRecentFiles.value.map(e => ({
        label: fileName(e.path),
        meta: relativeTime(e.openedAt),
        action: () => openFile(e.path),
      }))
    case 'new':
      return fileTypes.map(ft => ({
        label: ft.label,
        meta: ft.ext,
        action: () => createNewFile(ft.ext),
      }))
    case 'chats': {
      const visible = allChats.value.slice(0, chatsLimit.value)
      const items = visible.map(s => ({
        label: s.label,
        meta: relativeTime(s.updatedAt),
        action: () => openChat(s.id),
      }))
      if (allChats.value.length > chatsLimit.value) {
        items.push({
          label: t('Show more'),
          muted: true,
          action: () => { chatsLimit.value += 10 },
        })
      }
      return items
    }
    default:
      return []
  }
})

// ─── Watchers ──────────────────────────────────────────────────────

// Fall back to quick if active tab is hidden (e.g. suggested empties)
watch(visibleTabs, (tabs) => {
  if (!tabs.find(t => t.id === activeTabId.value)) {
    activeTabId.value = 'ai'
    selectedIdx.value = 0
  }
})

// Reset selection + chat pagination when switching tabs
watch(activeTabId, () => {
  selectedIdx.value = 0
  chatsLimit.value = 10
})

watch(
  () => editorStore.recentFiles.map(entry => `${entry.path}:${entry.openedAt}`).join('|'),
  () => {
    refreshRecentFiles().catch((error) => {
      console.warn('[newtab] refreshRecentFiles failed:', error)
      recentFiles.value = []
    })
  },
  { immediate: true },
)

// ─── Tab navigation ────────────────────────────────────────────────

function setTab(id) {
  activeTabId.value = id
  aiWorkbench.launcherTab = id
}

function switchTab(delta) {
  const tabs = visibleTabs.value
  const idx = tabs.findIndex(t => t.id === activeTabId.value)
  const next = (idx + delta + tabs.length) % tabs.length
  activeTabId.value = tabs[next].id
  selectedIdx.value = 0
}

function moveSelection(delta) {
  const items = currentItems.value
  const next = Math.max(0, Math.min(items.length - 1, selectedIdx.value + delta))
  selectedIdx.value = next
  nextTick(() => {
    const buttons = itemListRef.value?.querySelectorAll('button.newtab-item')
    buttons?.[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

function activateSelected() {
  const item = currentItems.value[selectedIdx.value]
  if (item) activate(item)
}

function activate(item) {
  item.action()
}

// ─── Keyboard handler ──────────────────────────────────────────────

function handleKeydown(e) {
  // Only when this pane is active
  if (editorStore.activePaneId !== props.paneId) return
  // Don't intercept when any text input has focus (header search, dialogs, etc.)
  const active = document.activeElement
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return
  const richInput = chatInputRef.value?.$el?.querySelector('[contenteditable]')

  switch (e.key) {
    case 'ArrowLeft':  e.preventDefault(); switchTab(-1); break
    case 'ArrowRight': e.preventDefault(); switchTab(1);  break
    case 'ArrowUp':    e.preventDefault(); moveSelection(-1); break
    case 'ArrowDown':  e.preventDefault(); moveSelection(1);  break
    case 'Enter':      e.preventDefault(); activateSelected(); break
    default:
      // Printable character → warp focus + char into chat input
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        if (richInput) {
          richInput.focus()
          document.execCommand('insertText', false, e.key)
        }
      }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

function fileName(path) {
  return path.split('/').pop() || path
}

function relativeTime(ts) {
  return formatRelativeFromNow(ts)
}

async function refreshRecentFiles() {
  const generation = ++recentFilesGeneration
  const entries = [...editorStore.recentFiles]

  if (entries.length === 0) {
    recentFiles.value = []
    return
  }

  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const exists = await invoke('path_exists', { path: entry.path })
        return exists ? entry : null
      } catch {
        return null
      }
    }),
  )

  if (generation !== recentFilesGeneration) return
  recentFiles.value = results.filter(Boolean)
}

// ─── Navigation ────────────────────────────────────────────────────

function openFile(path) {
  editorStore.setActivePane(props.paneId)
  editorStore.openFile(path)
}

function openChat(sessionId) {
  editorStore.setActivePane(props.paneId)
  chatStore.reopenSession(sessionId, { skipArchive: true })
  nextTick(() => {
    editorStore.openChat({ sessionId, paneId: props.paneId })
  })
}

// ─── Send ──────────────────────────────────────────────────────────

async function sendChat({ text, fileRefs, context }) {
  if (!text && !fileRefs?.length) return
  await startAiConversation({
    editorStore,
    chatStore,
    paneId: props.paneId,
    modelId: selectedModelId.value,
    text,
    fileRefs,
    context,
  })
}

async function runAiTask(task, label) {
  await launchAiTask({
    editorStore,
    chatStore,
    paneId: props.paneId,
    modelId: selectedModelId.value,
    task: {
      ...task,
      label,
    },
  })
}

function selectModel(modelId) {
  selectedModelId.value = modelId
  workspace.setSelectedModelId(modelId)
}

// ─── File creation ─────────────────────────────────────────────────

async function createNewFile(ext) {
  if (!workspace.path) return
  const baseName = 'untitled'
  let name = `${baseName}${ext}`
  let counter = 2
  while (true) {
    const fullPath = `${workspace.path}/${name}`
    try {
      const exists = await invoke('path_exists', { path: fullPath })
      if (!exists) break
    } catch { break }
    name = `${baseName}-${counter}${ext}`
    counter++
  }
  const created = await filesStore.createFile(workspace.path, name)
  if (created) {
    editorStore.setActivePane(props.paneId)
    editorStore.openFile(created)
  }
}

// ─── Lifecycle ─────────────────────────────────────────────────────

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  recentFilesGeneration += 1
  window.removeEventListener('keydown', handleKeydown)
})
</script>
