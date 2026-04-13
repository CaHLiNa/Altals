<template>
  <section class="references-sidebar-panel" :aria-label="t('Reference Library')">
    <div class="references-sidebar-panel__section">
      <div class="references-sidebar-panel__section-title">{{ t('Library') }}</div>
      <button
        v-for="section in referencesStore.librarySections"
        :key="section.key"
        type="button"
        class="references-sidebar-panel__row ui-list-row"
        :class="{ 'is-active': section.key === referencesStore.selectedSectionKey }"
        @click="referencesStore.setSelectedSection(section.key)"
      >
        <span class="references-sidebar-panel__row-main">
          <component :is="iconForSection(section.key)" :size="17" :stroke-width="1.9" />
          <span>{{ t(getReferenceSectionLabelKey(section.key)) }}</span>
        </span>
        <span class="references-sidebar-panel__count">{{ referencesStore.sectionCounts[section.key] || 0 }}</span>
      </button>
    </div>

    <div class="references-sidebar-panel__section">
      <div class="references-sidebar-panel__section-title">{{ t('Collections') }}</div>
      <div
        v-for="collection in referencesStore.collections"
        :key="collection.key"
        class="references-sidebar-panel__secondary"
      >
        {{ collection.label }}
      </div>
    </div>

    <div class="references-sidebar-panel__section">
      <div class="references-sidebar-panel__section-title">{{ t('Tags') }}</div>
      <div
        v-for="tag in referencesStore.tags"
        :key="tag.key"
        class="references-sidebar-panel__secondary"
      >
        {{ tag.label }}
      </div>
    </div>
  </section>
</template>

<script setup>
import {
  IconBook2,
  IconCircleDashedCheck,
  IconInbox,
  IconPaperclip,
} from '@tabler/icons-vue'
import { useI18n } from '../../i18n'
import { getReferenceSectionLabelKey } from '../../domains/references/referencePresentation.js'
import { useReferencesStore } from '../../stores/references'

const { t } = useI18n()
const referencesStore = useReferencesStore()

function iconForSection(sectionKey) {
  if (sectionKey === 'unfiled') return IconInbox
  if (sectionKey === 'missing-identifier') return IconCircleDashedCheck
  if (sectionKey === 'missing-pdf') return IconPaperclip
  return IconBook2
}

function activateFilter() {}

defineExpose({
  activateFilter,
})
</script>

<style scoped>
.references-sidebar-panel {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  overflow: auto;
  padding: 0 0 18px;
  color: var(--text-primary);
}

.references-sidebar-panel__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.references-sidebar-panel__section-title {
  color: color-mix(in srgb, var(--text-secondary) 78%, transparent);
  padding: 6px 10px 5px;
  font-size: var(--sidebar-font-meta);
  font-weight: var(--workbench-weight-medium);
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
}

.references-sidebar-panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 28px;
  padding: 4px 10px 4px 12px;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--text-secondary) 86%, transparent);
  font-size: var(--sidebar-font-item);
  font-weight: var(--workbench-weight-medium);
  line-height: var(--workbench-line-height-primary);
  text-align: left;
  cursor: pointer;
}

.references-sidebar-panel__row-main {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.references-sidebar-panel__count {
  color: color-mix(in srgb, var(--text-secondary) 68%, transparent);
  font-size: var(--sidebar-font-meta);
  font-weight: var(--workbench-weight-medium);
  line-height: var(--workbench-line-height-secondary);
}

.references-sidebar-panel__secondary {
  padding: 3px 10px 3px 12px;
  color: color-mix(in srgb, var(--text-secondary) 76%, transparent);
  font-size: var(--sidebar-font-body);
  line-height: 1.5;
}
</style>
