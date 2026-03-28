<template>
  <Teleport to="body">
    <div v-if="visible" class="wizard-overlay">
      <div class="wizard-modal">
        <div class="wizard-step">
          <div class="wizard-brand">
            <img src="/icon.png" alt="" class="wizard-icon" draggable="false" />
            <div class="wizard-wordmark">Altals</div>
          </div>

          <h2 class="wizard-step-title">{{ t('Choose a theme for your writing workspace') }}</h2>
          <p class="wizard-step-hint">
            {{ t('This trimmed build focuses on Markdown, LaTeX, and Typst only.') }}
          </p>
          <p class="wizard-step-hint wizard-step-hint-secondary">
            {{ t('You can change this any time in Settings.') }}
          </p>

          <div class="wizard-theme-group-label">{{ t('Light') }}</div>
          <div class="wizard-theme-grid">
            <button
              v-for="theme in lightThemes"
              :key="theme.id"
              class="wizard-theme-card"
              :class="{ active: selectedTheme === theme.id }"
              @click="selectTheme(theme.id)"
            >
              <div class="wizard-theme-preview" :style="{ background: theme.colors.bgPrimary }">
                <div class="wizard-theme-sidebar" :style="{ background: theme.colors.bgSecondary }"></div>
                <div class="wizard-theme-editor">
                  <div class="wizard-theme-line" :style="{ background: theme.colors.fgMuted, width: '60%' }"></div>
                  <div class="wizard-theme-line" :style="{ background: theme.colors.accent, width: '45%' }"></div>
                  <div class="wizard-theme-line" :style="{ background: theme.colors.fgMuted, width: '70%' }"></div>
                  <div class="wizard-theme-line" :style="{ background: theme.colors.accentSecondary, width: '35%' }"></div>
                </div>
              </div>
              <div class="wizard-theme-label">{{ theme.label }}</div>
            </button>
          </div>

          <div class="wizard-theme-group-label wizard-theme-group-label-spaced">{{ t('Dark') }}</div>
          <div class="wizard-theme-grid">
            <button
              v-for="theme in darkThemes"
              :key="theme.id"
              class="wizard-theme-card"
              :class="{ active: selectedTheme === theme.id }"
              @click="selectTheme(theme.id)"
            >
              <div class="wizard-theme-preview" :style="{ background: theme.colors.bgPrimary }">
                <div class="wizard-theme-sidebar" :style="{ background: theme.colors.bgSecondary }"></div>
                <div class="wizard-theme-editor">
                  <div class="wizard-theme-line" :style="{ background: theme.colors.fgMuted, width: '60%' }"></div>
                  <div class="wizard-theme-line" :style="{ background: theme.colors.accent, width: '45%' }"></div>
                  <div class="wizard-theme-line" :style="{ background: theme.colors.fgMuted, width: '70%' }"></div>
                  <div class="wizard-theme-line" :style="{ background: theme.colors.accentSecondary, width: '35%' }"></div>
                </div>
              </div>
              <div class="wizard-theme-label">{{ theme.label }}</div>
            </button>
          </div>

          <div class="wizard-nav">
            <button class="wizard-btn primary" @click="finish">{{ t('Start Writing') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { useI18n } from '../i18n'

defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const workspace = useWorkspaceStore()
const { t } = useI18n()
const selectedTheme = ref(workspace.theme || 'default')

const themes = [
  { id: 'light', label: 'Light', group: 'light', colors: { bgPrimary: '#ffffff', bgSecondary: '#f5f6f8', fgMuted: '#999999', accent: '#5f9ea0', accentSecondary: '#4a7c7e' } },
  { id: 'solarized', label: 'Solarized', group: 'light', colors: { bgPrimary: '#fdf6e3', bgSecondary: '#eee8d5', fgMuted: '#93a1a1', accent: '#268bd2', accentSecondary: '#6c71c4' } },
  { id: 'one-light', label: 'One Light', group: 'light', colors: { bgPrimary: '#fafafa', bgSecondary: '#f0f0f1', fgMuted: '#a0a1a7', accent: '#4078f2', accentSecondary: '#a626a4' } },
  { id: 'humane', label: 'Humane', group: 'light', colors: { bgPrimary: '#faf9f5', bgSecondary: '#f2f0e7', fgMuted: '#9a9389', accent: '#b5623a', accentSecondary: '#6b8065' } },
  { id: 'default', label: 'Tokyo Night', group: 'dark', colors: { bgPrimary: '#1a1b26', bgSecondary: '#1f2335', fgMuted: '#565f89', accent: '#7aa2f7', accentSecondary: '#bb9af7' } },
  { id: 'dracula', label: 'Dracula', group: 'dark', colors: { bgPrimary: '#282a36', bgSecondary: '#21222c', fgMuted: '#6272a4', accent: '#bd93f9', accentSecondary: '#ff79c6' } },
  { id: 'monokai', label: 'Monokai', group: 'dark', colors: { bgPrimary: '#272822', bgSecondary: '#1e1f1c', fgMuted: '#75715e', accent: '#fd971f', accentSecondary: '#f92672' } },
  { id: 'nord', label: 'Nord', group: 'dark', colors: { bgPrimary: '#2e3440', bgSecondary: '#3b4252', fgMuted: '#616e88', accent: '#88c0d0', accentSecondary: '#81a1c1' } },
]

const lightThemes = computed(() => themes.filter((theme) => theme.group === 'light'))
const darkThemes = computed(() => themes.filter((theme) => theme.group === 'dark'))

function selectTheme(id) {
  selectedTheme.value = id
  workspace.setTheme(id)
}

function finish() {
  localStorage.setItem('setupComplete', 'true')
  emit('close')
}
</script>

<style scoped>
.wizard-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.wizard-modal {
  width: 520px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-secondary);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
}

.wizard-step {
  padding: 28px 36px 32px;
}

.wizard-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
}

.wizard-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
}

.wizard-wordmark {
  font-family: 'Crimson Text', 'Lora', 'Georgia', serif;
  font-size: var(--ui-font-hero-md);
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--fg-primary);
}

.wizard-step-title {
  margin: 0 0 16px;
  font-size: var(--ui-font-title);
  font-weight: 500;
  color: var(--fg-secondary);
}

.wizard-step-hint {
  margin: 0 0 8px;
  font-size: var(--ui-font-label);
  color: var(--fg-muted);
}

.wizard-step-hint-secondary {
  margin-bottom: 16px;
}

.wizard-theme-group-label {
  margin-bottom: 6px;
  font-size: var(--ui-font-caption);
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.wizard-theme-group-label-spaced {
  margin-top: 12px;
}

.wizard-theme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.wizard-theme-card {
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  background: var(--bg-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s;
}

.wizard-theme-card:hover {
  border-color: var(--fg-muted);
}

.wizard-theme-card.active {
  border-color: var(--accent);
}

.wizard-theme-preview {
  display: flex;
  height: 48px;
  margin-bottom: 4px;
  overflow: hidden;
  border-radius: 4px;
}

.wizard-theme-sidebar {
  width: 22%;
}

.wizard-theme-editor {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 5px 6px;
}

.wizard-theme-line {
  height: 2.5px;
  border-radius: 1px;
  opacity: 0.7;
}

.wizard-theme-label {
  overflow: hidden;
  font-size: var(--ui-font-micro);
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--fg-primary);
}

.wizard-nav {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}

.wizard-btn {
  padding: 8px 20px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: var(--ui-font-body);
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.wizard-btn.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg-primary);
}

.wizard-btn.primary:hover {
  opacity: 0.92;
}
</style>
