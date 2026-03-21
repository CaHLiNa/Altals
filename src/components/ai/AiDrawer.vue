<template>
  <div
    ref="drawerRef"
    class="ai-drawer h-full flex flex-col"
    :class="{ 'ai-drawer-compact': isCompact }"
    style="background: var(--bg-primary);"
  >
    <div class="ai-drawer-header" @contextmenu="openDrawerEmptyContextMenu">
      <div class="ai-drawer-header-left">
        <button
          v-if="drawer.view === 'chat'"
          class="ai-drawer-icon-btn"
          :title="t('AI')"
          :aria-label="t('AI')"
          @click="drawer.openLauncher()"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M7.5 2.5L4 6l3.5 3.5"/>
          </svg>
        </button>
        <div
          class="ai-drawer-title-wrap"
          @contextmenu="openDrawerTitleContextMenu"
        >
          <div class="ai-drawer-title">{{ headerTitle }}</div>
          <div v-if="headerMeta" class="ai-drawer-meta">{{ headerMeta }}</div>
        </div>
      </div>

      <div class="ai-drawer-header-actions">
        <button
          class="ai-drawer-upgrade-btn"
          :title="drawer.view === 'chat' ? t('Continue in AI workspace') : t('Open AI workspace')"
          @click="openWorkbench"
        >
          {{ drawer.view === 'chat' ? t('Continue in AI workspace') : t('Open AI workspace') }}
        </button>
        <button
          v-if="drawer.view === 'chat' && session"
          class="ai-drawer-icon-btn"
          :title="t('Delete chat')"
          :aria-label="t('Delete chat')"
          @click="deleteCurrentChat"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M2 3.5h8M4.2 3.5V2.4c0-.5.4-.9.9-.9h1.8c.5 0 .9.4.9.9v1.1M9.1 3.5v5.3c0 .5-.4.9-.9.9H3.8c-.5 0-.9-.4-.9-.9V3.5"/>
            <path d="M4.9 5.1v3.1M7.1 5.1v3.1"/>
          </svg>
        </button>
        <button
          class="ai-drawer-icon-btn"
          :title="t('Close AI')"
          :aria-label="t('Close AI')"
          @click="drawer.close()"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 2l6 6M8 2l-6 6"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-hidden">
      <div
        v-if="drawer.view === 'launcher'"
        class="h-full"
        @contextmenu="openDrawerEmptyContextMenu"
      >
        <AiQuickPanel
          :compact="isCompact"
        />
      </div>
      <div v-else class="h-full">
        <ChatSession
          v-if="session"
          :key="session.id"
          :session="session"
          :sessionMeta="sessionMeta"
          :compact="isCompact"
          paneId="ai-drawer"
          surface="drawer"
        />
        <div
          v-else
          class="h-full flex items-center justify-center ui-text-base"
          style="color: var(--fg-muted);"
        >
          {{ t('Loading chat session...') }}
        </div>
      </div>
    </div>

    <SurfaceContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :groups="contextMenuGroups"
      @close="closeContextMenu"
      @select="handleContextMenuSelect"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ask } from '@tauri-apps/plugin-dialog'
import { useAiDrawerStore } from '../../stores/aiDrawer'
import { useAiWorkbenchStore } from '../../stores/aiWorkbench'
import { useChatStore } from '../../stores/chat'
import { useEditorStore } from '../../stores/editor'
import { useI18n } from '../../i18n'
import { continueAiToWorkbench } from '../../services/ai/launch'
import AiQuickPanel from './AiQuickPanel.vue'
import ChatSession from '../chat/ChatSession.vue'
import SurfaceContextMenu from '../shared/SurfaceContextMenu.vue'

const drawer = useAiDrawerStore()
const aiWorkbench = useAiWorkbenchStore()
const chatStore = useChatStore()
const editorStore = useEditorStore()
const { t } = useI18n()
const drawerRef = ref(null)
const drawerWidth = ref(0)
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  scope: '',
})
let resizeObserver = null

const isCompact = computed(() => drawerWidth.value > 0 && drawerWidth.value < 430)

const session = computed(() => (
  drawer.sessionId
    ? chatStore.sessions.find((item) => item.id === drawer.sessionId) || null
    : null
))

const sessionMeta = computed(() => (
  session.value ? aiWorkbench.describeSession(session.value) : null
))

const headerTitle = computed(() => {
  if (drawer.view === 'chat') {
    return sessionMeta.value?.label || session.value?.label || t('AI')
  }
  return t('Quick AI')
})

const headerMeta = computed(() => {
  if (drawer.view !== 'chat') return t('Current context')
  if (!sessionMeta.value) return ''
  return `${sessionMeta.value.roleTitle} · ${sessionMeta.value.runtimeTitle}`
})

const contextMenuGroups = computed(() => {
  if (!contextMenu.value.visible) return []

  if (contextMenu.value.scope === 'session' && drawer.view === 'chat' && session.value) {
    return [
      {
        key: 'session-actions',
        items: [
          { key: 'new-chat', label: t('New chat') },
          { key: 'open-workbench', label: t('Continue in AI workspace') },
          { key: 'close-ai', label: t('Close AI') },
        ],
      },
      {
        key: 'session-danger',
        items: [
          { key: 'delete-chat', label: t('Delete chat'), danger: true },
        ],
      },
    ]
  }

  return [
    {
      key: 'drawer-actions',
      items: [
        { key: 'new-chat', label: t('New chat') },
        { key: 'open-workbench', label: t('Open AI workspace') },
        { key: 'close-ai', label: t('Close AI') },
      ],
    },
  ]
})

function openWorkbench() {
  continueAiToWorkbench({
    editorStore,
    sessionId: drawer.view === 'chat' ? drawer.sessionId : null,
  })
  drawer.close()
}

async function deleteCurrentChat() {
  const sessionId = drawer.sessionId
  if (!sessionId) return
  const yes = await ask(t('Delete this chat permanently?'), {
    title: t('Delete chat'),
    kind: 'warning',
  })
  if (!yes) return

  editorStore.closeFileFromAllPanes(`chat:${sessionId}`)
  chatStore.deleteSession(sessionId)
  drawer.openLauncher()
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function shouldIgnoreEmptyContextMenuTarget(event) {
  const target = event?.target
  if (!(target instanceof Element)) return false
  return !!target.closest('button, input, textarea, select, a, label')
}

function openContextMenu(event, scope) {
  event.preventDefault()
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    scope,
  }
}

function openCurrentChatContextMenu(event) {
  if (drawer.view !== 'chat' || !session.value) return
  openContextMenu(event, 'session')
}

function openDrawerTitleContextMenu(event) {
  if (drawer.view === 'chat' && session.value) {
    event.stopPropagation()
    openCurrentChatContextMenu(event)
  }
}

function openDrawerEmptyContextMenu(event) {
  if (shouldIgnoreEmptyContextMenuTarget(event)) return
  openContextMenu(event, 'empty')
}

async function handleContextMenuSelect(actionKey) {
  switch (actionKey) {
    case 'new-chat':
      drawer.openLauncher()
      break
    case 'open-workbench':
      openWorkbench()
      break
    case 'close-ai':
      drawer.close()
      break
    case 'delete-chat':
      await deleteCurrentChat()
      break
    default:
      break
  }
}

watch(
  () => [drawer.view, drawer.sessionId],
  async ([view, sessionId]) => {
    closeContextMenu()
    if (view !== 'chat' || !sessionId) return
    let current = chatStore.sessions.find((item) => item.id === sessionId) || null
    if (!current) {
      await chatStore.reopenSession(sessionId, { skipArchive: true })
      current = chatStore.sessions.find((item) => item.id === sessionId) || null
    }
    if (!current) {
      drawer.openLauncher()
      return
    }
    chatStore.activeSessionId = sessionId
  },
  { immediate: true },
)

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries?.[0]
    if (!entry) return
    drawerWidth.value = entry.contentRect?.width || 0
  })
  if (drawerRef.value) {
    resizeObserver.observe(drawerRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect?.()
  resizeObserver = null
})
</script>

<style scoped>
.ai-drawer {
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

.ai-drawer-header {
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 8px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
}

.ai-drawer-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-drawer-header-left {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-drawer-upgrade-btn {
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg-primary);
  color: var(--fg-secondary);
  cursor: pointer;
  font-size: var(--ui-font-caption);
  transition: border-color 0.14s ease, background-color 0.14s ease, color 0.14s ease;
}

.ai-drawer-upgrade-btn:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-primary));
  color: var(--fg-primary);
}

.ai-drawer-title-wrap {
  min-width: 0;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-drawer-title {
  min-width: 0;
  font-size: var(--ui-font-label);
  font-weight: 600;
  color: var(--fg-primary);
  white-space: normal;
  line-height: 1.35;
}

.ai-drawer-meta {
  min-width: 0;
  font-size: var(--ui-font-caption);
  color: var(--fg-muted);
  white-space: normal;
  line-height: 1.35;
}

.ai-drawer-icon-btn {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: background-color 0.14s ease, color 0.14s ease;
}

.ai-drawer-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.ai-drawer-compact .ai-drawer-header {
  align-items: flex-start;
  padding-top: 6px;
  padding-bottom: 6px;
}

.ai-drawer-compact .ai-drawer-header-actions {
  width: 100%;
  justify-content: space-between;
}

.ai-drawer-compact .ai-drawer-title-wrap {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
</style>
