<template>
  <div class="editor-page editor-page-compact">
    <h3 class="settings-section-title">{{ t('Editor') }}</h3>

    <div class="editor-toggles">
      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot good"></span>
          <span class="env-lang-name">{{ t('Writing font') }}</span>
          <span class="env-lang-version">{{ currentFontLabel }}</span>
        </div>
        <div class="wrap-column-row editor-card-offset">
          <label class="ghost-model-label">{{ t('Prose font:') }}</label>
          <div class="wrap-preset-group settings-segmented">
            <UiButton
              v-for="font in proseFonts"
              :key="font.value"
              class="wrap-preset-btn settings-segmented-btn font-preset-btn"
              variant="ghost"
              size="sm"
              :active="workspace.proseFont === font.value"
              :style="{ fontFamily: font.family, fontSize: font.fontSize }"
              @click="workspace.setProseFont(font.value)"
            >
              {{ t(font.labelKey) }}
            </UiButton>
          </div>
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="workspace.autoSave ? 'good' : 'warn'"></span>
          <span class="env-lang-name">{{ t('Auto Save') }}</span>
          <span class="env-lang-version">{{
            workspace.autoSave ? t('Enabled') : t('Disabled')
          }}</span>
          <div class="ui-flex-spacer"></div>
          <UiSwitch
            :model-value="workspace.autoSave"
            :aria-label="t('Toggle auto save')"
            @update:model-value="workspace.toggleAutoSave()"
          />
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="workspace.softWrap ? 'good' : 'none'"></span>
          <span class="env-lang-name">{{ t('Soft Wrap') }}</span>
          <span v-if="workspace.softWrap" class="env-lang-version">{{ t('Enabled') }}</span>
          <span v-else class="env-lang-missing">{{ t('Disabled') }}</span>
          <div class="ui-flex-spacer"></div>
          <UiSwitch
            :model-value="workspace.softWrap"
            :aria-label="t('Toggle soft wrap')"
            @update:model-value="workspace.toggleSoftWrap()"
          />
        </div>
        <div v-if="workspace.softWrap" class="wrap-column-row editor-card-offset">
          <label class="ghost-model-label">{{ t('Line width:') }}</label>
          <div class="wrap-preset-group settings-segmented">
            <UiButton
              v-for="preset in WRAP_PRESETS"
              :key="preset.value"
              class="wrap-preset-btn settings-segmented-btn"
              variant="ghost"
              size="sm"
              :active="workspace.wrapColumn === preset.value"
              @click="workspace.setWrapColumn(preset.value)"
            >
              {{ t(preset.labelKey) }}
            </UiButton>
          </div>
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="workspace.spellcheck ? 'good' : 'none'"></span>
          <span class="env-lang-name">{{ t('Spell Check') }}</span>
          <span v-if="workspace.spellcheck" class="env-lang-version">{{ t('Enabled') }}</span>
          <span v-else class="env-lang-missing">{{ t('Disabled') }}</span>
          <div class="ui-flex-spacer"></div>
          <UiSwitch
            :model-value="workspace.spellcheck"
            :aria-label="t('Toggle spell check')"
            @update:model-value="workspace.toggleSpellcheck()"
          />
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="typstStore.autoCompile ? 'good' : 'warn'"></span>
          <span class="env-lang-name">{{ t('Typst compile on save') }}</span>
          <span class="env-lang-version">{{
            typstStore.autoCompile ? t('Enabled') : t('Disabled')
          }}</span>
          <div class="ui-flex-spacer"></div>
          <UiSwitch
            :model-value="typstStore.autoCompile"
            :aria-label="t('Toggle Typst compile on save')"
            @update:model-value="typstStore.setAutoCompile(!typstStore.autoCompile)"
          />
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="typstStore.formatOnSave ? 'good' : 'warn'"></span>
          <span class="env-lang-name">{{ t('Typst format on save') }}</span>
          <span class="env-lang-version">{{
            typstStore.formatOnSave ? t('Enabled') : t('Disabled')
          }}</span>
          <div class="ui-flex-spacer"></div>
          <UiSwitch
            :model-value="typstStore.formatOnSave"
            :aria-label="t('Toggle Typst format on save')"
            @update:model-value="typstStore.setFormatOnSave(!typstStore.formatOnSave)"
          />
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="latexStore.autoCompile ? 'good' : 'warn'"></span>
          <span class="env-lang-name">{{ t('LaTeX compile on save') }}</span>
          <span class="env-lang-version">{{
            latexStore.autoCompile ? t('Enabled') : t('Disabled')
          }}</span>
          <div class="ui-flex-spacer"></div>
          <UiSwitch
            :model-value="latexStore.autoCompile"
            :aria-label="t('Toggle LaTeX compile on save')"
            @update:model-value="latexStore.setAutoCompile(!latexStore.autoCompile)"
          />
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="latexStore.formatOnSave ? 'good' : 'warn'"></span>
          <span class="env-lang-name">{{ t('LaTeX format on save') }}</span>
          <span class="env-lang-version">{{
            latexStore.formatOnSave ? t('Enabled') : t('Disabled')
          }}</span>
          <div class="ui-flex-spacer"></div>
          <UiSwitch
            :model-value="latexStore.formatOnSave"
            :aria-label="t('Toggle LaTeX format on save')"
            @update:model-value="latexStore.setFormatOnSave(!latexStore.formatOnSave)"
          />
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="typstStore.inlayHints ? 'good' : 'warn'"></span>
          <span class="env-lang-name">{{ t('Typst inlay hints') }}</span>
          <span class="env-lang-version">{{
            typstStore.inlayHints ? t('Enabled') : t('Disabled')
          }}</span>
          <div class="ui-flex-spacer"></div>
          <UiSwitch
            :model-value="typstStore.inlayHints"
            :aria-label="t('Toggle Typst inlay hints')"
            @update:model-value="typstStore.setInlayHintsEnabled(!typstStore.inlayHints)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useTypstStore } from '../../stores/typst'
import { useLatexStore } from '../../stores/latex'
import { useI18n } from '../../i18n'
import UiButton from '../shared/ui/UiButton.vue'
import UiSwitch from '../shared/ui/UiSwitch.vue'

const workspace = useWorkspaceStore()
const typstStore = useTypstStore()
const latexStore = useLatexStore()
const { t } = useI18n()

const proseFonts = [
  { value: 'inter', labelKey: 'Sans', family: "'Inter', system-ui, sans-serif", fontSize: '13px' },
  { value: 'stix', labelKey: 'Serif', family: "'STIX Two Text', Georgia, serif", fontSize: '13px' },
  { value: 'mono', labelKey: 'Mono', family: "'JetBrains Mono', monospace", fontSize: '12px' },
]

const WRAP_PRESETS = [
  { value: 0, labelKey: 'Auto' },
  { value: 80, labelKey: '80 ch' },
  { value: 100, labelKey: '100 ch' },
  { value: 120, labelKey: '120 ch' },
]

const currentFontLabel = computed(() => {
  return proseFonts.find((font) => font.value === workspace.proseFont)?.labelKey
    ? t(proseFonts.find((font) => font.value === workspace.proseFont)?.labelKey)
    : t('Sans')
})
</script>
