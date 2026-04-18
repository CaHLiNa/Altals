<template>
  <section ref="rootRef" class="ai-session-rail">
    <button
      type="button"
      class="ai-session-rail__current"
      :class="{
        'is-open': menuOpen,
        'is-running': currentSession?.isRunning,
        'has-error': currentSession?.hasError,
      }"
      :title="currentSession?.title || t('Session')"
      @click="toggleMenu"
    >
      <span
        class="ai-session-rail__status-dot"
        :class="{
          'is-running': currentSession?.isRunning,
          'has-error': currentSession?.hasError,
        }"
        aria-hidden="true"
      ></span>
      <span class="ai-session-rail__current-title">
        {{ currentSession?.title || t('New session') }}
      </span>
      <span v-if="currentSession?.isRunning" class="ai-session-rail__badge">
        {{ t('Running') }}
      </span>
      <span
        v-else-if="currentSession?.hasError"
        class="ai-session-rail__badge ai-session-rail__badge--error"
      >
        {{ t('Error') }}
      </span>
      <IconChevronDown class="ai-session-rail__chevron" :size="14" :stroke-width="2.1" />
    </button>

    <button
      type="button"
      class="ai-session-rail__create"
      :title="t('New session')"
      :aria-label="t('New session')"
      @click="$emit('create')"
    >
      <IconPlus :size="14" :stroke-width="2.3" />
    </button>

    <div v-if="menuOpen" class="ai-session-rail__menu">
      <div class="ai-session-rail__menu-header">
        <span class="ai-session-rail__menu-title">{{ t('Sessions') }}</span>
        <button
          type="button"
          class="ai-session-rail__menu-create"
          @click="handleCreateFromMenu"
        >
          <IconPlus :size="13" :stroke-width="2.2" />
          <span>{{ t('New session') }}</span>
        </button>
      </div>

      <div class="ai-session-rail__menu-list scrollbar-hidden">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="ai-session-rail__item"
          :class="{
            'is-active': session.id === currentSessionId,
            'has-error': session.hasError,
            'is-running': session.isRunning,
          }"
        >
          <div v-if="editingSessionId === session.id" class="ai-session-rail__editor">
            <UiInput
              ref="editingInputRef"
              :model-value="editingTitle"
              size="sm"
              class="ai-session-rail__input"
              @update:model-value="editingTitle = String($event || '')"
              @keydown="handleRenameKeydown($event, session.id)"
              @blur="commitRename(session.id)"
            />
          </div>

          <button
            v-else
            type="button"
            class="ai-session-rail__main"
            :class="{ 'is-active': session.id === currentSessionId }"
            :title="session.title"
            @click="handleSwitchFromMenu(session.id)"
            @dblclick="beginRename(session)"
          >
            <span
              class="ai-session-rail__status-dot"
              :class="{
                'is-active': session.id === currentSessionId,
                'is-running': session.isRunning,
                'has-error': session.hasError,
              }"
              aria-hidden="true"
            ></span>
            <span class="ai-session-rail__title">{{ session.title }}</span>
            <span v-if="session.isRunning" class="ai-session-rail__badge">
              {{ t('Running') }}
            </span>
            <span
              v-else-if="session.hasError"
              class="ai-session-rail__badge ai-session-rail__badge--error"
            >
              {{ t('Error') }}
            </span>
          </button>

          <button
            v-if="sessions.length > 1"
            type="button"
            class="ai-session-rail__close"
            :title="t('Delete session')"
            :aria-label="t('Delete session')"
            @click.stop="$emit('delete', session.id)"
          >
            <IconX :size="12" :stroke-width="2.2" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { IconChevronDown, IconPlus, IconX } from '@tabler/icons-vue'
import { useI18n } from '../../i18n'
import UiInput from '../shared/ui/UiInput.vue'

const props = defineProps({
  sessions: { type: Array, default: () => [] },
  currentSessionId: { type: String, default: '' },
})

const emit = defineEmits(['create', 'switch', 'rename', 'delete'])

const { t } = useI18n()

const rootRef = ref(null)
const editingInputRef = ref(null)
const editingSessionId = ref('')
const editingTitle = ref('')
const menuOpen = ref(false)

const currentSession = computed(
  () =>
    props.sessions.find((session) => session.id === props.currentSessionId) ||
    props.sessions[0] ||
    null
)

function closeMenu() {
  menuOpen.value = false
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function handleCreateFromMenu() {
  emit('create')
  closeMenu()
}

function handleSwitchFromMenu(sessionId = '') {
  emit('switch', sessionId)
  closeMenu()
}

function handlePointerDown(event) {
  if (!menuOpen.value) return
  if (rootRef.value?.contains(event.target)) return
  closeMenu()
}

function handleEscape(event) {
  if (event.key !== 'Escape') return
  if (editingSessionId.value) {
    cancelRename()
    return
  }
  closeMenu()
}

function beginRename(session = null) {
  const sessionId = String(session?.id || '').trim()
  if (!sessionId) return

  menuOpen.value = true
  editingSessionId.value = sessionId
  editingTitle.value = String(session?.title || '')

  nextTick(() => {
    editingInputRef.value?.focus?.()
    editingInputRef.value?.select?.()
  })
}

function cancelRename() {
  editingSessionId.value = ''
  editingTitle.value = ''
}

function commitRename(sessionId = '') {
  const normalizedTitle = String(editingTitle.value || '').trim()
  if (editingSessionId.value !== sessionId) return
  if (normalizedTitle) {
    emit('rename', {
      sessionId,
      title: normalizedTitle,
    })
  }
  cancelRename()
}

function handleRenameKeydown(event, sessionId = '') {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitRename(sessionId)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    cancelRename()
  }
}

watch(
  () => props.currentSessionId,
  () => {
    if (editingSessionId.value && editingSessionId.value !== props.currentSessionId) {
      cancelRename()
    }
  }
)

watch(
  () => props.sessions.length,
  () => {
    if (props.sessions.length <= 1) {
      closeMenu()
    }
  }
)

onMounted(() => {
  document.addEventListener('mousedown', handlePointerDown)
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handlePointerDown)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.ai-session-rail {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: auto;
  max-width: 100%;
  min-width: 0;
}

.ai-session-rail__current {
  flex: 0 1 auto;
  min-width: 120px;
  max-width: 220px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border-color) 46%, transparent);
  background: color-mix(in srgb, var(--surface-base) 88%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}

.ai-session-rail__current:hover,
.ai-session-rail__current.is-open {
  border-color: color-mix(in srgb, var(--accent) 26%, var(--border-color) 74%);
  background: color-mix(in srgb, var(--surface-hover) 22%, transparent);
  color: var(--text-primary);
}

.ai-session-rail__current.is-open {
  box-shadow: 0 8px 24px color-mix(in srgb, black 10%, transparent);
}

.ai-session-rail__current-copy {
  display: none;
}

.ai-session-rail__current-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: inherit;
}

.ai-session-rail__chevron {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  transition: transform 160ms ease, color 160ms ease;
}

.ai-session-rail__current.is-open .ai-session-rail__chevron {
  transform: rotate(180deg);
  color: var(--text-secondary);
}

.ai-session-rail__status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex: 0 0 auto;
  background: color-mix(in srgb, var(--accent) 68%, white 32%);
}

.ai-session-rail__status-dot.is-running {
  background: color-mix(in srgb, var(--warning) 80%, white 20%);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--warning) 14%, transparent);
}

.ai-session-rail__status-dot.has-error {
  background: color-mix(in srgb, var(--error) 82%, white 18%);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--error) 12%, transparent);
}

.ai-session-rail__badge {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--warning) 16%, transparent);
  color: color-mix(in srgb, var(--warning) 52%, var(--text-primary) 48%);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.ai-session-rail__badge--error {
  background: color-mix(in srgb, var(--error) 12%, transparent);
  color: var(--error);
}

.ai-session-rail__create {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border-color) 46%, transparent);
  background: color-mix(in srgb, var(--surface-base) 88%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.ai-session-rail__create:hover {
  border-color: color-mix(in srgb, var(--accent) 26%, var(--border-color) 74%);
  background: color-mix(in srgb, var(--surface-hover) 24%, transparent);
  color: var(--text-primary);
}

.ai-session-rail__create:active {
  transform: translateY(0.5px);
}

.ai-session-rail__create:focus-visible,
.ai-session-rail__current:focus-visible,
.ai-session-rail__menu-create:focus-visible,
.ai-session-rail__close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent);
}

.ai-session-rail__menu {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 10px);
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--border-color) 50%, transparent);
  background: color-mix(in srgb, var(--panel-surface) 92%, white 8%);
  box-shadow:
    0 18px 44px color-mix(in srgb, black 16%, transparent),
    inset 0 1px 0 color-mix(in srgb, white 58%, transparent);
  backdrop-filter: blur(18px) saturate(1.06);
}

.ai-session-rail__menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-session-rail__menu-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.ai-session-rail__menu-create {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border-color) 48%, transparent);
  background: color-mix(in srgb, var(--surface-base) 92%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
}

.ai-session-rail__menu-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.ai-session-rail__item {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.ai-session-rail__item:hover,
.ai-session-rail__item.is-active {
  border-color: color-mix(in srgb, var(--accent) 20%, var(--border-color) 80%);
  background: color-mix(in srgb, var(--surface-hover) 22%, transparent);
}

.ai-session-rail__item.is-active {
  background: color-mix(in srgb, white 70%, var(--surface-raised) 30%);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 60%, transparent);
}

.ai-session-rail__main,
.ai-session-rail__editor {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
}

.ai-session-rail__main {
  appearance: none;
  cursor: pointer;
  color: var(--text-secondary);
  text-align: left;
}

.ai-session-rail__main:hover,
.ai-session-rail__item:hover .ai-session-rail__main,
.ai-session-rail__main.is-active {
  color: var(--text-primary);
}

.ai-session-rail__title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.ai-session-rail__input {
  min-width: 148px;
}

.ai-session-rail__editor :deep(.ui-input-shell) {
  width: 100%;
  min-width: 148px;
  border-radius: 10px;
  background: color-mix(in srgb, white 72%, transparent);
  box-shadow: none;
}

.ai-session-rail__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-right: 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-tertiary);
  padding: 0;
  cursor: pointer;
  flex: 0 0 auto;
  opacity: 0;
  transform: scale(0.92);
  transition:
    opacity 140ms ease,
    transform 140ms ease,
    background-color 140ms ease,
    color 140ms ease;
}

.ai-session-rail__item.is-active .ai-session-rail__close,
.ai-session-rail__item:hover .ai-session-rail__close {
  opacity: 1;
  transform: scale(1);
}

.ai-session-rail__close:hover {
  background: color-mix(in srgb, var(--surface-hover) 88%, transparent);
  color: var(--text-primary);
}

.scrollbar-hidden::-webkit-scrollbar {
  display: none;
}
</style>
