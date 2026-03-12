<template>
  <div>
    <h3 class="settings-section-title">Updates</h3>

    <div class="update-card">
      <!-- Identity row -->
      <div class="update-identity-row">
        <span class="env-lang-dot" :class="dotClass"></span>
        <span class="update-app-name">Shoulders</span>
        <div style="flex: 1;"></div>
        <span class="update-version-tag">v{{ appVersion }}</span>
      </div>

      <!-- Action slot — fixed height, content morphs between states -->
      <div class="update-action-slot">
        <Transition name="update-fade" mode="out-in">
          <div :key="state" class="update-action-inner">

            <template v-if="state === 'idle' || state === 'uptodate' || state === 'error'">
              <div class="update-action-row">
                <template v-if="state === 'error'">
                  <span class="update-inline-msg update-inline-error">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                    {{ errorMsg }}
                  </span>
                  <button class="update-btn update-btn-secondary update-retry-link" @click="doCheck">Try again</button>
                </template>
                <template v-else-if="state === 'uptodate'">
                  <button class="update-btn update-btn-secondary" @click="doCheck">Check again</button>
                  <span class="update-inline-msg update-inline-good">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    Up to date
                  </span>
                </template>
                <template v-else>
                  <button class="update-btn update-btn-secondary" @click="doCheck">Check for updates</button>
                </template>
              </div>
            </template>

            <template v-else-if="state === 'checking'">
              <div class="update-action-row">
                <span class="update-checking">
                  <span class="update-spinner"></span>
                  Checking...
                </span>
              </div>
            </template>

            <template v-else-if="state === 'available'">
              <div class="update-action-row">
                <button class="update-btn update-btn-primary" @click="doDownload">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M8 2v8M4.5 7l3.5 3.5L11.5 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  Download v{{ updateVersion }}
                </button>
              </div>
            </template>

            <template v-else-if="state === 'downloading'">
              <div class="update-progress-row">
                <div class="update-progress-track">
                  <div class="update-progress-fill" :style="{ width: downloadPct + '%' }"></div>
                </div>
                <span class="update-progress-pct">{{ downloadPct }}%</span>
              </div>
            </template>

            <template v-else-if="state === 'ready'">
              <div class="update-action-row">
                <button class="update-btn update-btn-primary" @click="doRestart">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M3 8a5 5 0 1 0 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5.5 3H3V.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  Restart to install
                </button>
                <span class="update-inline-msg update-inline-good" style="margin-left: 10px;">v{{ updateVersion }} ready</span>
              </div>
            </template>

          </div>
        </Transition>
      </div>
    </div>

    <!-- Preferences -->
    <h3 class="settings-section-title" style="margin-top: 28px;">Preferences</h3>

    <div class="env-lang-card">
      <div class="env-lang-header">
        <span class="env-lang-name">Check for updates on launch</span>
        <div style="flex: 1;"></div>
        <button
          class="tool-toggle-switch"
          :class="{ on: autoCheck }"
          @click="toggleAutoCheck"
        >
          <span class="tool-toggle-knob"></span>
        </button>
      </div>
      <div class="env-lang-hint" style="margin-top: 4px; padding-left: 0;">
        Shoulders silently checks for updates each time you open the app.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  checkForUpdate,
  downloadUpdate,
  installAndRestart,
  getAppVersion,
  isAutoCheckEnabled,
  setAutoCheckEnabled,
} from '../../services/appUpdater'

const appVersion = ref('...')
const autoCheck = ref(isAutoCheckEnabled())
const state = ref('idle') // idle | checking | available | downloading | ready | uptodate | error
const updateVersion = ref('')
const downloadPct = ref(0)
const errorMsg = ref('')
let _pendingUpdate = null

const dotClass = computed(() => {
  if (state.value === 'available') return 'warn'
  if (state.value === 'ready') return 'good'
  if (state.value === 'error') return 'none'
  return 'good'
})

function toggleAutoCheck() {
  autoCheck.value = !autoCheck.value
  setAutoCheckEnabled(autoCheck.value)
}

async function doCheck() {
  state.value = 'checking'
  errorMsg.value = ''
  const update = await checkForUpdate()
  if (update?.available) {
    _pendingUpdate = update
    updateVersion.value = update.version
    state.value = 'available'
  } else {
    state.value = 'uptodate'
  }
}

async function doDownload() {
  if (!_pendingUpdate) return
  state.value = 'downloading'
  downloadPct.value = 0
  const ok = await downloadUpdate(_pendingUpdate, (pct) => {
    downloadPct.value = pct
  })
  if (ok) {
    state.value = 'ready'
  } else {
    state.value = 'error'
    errorMsg.value = 'Download failed. Check your connection.'
  }
}

async function doRestart() {
  await installAndRestart()
}

onMounted(async () => {
  appVersion.value = await getAppVersion()
})
</script>

<style scoped>
/* Card */
.update-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  padding: 10px 12px 12px;
}

/* Identity row */
.update-identity-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.update-app-name {
  font-size: 13px;
  color: var(--fg-secondary);
}

.update-version-tag {
  font-size: 11px;
  color: var(--fg-muted);
  font-family: var(--font-mono);
}

/* Action slot — fixed min-height to prevent layout shift */
.update-action-slot {
  margin-top: 8px;
  padding-left: 14px;
  min-height: 26px;
  display: flex;
  align-items: center;
}

.update-action-inner {
  width: 100%;
}

/* Rows within action slot */
.update-action-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Buttons */
.update-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 11px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  font-family: var(--font-sans);
}

.update-btn-secondary {
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-secondary);
}

.update-btn-secondary:hover {
  border-color: var(--fg-muted);
  color: var(--fg-primary);
}

.update-btn-primary {
  border: 1px solid var(--accent);
  background: rgba(122, 162, 247, 0.1);
  color: var(--accent);
}

.update-btn-primary:hover {
  background: rgba(122, 162, 247, 0.2);
}

/* Checking state */
.update-checking {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: var(--fg-muted);
}

.update-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--bg-hover);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: update-spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes update-spin {
  to { transform: rotate(360deg); }
}

/* Inline status messages */
.update-inline-msg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
}

.update-inline-good {
  color: var(--success);
}

.update-inline-error {
  color: var(--error);
}

.update-retry-link {
  padding: 2px 7px;
  font-size: 10px;
}

/* Progress */
.update-progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.update-progress-track {
  flex: 1;
  height: 3px;
  border-radius: 1.5px;
  background: var(--bg-hover);
  overflow: hidden;
}

.update-progress-fill {
  height: 100%;
  border-radius: 1.5px;
  background: var(--accent);
  transition: width 0.3s ease;
}

.update-progress-pct {
  font-size: 10px;
  color: var(--fg-muted);
  font-family: var(--font-mono);
  min-width: 28px;
  text-align: right;
}

/* Transition */
.update-fade-enter-active,
.update-fade-leave-active {
  transition: opacity 0.1s ease;
}

.update-fade-enter-from,
.update-fade-leave-to {
  opacity: 0;
}
</style>
