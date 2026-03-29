<template>
  <div class="theme-page theme-page-compact">
    <h3 class="settings-section-title">{{ t('Theme') }}</h3>
    <div class="theme-grid">
      <UiButton
        v-for="theme in themes"
        :key="theme.id"
        class="theme-card settings-choice-card"
        variant="secondary"
        size="sm"
        block
        content-mode="raw"
        :active="workspace.theme === theme.id"
        @click="workspace.setTheme(theme.id)"
      >
        <!-- Mini preview -->
        <div class="theme-preview" :style="{ background: theme.colors.bgPrimary }">
          <!-- Sidebar -->
          <div
            class="theme-preview-sidebar"
            :style="{ background: theme.colors.bgSecondary }"
          ></div>
          <!-- Editor area -->
          <div class="theme-preview-editor">
            <div
              class="theme-preview-line"
              :style="{ background: theme.colors.fgMuted, width: '60%' }"
            ></div>
            <div
              class="theme-preview-line"
              :style="{ background: theme.colors.accent, width: '45%' }"
            ></div>
            <div
              class="theme-preview-line"
              :style="{ background: theme.colors.fgMuted, width: '70%' }"
            ></div>
            <div
              class="theme-preview-line"
              :style="{ background: theme.colors.accentSecondary, width: '35%' }"
            ></div>
            <div
              class="theme-preview-line"
              :style="{ background: theme.colors.fgMuted, width: '55%' }"
            ></div>
          </div>
        </div>
        <!-- Label -->
        <div class="theme-label">{{ t(theme.label) }}</div>
        <div class="theme-description">{{ t(theme.description) }}</div>
        <!-- Color dots -->
        <div class="theme-dots">
          <span class="theme-dot" :style="{ background: theme.colors.accent }"></span>
          <span class="theme-dot" :style="{ background: theme.colors.accentSecondary }"></span>
          <span class="theme-dot" :style="{ background: theme.colors.success }"></span>
          <span class="theme-dot" :style="{ background: theme.colors.error }"></span>
        </div>
      </UiButton>
    </div>

    <h3 class="settings-section-title theme-subsection-title">{{ t('PDF viewer') }}</h3>

    <div class="env-lang-card theme-option-card">
      <div class="env-lang-header">
        <span class="env-lang-dot" :class="workspace.pdfThemedPages ? 'good' : 'none'"></span>
        <span class="env-lang-name">{{ t('Themed PDF pages') }}</span>
        <span v-if="workspace.pdfThemedPages" class="theme-option-status">{{ t('Enabled') }}</span>
        <span v-else class="theme-option-status theme-option-status-off">{{ t('Disabled') }}</span>
        <div class="ui-flex-spacer"></div>
        <UiSwitch
          :model-value="workspace.pdfThemedPages"
          :aria-label="t('Toggle themed PDF pages')"
          @update:model-value="workspace.togglePdfThemedPages()"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useWorkspaceStore } from '../../stores/workspace'
import { useI18n } from '../../i18n'
import { WORKSPACE_THEME_OPTIONS } from '../../shared/workspaceThemeOptions.js'
import UiButton from '../shared/ui/UiButton.vue'
import UiSwitch from '../shared/ui/UiSwitch.vue'

const workspace = useWorkspaceStore()
const { t } = useI18n()
const themes = WORKSPACE_THEME_OPTIONS
</script>

<style scoped>
.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.theme-subsection-title {
  margin-top: 16px;
}

.theme-card {
  min-height: 0;
  flex-direction: column;
  align-items: stretch;
}

.theme-preview {
  height: 50px;
  border-radius: 4px;
  display: flex;
  overflow: hidden;
  margin-bottom: 6px;
}

.theme-preview-sidebar {
  width: 20%;
}

.theme-preview-editor {
  flex: 1;
  padding: 5px 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  justify-content: center;
}

.theme-preview-line {
  height: 2px;
  border-radius: 1px;
  opacity: 0.7;
}

.theme-label {
  font-size: var(--ui-font-label);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  margin-bottom: 3px;
}

.theme-description {
  min-height: 34px;
  margin-bottom: 6px;
  font-size: var(--ui-font-caption);
  line-height: 1.45;
  color: var(--text-muted);
}

.theme-dots {
  display: flex;
  gap: 4px;
}

.theme-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.theme-option-card {
  margin-top: 0;
}

.theme-option-status {
  font-size: var(--ui-font-caption);
  color: var(--text-muted);
}

.theme-option-status-off {
  opacity: 0.8;
}

.theme-page-compact .settings-section-title {
  margin-bottom: 10px;
}

.theme-page-compact .theme-option-card {
  margin-top: 0;
}

.theme-page-compact :deep(.env-lang-card) {
  padding: 8px 10px;
  border-radius: 6px;
}

.theme-page-compact :deep(.env-lang-header) {
  gap: 6px;
  min-height: 20px;
}

.theme-page-compact :deep(.env-lang-name) {
  font-size: var(--ui-font-caption);
  font-weight: 600;
}

.theme-page-compact :deep(.env-lang-version) {
  font-size: var(--ui-font-micro);
}

@media (max-width: 980px) {
  .theme-grid {
    grid-template-columns: 1fr;
  }
}
</style>
