<template>
  <div class="updates-page settings-page">
    <h3 class="settings-section-title">{{ t('Updates') }}</h3>

    <section class="settings-group">
      <h4 class="settings-group-title">{{ t('Application') }}</h4>
      <div class="settings-group-body">
        <div class="settings-row">
          <div class="settings-row-copy">
            <div class="settings-row-title">Altals</div>
            <div class="settings-row-hint">
              {{
                t(
                  'Automatic updates are disabled in this local build. Use the releases page when you want to download a newer version.'
                )
              }}
            </div>
          </div>
          <div class="settings-row-control">
            <div class="update-version-stack">
              <span class="update-version-tag">v{{ appVersion }}</span>
              <UiButton variant="secondary" size="sm" @click="openReleases">
                {{ t('Open Releases') }}
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAppVersion, openReleasesPage } from '../../services/appUpdater'
import { useI18n } from '../../i18n'
import UiButton from '../shared/ui/UiButton.vue'

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
.update-version-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.update-version-tag {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
</style>
