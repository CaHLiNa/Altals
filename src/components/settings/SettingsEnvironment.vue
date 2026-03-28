<template>
  <div class="env-page env-page-compact">
    <h3 class="settings-section-title">{{ t('Document Tooling') }}</h3>

    <div class="env-languages">
      <div class="env-lang-card env-card-span-full">
        <div class="env-lang-header">
          <span class="env-lang-dot good"></span>
          <span class="env-lang-name">Markdown</span>
          <span class="env-lang-version">Built in</span>
        </div>
        <div class="env-hint-inline">
          Plain text editing and preview are available without extra setup.
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="gitInstalled ? 'good' : 'none'"></span>
          <span class="env-lang-name">Git</span>
          <span v-if="gitInstalled" class="env-lang-version">{{ t('Installed') }}</span>
          <span v-else class="env-lang-missing">{{ t('Not found') }}</span>
        </div>
        <div class="env-hint-inline">
          {{ gitInstalled ? gitPath || 'git' : 'Git powers history, snapshots, and remote sync.' }}
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span
            class="env-lang-dot"
            :class="latexStore.hasAvailableCompiler ? 'good' : 'warn'"
          ></span>
          <span class="env-lang-name">{{ t('LaTeX Compiler') }}</span>
          <span class="env-lang-version">{{
            latexStore.hasAvailableCompiler ? latexStore.availableCompilerName : t('Needs setup')
          }}</span>
        </div>
        <div class="env-hint-inline">
          {{ t('Choose System TeX or Tectonic below.') }}
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="typstStore.available ? 'good' : 'warn'"></span>
          <span class="env-lang-name">{{ t('Typst Compiler') }}</span>
          <span class="env-lang-version">{{
            typstStore.available ? t('Installed') : t('Needs setup')
          }}</span>
        </div>
        <div class="env-hint-inline">
          {{ t('Install Typst and Tinymist below for live preview and sync.') }}
        </div>
      </div>
    </div>

    <div class="env-actions">
      <UiButton
        class="env-redetect-btn"
        variant="secondary"
        size="sm"
        :loading="
          gitChecking ||
          latexStore.checkingCompilers ||
          typstStore.checkingCompiler ||
          typstStore.downloading ||
          tinymistStore.checkingBinary ||
          tinymistStore.downloading
        "
        @click="redetectSystem"
      >
        {{
          gitChecking ||
          latexStore.checkingCompilers ||
          typstStore.checkingCompiler ||
          typstStore.downloading ||
          tinymistStore.checkingBinary ||
          tinymistStore.downloading
            ? t('Checking...')
            : t('Re-detect')
        }}
      </UiButton>
      <span v-if="!toolingChecked" class="env-hint-text">{{ t('Not yet detected') }}</span>
      <span v-else class="env-hint-text">{{ t('Last detected this session') }}</span>
    </div>

    <!-- LaTeX Compiler -->
    <h3 class="settings-section-title env-section-offset">{{ t('LaTeX Compiler') }}</h3>

    <div class="env-section-grid">
      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="latexHeaderDotClass"></span>
          <span class="env-lang-name">{{ t('Compiler') }}</span>
          <span class="env-lang-version">{{ latexPreferenceLabel }}</span>
        </div>
        <div class="env-compact-block env-compact-block-offset">
          <div class="env-inline-row env-inline-row-top">
            <UiSelect v-model="compilerPreference" shell-class="env-select-shell">
              <option value="auto">{{ t('Auto (prefer System TeX)') }}</option>
              <option value="system">{{ t('System TeX (latexmk)') }}</option>
              <option value="tectonic">Tectonic</option>
            </UiSelect>
          </div>
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="latexEngineDotClass"></span>
          <span class="env-lang-name">{{ t('LaTeX Engine') }}</span>
          <span class="env-lang-version">{{ latexEngineLabel }}</span>
        </div>
        <div class="env-compact-block env-compact-block-offset">
          <div class="env-inline-row env-inline-row-top">
            <UiSelect
              v-model="enginePreference"
              shell-class="env-select-shell"
              :disabled="latexStore.compilerPreference === 'tectonic'"
            >
              <option value="auto">{{ t('Auto') }}</option>
              <option value="xelatex">XeLaTeX</option>
              <option value="pdflatex">pdfLaTeX</option>
              <option value="lualatex">LuaLaTeX</option>
            </UiSelect>
          </div>
        </div>
      </div>

      <div class="env-lang-card env-card-span-full">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="latexBuildRecipeDotClass"></span>
          <span class="env-lang-name">{{ t('Build recipe') }}</span>
          <span class="env-lang-version">{{ latexStore.buildRecipeLabel }}</span>
        </div>
        <div class="env-compact-block env-compact-block-offset">
          <div class="env-inline-row env-inline-row-top">
            <UiSelect v-model="buildRecipe" shell-class="env-select-shell">
              <option
                v-for="option in latexBuildRecipeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </UiSelect>
          </div>
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span
            class="env-lang-dot"
            :class="latexStore.systemTexInstalled ? 'good' : 'none'"
          ></span>
          <span class="env-lang-name">{{ t('System TeX') }}</span>
          <span v-if="latexStore.systemTexInstalled" class="env-lang-version">{{
            t('Installed')
          }}</span>
          <span v-else class="env-lang-missing">{{ t('Not found') }}</span>
        </div>
      </div>

      <div class="env-lang-card">
        <template v-if="latexStore.tectonicInstalled">
          <div class="env-lang-header">
            <span class="env-lang-dot good"></span>
            <span class="env-lang-name">Tectonic</span>
            <span class="env-lang-version">{{ t('Installed') }}</span>
          </div>
        </template>

        <template v-else-if="latexStore.downloading">
          <div class="env-lang-header">
            <span class="env-lang-dot warn"></span>
            <span class="env-lang-name">Tectonic</span>
            <span class="env-lang-version">{{
              t('Downloading... {progress}%', { progress: latexStore.downloadProgress })
            }}</span>
          </div>
          <div class="tectonic-progress env-progress-shell">
            <div class="tectonic-progress-bar">
              <div
                class="tectonic-progress-fill"
                :style="{ width: latexStore.downloadProgress + '%' }"
              ></div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="env-lang-header">
            <span class="env-lang-dot none"></span>
            <span class="env-lang-name">Tectonic</span>
            <span class="env-lang-missing">{{ t('Not installed') }}</span>
          </div>
          <div class="env-action-row">
            <UiButton
              class="env-action-btn"
              variant="primary"
              size="sm"
              @click="latexStore.downloadTectonic()"
            >
              {{ t('Download Tectonic') }}
            </UiButton>
          </div>
        </template>

        <div v-if="latexStore.downloadError" class="env-install-error env-install-error-inline">
          {{ latexStore.downloadError }}
          <UiButton
            class="env-action-btn env-install-btn-inline"
            variant="secondary"
            size="sm"
            @click="latexStore.downloadTectonic()"
          >
            {{ t('Retry') }}
          </UiButton>
        </div>
      </div>
    </div>

    <h3 class="settings-section-title env-section-offset">{{ t('LaTeX Tools') }}</h3>

    <div class="env-section-grid">
      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="latexStore.chktexInstalled ? 'good' : 'none'"></span>
          <span class="env-lang-name">ChkTeX</span>
          <span v-if="latexStore.chktexInstalled" class="env-lang-version">{{
            t('Installed')
          }}</span>
          <span v-else class="env-lang-missing">{{ t('Not found') }}</span>
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span
            class="env-lang-dot"
            :class="latexStore.latexindentInstalled ? 'good' : 'none'"
          ></span>
          <span class="env-lang-name">latexindent</span>
          <span v-if="latexStore.latexindentInstalled" class="env-lang-version">{{
            t('Installed')
          }}</span>
          <span v-else class="env-lang-missing">{{ t('Not found') }}</span>
        </div>
      </div>
    </div>

    <h3 class="settings-section-title env-section-offset">Typst</h3>

    <div class="env-section-grid">
      <div class="env-lang-card">
        <template v-if="typstStore.available">
          <div class="env-lang-header">
            <span class="env-lang-dot good"></span>
            <span class="env-lang-name">Typst</span>
            <span class="env-lang-version">{{ t('Installed') }}</span>
          </div>
        </template>

        <template v-else-if="typstStore.downloading">
          <div class="env-lang-header">
            <span class="env-lang-dot warn"></span>
            <span class="env-lang-name">Typst</span>
            <span class="env-lang-version">{{
              t('Downloading... {progress}%', { progress: typstStore.downloadProgress })
            }}</span>
          </div>
          <div class="tectonic-progress env-progress-shell">
            <div class="tectonic-progress-bar">
              <div
                class="tectonic-progress-fill"
                :style="{ width: typstStore.downloadProgress + '%' }"
              ></div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="env-lang-header">
            <span class="env-lang-dot none"></span>
            <span class="env-lang-name">Typst</span>
            <span class="env-lang-missing">{{ t('Not installed') }}</span>
          </div>
          <div class="env-action-row">
            <UiButton
              class="env-action-btn"
              variant="primary"
              size="sm"
              @click="typstStore.downloadTypst()"
            >
              {{ t('Download Typst') }}
            </UiButton>
          </div>
        </template>

        <div v-if="typstStore.downloadError" class="env-install-error env-install-error-inline">
          {{ typstStore.downloadError }}
          <UiButton
            class="env-action-btn env-install-btn-inline"
            variant="secondary"
            size="sm"
            @click="typstStore.downloadTypst()"
          >
            {{ t('Retry') }}
          </UiButton>
        </div>
      </div>

      <div class="env-lang-card">
        <template v-if="tinymistStore.available">
          <div class="env-lang-header">
            <span class="env-lang-dot good"></span>
            <span class="env-lang-name">Tinymist</span>
            <span class="env-lang-version">{{ t('Installed') }}</span>
          </div>
        </template>

        <template v-else-if="tinymistStore.downloading">
          <div class="env-lang-header">
            <span class="env-lang-dot warn"></span>
            <span class="env-lang-name">Tinymist</span>
            <span class="env-lang-version">{{
              t('Downloading... {progress}%', { progress: tinymistStore.downloadProgress })
            }}</span>
          </div>
          <div class="tectonic-progress env-progress-shell">
            <div class="tectonic-progress-bar">
              <div
                class="tectonic-progress-fill"
                :style="{ width: tinymistStore.downloadProgress + '%' }"
              ></div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="env-lang-header">
            <span class="env-lang-dot none"></span>
            <span class="env-lang-name">Tinymist</span>
            <span class="env-lang-missing">{{ t('Not installed') }}</span>
          </div>
          <div class="env-action-row">
            <UiButton
              class="env-action-btn"
              variant="primary"
              size="sm"
              @click="tinymistStore.downloadTinymist()"
            >
              {{ t('Download Tinymist') }}
            </UiButton>
          </div>
        </template>

        <div v-if="tinymistStore.downloadError" class="env-install-error env-install-error-inline">
          {{ tinymistStore.downloadError }}
          <UiButton
            class="env-action-btn env-install-btn-inline"
            variant="secondary"
            size="sm"
            @click="tinymistStore.downloadTinymist()"
          >
            {{ t('Retry') }}
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import {
  LATEX_BUILD_RECIPE_OPTIONS,
  formatLatexBuildRecipeLabel,
  useLatexStore,
} from '../../stores/latex'
import { useTinymistStore } from '../../stores/tinymist'
import { useTypstStore } from '../../stores/typst'
import { useI18n } from '../../i18n'
import UiButton from '../shared/ui/UiButton.vue'
import UiSelect from '../shared/ui/UiSelect.vue'

const latexStore = useLatexStore()
const tinymistStore = useTinymistStore()
const typstStore = useTypstStore()
const { t } = useI18n()
const gitInstalled = ref(false)
const gitPath = ref('')
const gitChecking = ref(false)
const toolingChecked = ref(false)

const latexPreferenceLabel = computed(() => {
  if (latexStore.compilerPreference === 'system') return t('System TeX (latexmk)')
  if (latexStore.compilerPreference === 'tectonic') return 'Tectonic'
  return t('Auto (prefer System TeX)')
})

const latexHeaderDotClass = computed(() => {
  if (latexStore.compilerPreference === 'system')
    return latexStore.systemTexInstalled ? 'good' : 'none'
  if (latexStore.compilerPreference === 'tectonic')
    return latexStore.tectonicInstalled ? 'good' : 'none'
  return latexStore.systemTexInstalled || latexStore.tectonicInstalled ? 'good' : 'warn'
})

const latexEngineLabel = computed(() => {
  if (latexStore.enginePreference === 'xelatex') return 'XeLaTeX'
  if (latexStore.enginePreference === 'pdflatex') return 'pdfLaTeX'
  if (latexStore.enginePreference === 'lualatex') return 'LuaLaTeX'
  return t('Auto')
})

const latexEngineDotClass = computed(() => {
  if (latexStore.compilerPreference === 'tectonic') return 'warn'
  if (latexStore.compilerPreference === 'system')
    return latexStore.systemTexInstalled ? 'good' : 'none'
  return latexStore.systemTexInstalled ? 'good' : 'warn'
})

const latexBuildRecipeDotClass = computed(() => {
  if (latexStore.compilerPreference === 'tectonic') return 'warn'
  if (latexStore.compilerPreference === 'system')
    return latexStore.systemTexInstalled ? 'good' : 'none'
  return latexStore.systemTexInstalled ? 'good' : 'warn'
})

const latexBuildRecipeOptions = computed(() =>
  LATEX_BUILD_RECIPE_OPTIONS.map((value) => ({
    value,
    label: formatLatexBuildRecipeLabel(value, t),
  }))
)

const compilerPreference = computed({
  get: () => latexStore.compilerPreference,
  set: (value) => latexStore.setCompilerPreference(value),
})

const enginePreference = computed({
  get: () => latexStore.enginePreference,
  set: (value) => latexStore.setEnginePreference(value),
})

const buildRecipe = computed({
  get: () => latexStore.buildRecipe,
  set: (value) => latexStore.setBuildRecipe(value),
})

async function detectGit() {
  if (gitChecking.value) return
  gitChecking.value = true
  try {
    const resolved = await invoke('resolve_command_path', { command: 'git' }).catch(() => '')
    gitPath.value = String(resolved || '').trim()
    gitInstalled.value = !!gitPath.value
    toolingChecked.value = true
  } finally {
    gitChecking.value = false
  }
}

async function redetectSystem() {
  await Promise.all([
    detectGit(),
    latexStore.checkCompilers(true),
    latexStore.checkTools(true),
    typstStore.checkCompiler(true),
    tinymistStore.checkBinary(true),
  ])
}

function scheduleAfterFirstPaint(task) {
  const run = () => {
    Promise.resolve(task()).catch(() => {})
  }

  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 600 })
      } else {
        window.setTimeout(run, 80)
      }
    })
    return
  }

  run()
}

function warmSystemChecks() {
  scheduleAfterFirstPaint(() =>
    Promise.all([
      detectGit(),
      latexStore.checkCompilers(),
      latexStore.checkTools(),
      typstStore.checkCompiler(),
      tinymistStore.checkBinary(),
    ])
  )
}

onMounted(() => {
  warmSystemChecks()
})
</script>

<style scoped>
.env-languages {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.env-section-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.env-card-span-full {
  grid-column: 1 / -1;
}

.env-lang-card {
  padding: 8px 10px;
}

.env-lang-header {
  min-height: 24px;
}

.env-lang-name {
  font-size: var(--ui-font-label);
}

.env-lang-version,
.env-lang-missing {
  font-size: var(--ui-font-micro);
}

.env-lang-details {
  margin-top: 4px;
  padding-left: 22px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.env-lang-path {
  font-size: var(--ui-font-micro);
  color: var(--fg-muted);
  font-family: var(--font-mono);
  margin-bottom: 0;
  line-height: 1.45;
}

.env-lang-kernel-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--ui-font-micro);
  color: var(--fg-secondary);
  flex-wrap: wrap;
}

.env-python-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 0;
}

.env-compact-block {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.env-compact-block-offset {
  margin-top: 8px;
  padding-left: 22px;
}

.env-inline-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.env-inline-row-top {
  justify-content: space-between;
}

.env-select-shell {
  min-width: min(320px, 100%);
  flex: 1;
  font-size: var(--ui-font-caption);
}

.env-select-shell-full {
  width: 100%;
  min-width: 0;
}

.env-kernel-badge {
  font-size: var(--ui-font-micro);
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 500;
}

.env-kernel-yes {
  background: rgba(80, 250, 123, 0.1);
  color: var(--success, #50fa7b);
}

.env-kernel-no {
  background: rgba(226, 185, 61, 0.1);
  color: var(--warning, #e2b93d);
}

.env-lang-kernel-row-soft {
  padding-top: 2px;
}

.env-action-btn {
  flex-shrink: 0;
}

.env-install-error {
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--error) 12%, transparent);
  color: var(--error);
  font-size: var(--ui-font-micro);
}

.env-install-error-inline {
  margin: 8px 0 0 22px;
}

.env-install-btn-inline {
  margin-left: 8px;
}

.env-actions {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.env-hint-text {
  font-size: var(--ui-font-micro);
  color: var(--fg-muted);
}

.env-section-offset {
  margin-top: 20px;
}

.env-hint-inline {
  margin-top: 3px;
  padding-left: 22px;
  line-height: 1.45;
}

.env-progress-shell {
  margin: 8px 0 2px 22px;
}

.env-action-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 22px;
  margin-top: 8px;
}

.env-action-row-between {
  justify-content: space-between;
}

.env-action-row-stack {
  align-items: stretch;
}

.tectonic-progress-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--surface-muted);
  overflow: hidden;
}

.tectonic-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s ease;
}

/* Stronger compact overrides so shared settings styles do not visually win. */
.env-page-compact .settings-section-title {
  margin-bottom: 12px;
}

.env-page-compact .settings-hint {
  margin: -6px 0 12px;
}

.env-page-compact .env-languages,
.env-page-compact .env-section-grid {
  gap: 6px;
}

.env-page-compact .env-lang-card {
  padding: 6px 8px;
  border-radius: 6px;
}

.env-page-compact .env-lang-header {
  gap: 6px;
  min-height: 20px;
}

.env-page-compact .env-lang-name {
  font-size: var(--ui-font-caption);
  font-weight: 600;
}

.env-page-compact .env-lang-version,
.env-page-compact .env-lang-missing {
  font-size: var(--ui-font-micro);
}

.env-page-compact .env-lang-details,
.env-page-compact .env-hint-inline,
.env-page-compact .env-action-row,
.env-page-compact .env-compact-block-offset {
  padding-left: 14px;
}

.env-page-compact .env-lang-details {
  margin-top: 3px;
  gap: 4px;
}

.env-page-compact .env-lang-hint {
  margin-top: 3px;
  line-height: 1.35;
}

.env-page-compact .env-lang-path {
  line-height: 1.35;
}

.env-page-compact .env-python-stack {
  gap: 4px;
}

.env-page-compact .env-lang-kernel-row {
  gap: 6px;
}

.env-page-compact .env-select-shell {
  min-height: 28px;
  font-size: var(--ui-font-micro);
}

.env-page-compact .env-actions {
  margin-top: 12px;
}

.env-page-compact .env-section-offset {
  margin-top: 16px;
}

.env-page-compact .env-progress-shell {
  margin: 6px 0 2px 14px;
}

.env-page-compact .env-install-error-inline {
  margin: 6px 0 0 14px;
}

@media (max-width: 620px) {
  .env-languages,
  .env-section-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .env-inline-row-top {
    align-items: stretch;
  }

  .env-select-shell {
    min-width: 100%;
  }

  .env-action-row .env-action-btn {
    width: 100%;
  }
}
</style>
