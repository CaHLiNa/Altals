<template>
  <div
    ref="rootRef"
    class="ai-workbench h-full min-h-0 w-full"
    :class="{
      'ai-workbench-compact': compact,
      'is-rail-drawer-open': compact && compactRailOpen,
    }"
  >
    <button
      v-if="showCompactBackdrop"
      class="ai-workbench-backdrop"
      type="button"
      @click="closeCompactRail"
    />

    <aside class="ai-workbench-rail">
      <div v-if="compact" class="ai-workbench-rail-compact-head">
        <div class="ai-workbench-rail-compact-title">{{ t('Current context') }}</div>
        <button
          class="ai-workbench-rail-close"
          type="button"
          @click="closeCompactRail"
        >
          ×
        </button>
      </div>

      <div class="ai-workbench-rail-top">
        <div class="ai-workbench-rail-kicker">{{ t('Current context') }}</div>
        <div class="ai-workbench-rail-context">{{ contextName }}</div>
        <div class="ai-workbench-rail-workspace">{{ workspaceName }}</div>

        <button class="ai-workbench-new-chat" @click="openHome">
          {{ t('New chat') }}
        </button>
      </div>

      <div class="ai-workbench-rail-section">
        <div class="ai-workbench-rail-section-title">{{ t('Recent chats') }}</div>

        <div v-if="recentChats.length" class="ai-workbench-chat-list">
          <button
            v-for="item in recentChats"
            :key="item.id"
            class="ai-workbench-chat-item"
            :class="{ active: aiWorkbench.sessionId === item.id && showChat }"
            @click="openRecentChat(item.id)"
          >
            <div class="ai-workbench-chat-label-row">
              <span class="ai-workbench-chat-label">{{ item.label }}</span>
              <span v-if="chatMeta(item)?.roleBadge" class="ai-workbench-chat-badge">
                {{ chatMeta(item).roleBadge }}
              </span>
            </div>
            <div class="ai-workbench-chat-meta">
              {{ formatRelativeFromNow(item.updatedAt) }}
            </div>
          </button>
        </div>

        <div v-else class="ai-workbench-chat-empty">
          {{ t('No chats yet') }}
        </div>
      </div>
    </aside>

    <section class="ai-workbench-main">
      <div v-if="compact" class="ai-workbench-compact-toolbar">
        <button
          class="ai-workbench-compact-trigger"
          type="button"
          :class="{ active: compactRailOpen }"
          @click="toggleCompactRail"
        >
          <span class="ai-workbench-compact-trigger-label">{{ t('Current context') }}</span>
          <span class="ai-workbench-compact-trigger-value">{{ compactToolbarLabel }}</span>
        </button>
      </div>

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
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAiWorkbenchStore } from '../../stores/aiWorkbench'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import { useChatStore } from '../../stores/chat'
import { useI18n, formatRelativeFromNow } from '../../i18n'
import AiWorkbenchHome from './AiWorkbenchHome.vue'
import ChatSession from '../chat/ChatSession.vue'

const props = defineProps({
  paneWidth: { type: Number, default: 0 },
})

const aiWorkbench = useAiWorkbenchStore()
const editorStore = useEditorStore()
const workspace = useWorkspaceStore()
const chatStore = useChatStore()
const { t } = useI18n()

const chatSessionRef = ref(null)
const homeRef = ref(null)
const rootRef = ref(null)
const observedWidth = ref(0)
const compactRailOpen = ref(false)
let resizeObserver = null

const width = computed(() => props.paneWidth || observedWidth.value || 0)
const compact = computed(() => width.value > 0 && width.value < 980)
const showCompactBackdrop = computed(() => compact.value && compactRailOpen.value)
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

const contextName = computed(() => {
  const path = editorStore.preferredContextPath || ''
  if (path) return String(path).split('/').pop() || path
  const fallback = workspace.path || ''
  return fallback ? (String(fallback).split('/').pop() || fallback) : t('Current workspace')
})

const workspaceName = computed(() => {
  const path = workspace.path || ''
  return path ? (String(path).split('/').pop() || path) : t('Current workspace')
})
const compactToolbarLabel = computed(() => {
  if (showChat.value && sessionMeta.value?.label) return sessionMeta.value.label
  return contextName.value || workspaceName.value
})

function chatMeta(item) {
  return aiWorkbench.describeSession(item)
}

function openHome() {
  closeCompactRail()
  aiWorkbench.openLauncher()
  homeRef.value?.focus?.()
}

function openRecentChat(sessionId) {
  closeCompactRail()
  aiWorkbench.openSession(sessionId)
}

function closeCompactRail() {
  compactRailOpen.value = false
}

function toggleCompactRail() {
  if (!compact.value) return
  compactRailOpen.value = !compactRailOpen.value
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
    if (compact.value && (view === 'chat' || view === 'launcher')) {
      compactRailOpen.value = false
    }
    if (view === 'launcher') {
      homeRef.value?.focus?.()
    }
  },
)

watch(compact, (isCompact) => {
  if (!isCompact) compactRailOpen.value = false
})

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

.ai-workbench-rail {
  flex: 0 0 224px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-secondary) 82%, transparent);
}

.ai-workbench-rail-compact-head,
.ai-workbench-compact-toolbar {
  display: none;
}

.ai-workbench-rail-compact-head {
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 34px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-secondary) 90%, var(--bg-primary));
}

.ai-workbench-rail-compact-title,
.ai-workbench-compact-trigger-label {
  font-size: var(--ai-rail-kicker-size);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.ai-workbench-rail-close {
  width: 24px;
  height: 24px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, var(--fg-muted));
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-primary) 82%, var(--bg-hover));
  color: var(--fg-muted);
  font-size: var(--surface-font-title);
  line-height: 1;
  cursor: pointer;
}

.ai-workbench-compact-toolbar {
  padding: 8px 10px 0;
}

.ai-workbench-compact-trigger {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, var(--fg-muted));
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-secondary) 82%, transparent);
  text-align: left;
  cursor: pointer;
}

.ai-workbench-compact-trigger.active {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-secondary));
}

.ai-workbench-rail-close:hover,
.ai-workbench-compact-trigger:hover {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--border));
  background: color-mix(in srgb, var(--bg-hover) 72%, var(--bg-primary));
}

.ai-workbench-compact-trigger-value {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ai-rail-body-size);
  color: var(--fg-primary);
}

.ai-workbench-rail-top {
  padding: 18px 16px 14px;
  border-bottom: 1px solid var(--border);
}

.ai-workbench-rail-kicker {
  font-size: var(--ai-rail-kicker-size);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.ai-workbench-rail-context {
  margin-top: 8px;
  font-size: var(--ai-rail-title-size);
  line-height: 1.2;
  font-weight: 600;
  color: var(--fg-primary);
  word-break: break-word;
}

.ai-workbench-rail-workspace {
  margin-top: 6px;
  font-size: var(--ai-rail-meta-size);
  color: var(--fg-muted);
  word-break: break-word;
}

.ai-workbench-new-chat {
  margin-top: 12px;
  width: 100%;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--fg-secondary);
  font-size: var(--ai-rail-body-size);
  cursor: pointer;
  transition: border-color 0.14s ease, background-color 0.14s ease, color 0.14s ease;
}

.ai-workbench-new-chat:hover {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-primary));
  color: var(--fg-primary);
}

.ai-workbench-rail-section {
  min-height: 0;
  flex: 1 1 auto;
  padding: 14px 10px 12px;
  overflow-y: auto;
}

.ai-workbench-rail-section-title {
  padding: 0 6px 8px;
  font-size: var(--ai-rail-kicker-size);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.ai-workbench-chat-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-workbench-chat-item {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.14s ease, background-color 0.14s ease;
}

.ai-workbench-chat-item:hover {
  background: var(--bg-hover);
}

.ai-workbench-chat-item.active {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-primary));
}

.ai-workbench-chat-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-workbench-chat-label {
  min-width: 0;
  flex: 1 1 auto;
  font-size: var(--ai-rail-body-size);
  line-height: 1.4;
  color: var(--fg-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-workbench-chat-badge {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: var(--ai-rail-kicker-size);
  text-transform: uppercase;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.ai-workbench-chat-meta {
  margin-top: 3px;
  font-size: var(--ai-rail-meta-size);
  color: var(--fg-muted);
}

.ai-workbench-chat-empty {
  padding: 0 6px;
  font-size: var(--ai-rail-body-size);
  color: var(--fg-muted);
}

.ai-workbench-main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
  justify-self: stretch;
  background: var(--bg-primary);
}

.ai-workbench-backdrop {
  position: absolute;
  inset: 0;
  z-index: 3;
  border: none;
  background: color-mix(in srgb, var(--bg-primary) 26%, transparent);
  backdrop-filter: blur(1.5px);
}

@container (max-width: 980px) {
  .ai-workbench-rail {
    position: absolute;
    inset: 0 auto 0 0;
    width: min(224px, 74cqw);
    max-width: calc(100% - 28px);
    z-index: 4;
    pointer-events: none;
    transform: translateX(calc(-100% - 10px));
    transition: transform 180ms ease;
    box-shadow: 14px 0 32px color-mix(in srgb, var(--bg-primary) 22%, transparent);
  }

  .ai-workbench.is-rail-drawer-open .ai-workbench-rail {
    pointer-events: auto;
    transform: translateX(0);
  }

  .ai-workbench-rail-compact-head,
  .ai-workbench-compact-toolbar {
    display: flex;
  }

  .ai-workbench-rail-top {
    padding: 14px 12px 12px;
  }

  .ai-workbench-rail-context {
    font-size: var(--surface-font-title);
  }
}
</style>
