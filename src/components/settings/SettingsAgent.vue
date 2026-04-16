<template>
  <div class="settings-page settings-agent-page">
    <section class="settings-group">
      <div class="ui-segmented-control" role="tablist" :aria-label="t('Agent pages')">
        <UiButton
          v-for="item in subpages"
          :key="item.id"
          variant="ghost"
          size="sm"
          class="ui-segmented-item"
          :class="{ 'is-active': activeSubpage === item.id }"
          :aria-selected="activeSubpage === item.id"
          @click="setActiveSubpage(item.id)"
        >
          {{ item.label }}
        </UiButton>
      </div>
    </section>

    <component :is="activeComponent" />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { useI18n } from '../../i18n'
import UiButton from '../shared/ui/UiButton.vue'

const SettingsAi = defineAsyncComponent(() => import('./SettingsAi.vue'))
const SettingsSkills = defineAsyncComponent(() => import('./SettingsSkills.vue'))

const AGENT_SETTINGS_SUBPAGE_STORAGE_KEY = 'altals.settings.agentSubpage'

const { t } = useI18n()

function readPersistedAgentSubpage() {
  try {
    const value = String(localStorage.getItem(AGENT_SETTINGS_SUBPAGE_STORAGE_KEY) || '').trim()
    return value === 'skills' ? 'skills' : 'runtime'
  } catch {
    return 'runtime'
  }
}

function persistAgentSubpage(value = 'runtime') {
  try {
    localStorage.setItem(
      AGENT_SETTINGS_SUBPAGE_STORAGE_KEY,
      String(value || '').trim() === 'skills' ? 'skills' : 'runtime'
    )
  } catch {
    // ignore local storage failures
  }
}

const activeSubpage = ref(readPersistedAgentSubpage())

const subpages = computed(() => [
  {
    id: 'runtime',
    label: t('Runtime'),
  },
  {
    id: 'skills',
    label: t('Agent Skills'),
  },
])

const activeComponent = computed(() =>
  activeSubpage.value === 'skills' ? SettingsSkills : SettingsAi
)

function setActiveSubpage(subpageId = 'runtime') {
  activeSubpage.value = String(subpageId || '').trim() === 'skills' ? 'skills' : 'runtime'
  persistAgentSubpage(activeSubpage.value)
}
</script>

<style scoped>
.settings-agent-page {
  gap: 24px;
}
</style>
