<template>
  <div
    ref="rootRef"
    class="ai-workbench h-full min-h-0 w-full"
    :class="{
      'ai-workbench-compact': compact,
    }"
  >
    <section class="ai-workbench-main" @contextmenu="openWorkbenchEmptyContextMenu($event, 'main')">
      <template v-if="showChat && session">
        <ChatSession
          ref="chatSessionRef"
          :key="session.id"
          :session="session"
          :sessionMeta="sessionMeta"
          paneId="ai-workbench"
          surface="workbench"
        />
      </template>

      <AiWorkbenchHome
        v-else
        ref="homeRef"
        :compact="compact"
        :pane-width="width"
      />
    </section>

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
import { useAiWorkbenchStore } from '../../stores/aiWorkbench'
import { useChatStore } from '../../stores/chat'
import { useI18n } from '../../i18n'
import AiWorkbenchHome from './AiWorkbenchHome.vue'
import ChatSession from '../chat/ChatSession.vue'
import SurfaceContextMenu from '../shared/SurfaceContextMenu.vue'

const props = defineProps({
  paneWidth: { type: Number, default: 0 },
})

const aiWorkbench = useAiWorkbenchStore()
const chatStore = useChatStore()
const { t } = useI18n()

const chatSessionRef = ref(null)
const homeRef = ref(null)
const rootRef = ref(null)
const observedWidth = ref(0)
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  scope: '',
})
let resizeObserver = null

const width = computed(() => props.paneWidth || observedWidth.value || 0)
const compact = computed(() => width.value > 0 && width.value < 980)
const session = computed(() => (
  aiWorkbench.sessionId
    ? chatStore.sessions.find((item) => item.id === aiWorkbench.sessionId) || null
    : null
))
const sessionMeta = computed(() => (
  session.value ? aiWorkbench.describeSession(session.value) : null
))
const showChat = computed(() => aiWorkbench.view === 'chat' && !!aiWorkbench.sessionId)
const recentChats = computed(() => [...chatStore.allSessionsMeta].slice(0, 12))
const latestRecentChat = computed(() => recentChats.value[0] || null)

const contextMenuGroups = computed(() => {
  if (!contextMenu.value.visible) return []

  const items = [
    { key: 'new-chat', label: t('New chat') },
  ]

  if (latestRecentChat.value?.id && latestRecentChat.value.id !== aiWorkbench.sessionId) {
    items.push({ key: 'open-latest-chat', label: t('Open latest chat') })
  }

  return [{ key: 'empty-actions', items }]
})

function openHome() {
  aiWorkbench.openLauncher()
  homeRef.value?.focus?.()
}

function openRecentChat(sessionId) {
  aiWorkbench.openSession(sessionId)
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

function openWorkbenchEmptyContextMenu(event, source = 'main') {
  if (source === 'main' && showChat.value) return
  if (shouldIgnoreEmptyContextMenuTarget(event)) return
  openContextMenu(event, 'empty')
}

async function handleContextMenuSelect(actionKey) {
  switch (actionKey) {
    case 'new-chat':
      openHome()
      break
    case 'open-latest-chat':
      if (latestRecentChat.value?.id) openRecentChat(latestRecentChat.value.id)
      break
    default:
      break
  }
}

watch(
  () => aiWorkbench.sessionId,
  async (sessionId) => {
    if (!sessionId) return
    let current = chatStore.sessions.find((item) => item.id === sessionId) || null
    if (!current) {
      await chatStore.reopenSession(sessionId, { skipArchive: true })
      current = chatStore.sessions.find((item) => item.id === sessionId) || null
    }
    if (!current) {
      aiWorkbench.openLauncher()
      return
    }
    chatStore.activeSessionId = sessionId
    chatSessionRef.value?.focus?.()
  },
  { immediate: true },
)

watch(
  () => aiWorkbench.view,
  (view) => {
    closeContextMenu()
    if (view === 'launcher') {
      homeRef.value?.focus?.()
    }
  },
)

watch(compact, (isCompact) => {
  closeContextMenu()
})

watch(
  () => aiWorkbench.sessionId,
  () => {
    closeContextMenu()
  },
)

onMounted(() => {
  if (props.paneWidth > 0) {
    observedWidth.value = props.paneWidth
    return
  }
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries?.[0]
    if (!entry) return
    observedWidth.value = entry.contentRect?.width || 0
  })
  if (rootRef.value) {
    resizeObserver.observe(rootRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect?.()
  resizeObserver = null
})
</script>

<style scoped>
.ai-workbench {
  display: flex;
  height: 100%;
  min-height: 0;
  width: 100%;
  min-width: 0;
  background: var(--bg-primary);
  container-type: inline-size;
  position: relative;
  overflow: hidden;
  --ai-rail-kicker-size: var(--surface-font-kicker);
  --ai-rail-meta-size: var(--surface-font-meta);
  --ai-rail-body-size: var(--surface-font-body);
  --ai-rail-title-size: var(--surface-font-card);
}

.ai-workbench-main {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
  justify-self: stretch;
  background: var(--bg-primary);
}
</style>
