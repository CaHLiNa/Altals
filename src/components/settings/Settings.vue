<template>
  <Teleport to="body">
    <div v-if="visible" class="settings-overlay" @click.self="$emit('close')">
      <div ref="modalRef" class="settings-modal" :style="modalStyle">
        <div class="settings-titlebar" @mousedown="startModalDrag">
          <div class="settings-titlebar-copy">
            <span class="settings-titlebar-eyebrow">{{ t('Settings') }}</span>
            <span class="settings-titlebar-title">{{ activeSectionLabel }}</span>
          </div>
          <UiButton
            class="settings-close"
            variant="ghost"
            size="icon-sm"
            icon-only
            type="button"
            :title="t('Close')"
            @mousedown.stop
            @click="$emit('close')"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            >
              <path d="M1 1l8 8M9 1L1 9" />
            </svg>
          </UiButton>
        </div>

        <div class="settings-shell">
          <!-- Left nav -->
          <div class="settings-nav">
            <div class="settings-nav-header">{{ t('Settings') }}</div>
            <template v-for="(item, i) in sections" :key="item.id || `sep-${i}`">
              <div v-if="item.separator" class="settings-nav-separator"></div>
              <UiButton
                v-else
                class="settings-nav-item"
                variant="ghost"
                size="sm"
                block
                :active="activeSection === item.id"
                @click="activeSection = item.id"
              >
                <template #leading>
                  <component :is="item.icon" :size="16" :stroke-width="1.5" />
                </template>
                {{ item.label }}
              </UiButton>
            </template>
          </div>

          <!-- Main content -->
          <div class="settings-content">
            <component :is="activeSectionComponent" :key="activeSection" />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { IconPalette, IconEdit, IconCpu, IconRefresh } from '@tabler/icons-vue'
import { useI18n } from '../../i18n'
import UiButton from '../shared/ui/UiButton.vue'

const SettingsTheme = defineAsyncComponent(() => import('./SettingsTheme.vue'))
const SettingsEditor = defineAsyncComponent(() => import('./SettingsEditor.vue'))
const SettingsEnvironment = defineAsyncComponent(() => import('./SettingsEnvironment.vue'))
const SettingsUpdates = defineAsyncComponent(() => import('./SettingsUpdates.vue'))

const props = defineProps({
  visible: { type: Boolean, default: false },
  initialSection: { type: String, default: null },
})
defineEmits(['close'])

const activeSection = ref('theme')
const modalRef = ref(null)
const modalPosition = ref({ x: 0, y: 0 })
const { t } = useI18n()
let dragState = null

const modalStyle = computed(() => ({
  left: `${modalPosition.value.x}px`,
  top: `${modalPosition.value.y}px`,
}))

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      activeSection.value = sectionComponents[props.initialSection] ? props.initialSection : 'theme'
      await centerModal()
      return
    }
    stopModalDrag()
  }
)

const sections = [
  { id: 'theme', label: t('Theme'), icon: IconPalette },
  { id: 'editor', label: t('Editor'), icon: IconEdit },
  { separator: true },
  { id: 'system', label: t('System'), icon: IconCpu },
  { id: 'updates', label: t('Updates'), icon: IconRefresh },
]

const sectionComponents = {
  theme: SettingsTheme,
  editor: SettingsEditor,
  system: SettingsEnvironment,
  updates: SettingsUpdates,
}

const activeSectionLabel = computed(
  () => sections.find((item) => item.id === activeSection.value)?.label ?? t('Settings')
)

const activeSectionComponent = computed(
  () => sectionComponents[activeSection.value] || SettingsTheme
)

function clampModalPosition(x, y) {
  const rect = modalRef.value?.getBoundingClientRect()
  const width = rect?.width ?? 760
  const height = rect?.height ?? 640
  const margin = 16
  const maxX = Math.max(margin, window.innerWidth - width - margin)
  const maxY = Math.max(margin, window.innerHeight - height - margin)

  return {
    x: Math.min(Math.max(x, margin), maxX),
    y: Math.min(Math.max(y, margin), maxY),
  }
}

async function centerModal() {
  await nextTick()
  if (!modalRef.value) return

  const rect = modalRef.value.getBoundingClientRect()
  modalPosition.value = clampModalPosition(
    (window.innerWidth - rect.width) / 2,
    (window.innerHeight - rect.height) / 2
  )
}

function startModalDrag(event) {
  if (event.button !== 0 || !modalRef.value) return

  const interactiveTarget = event.target.closest('button, input, textarea, select, a')
  if (interactiveTarget) return

  const rect = modalRef.value.getBoundingClientRect()
  dragState = {
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  }

  document.body.classList.add('settings-dragging')
  document.addEventListener('mousemove', onModalDragMove)
  document.addEventListener('mouseup', stopModalDrag)
  event.preventDefault()
}

function onModalDragMove(event) {
  if (!dragState) return

  modalPosition.value = clampModalPosition(
    event.clientX - dragState.offsetX,
    event.clientY - dragState.offsetY
  )
}

function stopModalDrag() {
  if (!dragState) return

  dragState = null
  document.body.classList.remove('settings-dragging')
  document.removeEventListener('mousemove', onModalDragMove)
  document.removeEventListener('mouseup', stopModalDrag)
}

function handleWindowResize() {
  if (!props.visible) return

  modalPosition.value = clampModalPosition(modalPosition.value.x, modalPosition.value.y)
}

onMounted(() => {
  window.addEventListener('resize', handleWindowResize)
})

onBeforeUnmount(() => {
  stopModalDrag()
  window.removeEventListener('resize', handleWindowResize)
})
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: var(--overlay-backdrop);
}

.settings-modal {
  position: absolute;
  width: 760px;
  max-width: 90vw;
  height: 640px;
  max-height: 90vh;
  background: color-mix(in srgb, var(--panel-elevated) 98%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-subtle) 54%, transparent);
  border-radius: 14px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-titlebar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 0 18px 0 22px;
  border-bottom: 1px solid color-mix(in srgb, var(--border-subtle) 34%, transparent);
  background: color-mix(in srgb, var(--panel-elevated) 100%, transparent);
  user-select: none;
  cursor: grab;
}

.settings-titlebar-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.settings-titlebar-eyebrow {
  font-size: var(--ui-font-caption);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--text-muted);
}

.settings-titlebar-title {
  font-size: var(--ui-font-display);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.settings-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  background: color-mix(in srgb, var(--panel-elevated) 100%, transparent);
}

.settings-close {
  flex-shrink: 0;
}

/* Left nav */
.settings-nav {
  width: 176px;
  border-right: 1px solid color-mix(in srgb, var(--border-subtle) 30%, transparent);
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: color-mix(in srgb, var(--surface-base) 24%, transparent);
}

.settings-nav-header {
  display: flex;
  align-items: center;
  font-size: var(--ui-font-caption);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--text-muted);
  padding: 6px 10px 6px;
}

.settings-nav-item {
  justify-content: flex-start;
  padding: 0 10px;
  min-height: 30px;
  color: var(--text-secondary);
  text-align: left;
  font-size: var(--ui-font-body);
  border-radius: 7px;
}

.settings-nav-item:hover:not(:disabled) {
  background: color-mix(in srgb, var(--surface-hover) 28%, transparent);
}

.settings-nav-item.is-active {
  background: color-mix(in srgb, var(--surface-base) 92%, var(--toolbar-surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border) 26%, transparent);
  color: var(--text-primary);
}

.settings-nav-separator {
  height: 1px;
  background: color-mix(in srgb, var(--border-subtle) 30%, transparent);
  margin: 6px 8px;
}

/* Main content */
.settings-content {
  flex: 1;
  min-width: 0;
  padding: 18px 20px 22px;
  overflow-y: auto;
  background: color-mix(in srgb, var(--panel-elevated) 100%, transparent);
}
</style>

<!-- Shared styles for all settings sections (scoped under .settings-modal to prevent leakage) -->
<style>
.settings-modal .settings-section-title {
  font-size: var(--ui-font-display);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: 18px;
}

.settings-modal .settings-hint {
  font-size: var(--ui-font-caption);
  color: var(--text-muted);
  margin: -8px 0 16px;
}

.settings-modal .settings-hint code {
  background: var(--surface-muted);
  padding: 1px 4px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--ui-font-micro);
}

/* Shared key/form styles */
.settings-modal .keys-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-modal .key-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-modal .key-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.settings-modal .key-provider {
  font-size: var(--ui-font-label);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.settings-modal .key-env {
  font-size: var(--ui-font-micro);
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.settings-modal .key-input-row {
  display: flex;
  gap: 4px;
}

.settings-modal .key-toggle {
  flex-shrink: 0;
}

.settings-modal .keys-actions {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-modal .key-saved-hint {
  font-size: var(--ui-font-caption);
  color: var(--text-muted);
}

.settings-modal .settings-choice-grid {
  display: grid;
  gap: var(--space-2);
}

.settings-modal .settings-choice-card {
  justify-content: flex-start;
  align-items: stretch;
  padding: 12px 14px;
  text-align: left;
  border-radius: 10px;
}

.settings-modal .settings-choice-card:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--border) 34%, transparent);
  background: color-mix(in srgb, var(--surface-hover) 42%, transparent);
}

.settings-modal .settings-choice-card.is-active {
  border-color: color-mix(in srgb, var(--border) 32%, transparent);
  background: color-mix(in srgb, var(--surface-base) 92%, var(--toolbar-surface));
  color: var(--text-primary);
}

.settings-modal .settings-choice-card-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-modal .settings-choice-card-title {
  font-size: var(--ui-font-body);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.settings-modal .settings-choice-card-desc {
  font-size: var(--ui-font-caption);
  color: var(--text-muted);
}

.settings-modal .settings-choice-card-meta {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  margin-top: var(--space-1);
  padding: 2px 7px;
  border-radius: 999px;
  font-size: var(--ui-font-micro);
  color: var(--text-muted);
  background: color-mix(in srgb, var(--surface-base) 32%, transparent);
}

.settings-modal .settings-choice-card-meta.is-good {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.settings-modal .settings-segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid color-mix(in srgb, var(--border-subtle) 36%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--surface-base) 42%, transparent);
}

.settings-modal .settings-segmented-btn {
  min-height: 26px;
  padding: 0 10px;
  border-radius: calc(var(--radius-sm) - 1px);
  color: var(--text-muted);
}

.settings-modal .settings-segmented-btn.is-active {
  background: color-mix(in srgb, var(--surface-base) 92%, var(--toolbar-surface));
  color: var(--text-primary);
}

.settings-modal .settings-list-button {
  justify-content: flex-start;
  width: 100%;
  padding: 6px 8px;
  text-align: left;
}

.settings-modal .settings-list-button.is-active {
  background: color-mix(in srgb, var(--surface-base) 92%, var(--toolbar-surface));
  color: var(--text-primary);
}

.settings-modal .settings-list-button-copy {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.settings-modal .settings-disclosure-button {
  justify-content: flex-start;
  gap: 6px;
  padding: 0;
  min-height: 24px;
  color: var(--text-muted);
}

.settings-modal .settings-disclosure-button:hover:not(:disabled) {
  color: var(--text-secondary);
  background: transparent;
}

.settings-modal .settings-disclosure-icon {
  transition: transform 0.15s ease;
  transform-origin: center;
}

.settings-modal .settings-disclosure-button.is-active .settings-disclosure-icon {
  transform: rotate(90deg);
}

/* Shared card styles */
.settings-modal .env-lang-card {
  border: 1px solid color-mix(in srgb, var(--border-subtle) 34%, transparent);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  background: color-mix(in srgb, var(--surface-base) 32%, transparent);
}

.settings-modal .env-lang-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-modal .env-lang-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.settings-modal .env-lang-dot.good {
  background: var(--success, #50fa7b);
}
.settings-modal .env-lang-dot.warn {
  background: var(--warning, #e2b93d);
}
.settings-modal .env-lang-dot.none {
  background: var(--fg-muted);
  opacity: 0.4;
}

.settings-modal .env-lang-name {
  font-size: var(--ui-font-body);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.settings-modal .env-lang-version {
  font-size: var(--ui-font-caption);
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.settings-modal .env-lang-missing {
  font-size: var(--ui-font-caption);
  color: var(--text-muted);
  font-style: italic;
}

.settings-modal .env-lang-hint {
  margin-top: 4px;
  padding-left: 16px;
  font-size: var(--ui-font-micro);
  color: var(--fg-muted);
}

.settings-modal .settings-link {
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
}

.settings-modal .settings-link:hover {
  text-decoration: underline;
}

body.settings-dragging,
body.settings-dragging * {
  user-select: none !important;
}

body.settings-dragging .settings-titlebar {
  cursor: grabbing;
}
</style>
