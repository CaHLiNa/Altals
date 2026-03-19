<template>
  <div class="flex flex-col h-full" style="background: var(--bg-primary);">
    <div
      v-if="paneId !== 'pane-root'"
      class="flex items-center justify-end h-7 shrink-0 border-b px-1"
      style="border-color: var(--border);"
    >
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

    <div class="flex-1 overflow-y-auto min-h-0" ref="itemListRef">
      <div class="w-full mx-auto pb-10" style="max-width: min(80ch, 90%); padding-top: clamp(1rem, 20vh, 8rem);">
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
const chatStore = useChatStore()
const workspace = useWorkspaceStore()
const { t } = useI18n()

const chatInputRef = ref(null)
const itemListRef = ref(null)
const selectedModelId = ref(workspace.selectedModelId || null)
const activeTabId = ref(aiWorkbench.launcherTab || 'ai')
const selectedIdx = ref(0)
const chatsLimit = ref(10)
const recentFiles = ref([])

let recentFilesGeneration = 0

const TABS = [
  { id: 'ai', label: t('AI') },
  { id: 'chats', label: t('Chats') },
]

const visibleTabs = computed(() => TABS)

const allRecentFiles = computed(() => recentFiles.value)

const allChats = computed(() =>
  [...chatStore.allSessionsMeta].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
)

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

const currentItems = computed(() => {
  if (activeTabId.value === 'chats') {
    const visible = allChats.value.slice(0, chatsLimit.value)
    const items = visible.map((session) => ({
      label: session.label,
      meta: relativeTime(session.updatedAt),
      action: () => openChat(session.id),
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
  return aiItems.value
})

watch(activeTabId, () => {
  selectedIdx.value = 0
  chatsLimit.value = 10
  aiWorkbench.launcherTab = activeTabId.value
})

watch(
  () => editorStore.recentFiles.map((entry) => `${entry.path}:${entry.openedAt}`).join('|'),
  () => {
    refreshRecentFiles().catch((error) => {
      console.warn('[ai-launcher] refreshRecentFiles failed:', error)
      recentFiles.value = []
    })
  },
  { immediate: true },
)

function setTab(id) {
  activeTabId.value = id
}

function switchTab(delta) {
  const tabs = visibleTabs.value
  const idx = tabs.findIndex((tab) => tab.id === activeTabId.value)
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

function handleKeydown(e) {
  if (editorStore.activePaneId !== props.paneId) return
  const active = document.activeElement
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return
  const richInput = chatInputRef.value?.$el?.querySelector('[contenteditable]')

  switch (e.key) {
    case 'ArrowLeft': e.preventDefault(); switchTab(-1); break
    case 'ArrowRight': e.preventDefault(); switchTab(1); break
    case 'ArrowUp': e.preventDefault(); moveSelection(-1); break
    case 'ArrowDown': e.preventDefault(); moveSelection(1); break
    case 'Enter': e.preventDefault(); activateSelected(); break
    default:
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        if (richInput) {
          richInput.focus()
          document.execCommand('insertText', false, e.key)
        }
      }
  }
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

function openChat(sessionId) {
  editorStore.setActivePane(props.paneId)
  chatStore.reopenSession(sessionId, { skipArchive: true })
  nextTick(() => {
    editorStore.openChat({ sessionId, paneId: props.paneId })
  })
}

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

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  recentFilesGeneration += 1
  window.removeEventListener('keydown', handleKeydown)
})
</script>
