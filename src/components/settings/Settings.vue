<!-- START OF FILE src/components/settings/Settings.vue -->
<template>
  <div class="settings-surface" data-surface-context-guard="true">
    <header class="settings-header">
      <h2 class="settings-header-title">{{ activeSectionLabel }}</h2>
    </header>

    <div class="settings-content">
      <component :is="activeSectionComponent" :key="activeSection" />
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useI18n } from '../../i18n'
import { useWorkspaceStore } from '../../stores/workspace'
import { SETTINGS_SECTION_DEFINITIONS } from './settingsSections.js'

const SettingsTheme = defineAsyncComponent(() => import('./SettingsTheme.vue'))
const SettingsEditor = defineAsyncComponent(() => import('./SettingsEditor.vue'))
const SettingsEnvironment = defineAsyncComponent(() => import('./SettingsEnvironment.vue'))
const SettingsUpdates = defineAsyncComponent(() => import('./SettingsUpdates.vue'))
const SettingsZotero = defineAsyncComponent(() => import('./SettingsZotero.vue'))

const workspace = useWorkspaceStore()
const { t } = useI18n()

const sections = computed(() =>
  SETTINGS_SECTION_DEFINITIONS.map((item) => ({
    ...item,
    label: t(item.labelKey),
  }))
)

const sectionComponents = {
  theme: SettingsTheme,
  editor: SettingsEditor,
  system: SettingsEnvironment,
  updates: SettingsUpdates,
  zotero: SettingsZotero,
}

const activeSection = computed(() =>
  sectionComponents[workspace.settingsSection] ? workspace.settingsSection : 'theme'
)

const activeSectionMeta = computed(
  () => sections.value.find((item) => item.id === activeSection.value) || sections.value[0]
)

const activeSectionLabel = computed(() => activeSectionMeta.value?.label ?? t('Settings'))
const activeSectionComponent = computed(
  () => sectionComponents[activeSection.value] || SettingsTheme
)
</script>

<style scoped>
.settings-surface {
  --settings-row-surface: var(--surface-base);
  --settings-row-border: color-mix(in srgb, var(--border-subtle) 40%, transparent);
  
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 32px 32px 20px 24px;
  background: transparent;
}

.theme-light .settings-surface {
  --settings-row-surface: #ffffff;
  --settings-row-border: rgba(0, 0, 0, 0.1);
}

.settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 0 0 20px;
}

.settings-header-title {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.settings-content {
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  justify-content: flex-start;
  overflow-y: auto;
  padding: 0 4px 18px 0;
}
</style>

<style>
/* 重构为 macOS Ventura 分组列表风格 */
.settings-surface .settings-section-title {
  display: none;
}

.settings-surface .settings-page {
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-height: 100%;
  width: min(100%, 720px);
}

.settings-surface .settings-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-surface .settings-group-title {
  margin: 0;
  padding: 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}

/* 分组白板/黑板底色 */
.settings-surface .settings-group-body {
  display: flex;
  flex-direction: column;
  background: var(--settings-row-surface);
  border: 1px solid var(--settings-row-border);
  border-radius: 8px; 
  overflow: hidden; 
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.settings-surface .settings-page::after {
  content: '';
  flex: 1 0 20px;
}

.settings-surface .settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-radius: 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--settings-row-border);
  box-shadow: none;
}

.settings-surface .settings-row:last-child {
  border-bottom: none;
}

.settings-surface .settings-row-copy {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-surface .settings-row-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
}

.settings-surface .settings-row-hint {
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-muted);
}

.settings-surface .settings-row-control {
  flex: 0 0 auto;
  align-self: center;
  min-width: 140px;
  display: flex;
  justify-content: flex-end;
}

.settings-surface .settings-row-control.compact {
  min-width: auto;
}

/* =========================================================================
   原生化的 Select 和 Button 控件
========================================================================= */
.settings-surface .settings-row-control .ui-select-shell .ui-select-trigger,
.settings-surface .settings-row-control .ui-button.ui-button--secondary {
  min-height: 26px !important;
  height: 26px !important;
  border-radius: 6px !important;
  padding: 0 10px !important;
  font-size: 13px !important;
  background: var(--surface-base) !important;
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent) !important;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important;
  color: var(--text-primary) !important;
}

/* 下拉菜单需要给箭头留白 */
.settings-surface .settings-row-control .ui-select-shell .ui-select-trigger {
  padding: 0 24px 0 10px !important;
}

.settings-surface .settings-row-control .ui-select-shell .ui-select-trigger:hover:not(:disabled),
.settings-surface .settings-row-control .ui-button.ui-button--secondary:hover:not(:disabled) {
  background: var(--surface-hover) !important;
  border-color: var(--border) !important;
}

.settings-surface .settings-row-control .ui-button.ui-button--danger {
  min-height: 26px !important;
  height: 26px !important;
  border-radius: 6px !important;
  padding: 0 10px !important;
  font-size: 13px !important;
}

/* Switch 调整为原生比例 */
.settings-surface button.ui-switch.ui-switch--md {
  width: 36px;
  height: 20px;
  background: var(--border);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
}
.settings-surface button.ui-switch.ui-switch--md.is-on {
  background: var(--success);
  box-shadow: none;
}
.settings-surface button.ui-switch.ui-switch--md .ui-switch-knob {
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
.settings-surface button.ui-switch.ui-switch--md.is-on .ui-switch-knob {
  transform: translateX(16px);
}

/* 分段控制器 (Segmented Control) 紧凑化 */
.settings-surface .settings-segmented {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  padding: 2px;
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  border-radius: 6px;
  background: var(--surface-base);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}

.settings-surface .settings-segmented-btn {
  min-height: 22px;
  padding: 0 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}

.settings-surface .settings-segmented-btn.is-active {
  background: var(--surface-raised);
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
}

.theme-light .settings-surface .settings-segmented-btn.is-active {
  background: #ffffff;
  border-color: transparent;
}

@media (max-width: 720px) {
  .settings-surface {
    padding: 24px 16px 16px;
  }
  .settings-surface .settings-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .settings-surface .settings-row-control {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>