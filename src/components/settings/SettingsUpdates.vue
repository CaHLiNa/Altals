<template>
  <div>
    <h3 class="settings-section-title">{{ t('Updates') }}</h3>

    <div class="update-card">
      <div class="update-identity-row">
        <span class="env-lang-dot good"></span>
        <span class="update-app-name">Altals</span>
        <div style="flex: 1;"></div>
        <span class="update-version-tag">v{{ appVersion }}</span>
      </div>

      <p class="update-copy">
        {{ t('Automatic updates are disabled in this local build. Use the GitHub releases page when you want to download a newer version.') }}
      </p>

      <div class="update-actions">
        <button class="update-btn update-btn-primary" @click="openReleases">
          {{ t('Open Releases') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAppVersion, openReleasesPage } from '../../services/appUpdater'
import { useI18n } from '../../i18n'

const appVersion = ref('...')
const { t } = useI18n()

async function openReleases() {
  await openReleasesPage()
}

onMounted(async () => {
  appVersion.value = await getAppVersion()
})
</script>

<style scoped>
.update-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  padding: 12px;
}

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

.update-copy {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--fg-secondary);
}

.update-actions {
  margin-top: 12px;
  padding-left: 14px;
}

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

.update-btn-primary {
  border: 1px solid var(--accent);
  background: rgba(122, 162, 247, 0.1);
  color: var(--accent);
}

.update-btn-primary:hover {
  background: rgba(122, 162, 247, 0.2);
}
</style>
