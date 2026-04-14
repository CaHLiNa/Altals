<template>
  <section class="references-sidebar-panel" :aria-label="t('Reference Library')">
    <div class="references-sidebar-panel__search-row">
      <UiInput
        v-model="searchQuery"
        size="sm"
        shell-class="references-sidebar-panel__search-input"
        :placeholder="t('Search references')"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
      >
        <template #prefix>
          <IconSearch :size="14" :stroke-width="1.6" />
        </template>
      </UiInput>
    </div>

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
      <div class="references-sidebar-panel__section-header">
        <div class="references-sidebar-panel__section-title">{{ t('Collections') }}</div>
        <UiButton
          class="references-sidebar-panel__section-action"
          variant="ghost"
          size="icon-sm"
          icon-only
          :title="t('New collection')"
          :aria-label="t('New collection')"
          @click="startCreatingCollection"
        >
          <IconPlus :size="15" :stroke-width="1.9" />
        </UiButton>
      </div>
      <div v-if="isCreatingCollection" class="references-sidebar-panel__create-row">
        <UiInput
          ref="collectionInputEl"
          v-model="draftCollectionLabel"
          size="sm"
          shell-class="references-sidebar-panel__create-input"
          :placeholder="t('Collection name')"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          @keydown.enter.prevent="submitCollection"
          @keydown.escape.prevent="cancelCollection"
          @blur="submitCollection"
        />
      </div>
      <button
        v-for="collection in referencesStore.collections"
        :key="collection.key"
        type="button"
        class="references-sidebar-panel__row ui-list-row"
        :class="{ 'is-active': collection.key === referencesStore.selectedCollectionKey }"
        @click="referencesStore.setSelectedCollection(collection.key)"
      >
        <span class="references-sidebar-panel__row-main">
          <IconFolder :size="17" :stroke-width="1.9" />
          <span>{{ collection.label }}</span>
        </span>
        <span class="references-sidebar-panel__count">
          {{ referencesStore.collectionCounts[collection.key] || 0 }}
        </span>
      </button>
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
import { computed, nextTick, ref } from 'vue'
import {
  IconBook2,
  IconCircleDashedCheck,
  IconFolder,
  IconInbox,
  IconPaperclip,
  IconPlus,
  IconSearch,
} from '@tabler/icons-vue'
import { useI18n } from '../../i18n'
import { getReferenceSectionLabelKey } from '../../domains/references/referencePresentation.js'
import { useReferencesStore } from '../../stores/references'
import { useWorkspaceStore } from '../../stores/workspace'
import UiButton from '../shared/ui/UiButton.vue'
import UiInput from '../shared/ui/UiInput.vue'

const { t } = useI18n()
const referencesStore = useReferencesStore()
const workspace = useWorkspaceStore()
const collectionInputEl = ref(null)
const isCreatingCollection = ref(false)
const draftCollectionLabel = ref('')

const searchQuery = computed({
  get: () => referencesStore.searchQuery,
  set: (value) => referencesStore.setSearchQuery(value),
})

function iconForSection(sectionKey) {
  if (sectionKey === 'unfiled') return IconInbox
  if (sectionKey === 'missing-identifier') return IconCircleDashedCheck
  if (sectionKey === 'missing-pdf') return IconPaperclip
  return IconBook2
}

async function startCreatingCollection() {
  if (isCreatingCollection.value) return
  isCreatingCollection.value = true
  draftCollectionLabel.value = ''
  await nextTick()
  collectionInputEl.value?.focus?.()
}

async function submitCollection() {
  const label = draftCollectionLabel.value
  isCreatingCollection.value = false
  draftCollectionLabel.value = ''
  const collection = await referencesStore.createCollection(workspace.workspaceDataDir, label)
  if (collection?.key) {
    referencesStore.setSelectedCollection(collection.key)
  }
}

function cancelCollection() {
  isCreatingCollection.value = false
  draftCollectionLabel.value = ''
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
  min-height: 0;
  overflow: auto;
  padding: 0 0 18px;
  color: var(--text-primary);
}

.references-sidebar-panel__search-row {
  padding: 6px 8px 8px;
}

.references-sidebar-panel__create-input {
  border-color: color-mix(in srgb, var(--sidebar-search-border) 68%, transparent);
  border-radius: 11px;
  background: color-mix(in srgb, var(--sidebar-search-surface) 72%, transparent);
  box-shadow: none;
}

:deep(.references-sidebar-panel__search-input) {
  border-color: color-mix(in srgb, var(--sidebar-search-border) 68%, transparent);
  border-radius: 11px;
  background: color-mix(in srgb, var(--sidebar-search-surface) 72%, transparent);
  min-height: 28px;
  padding-inline: 10px;
  gap: var(--sidebar-inline-gap);
  box-shadow: none;
  opacity: 1;
}

:deep(.references-sidebar-panel__search-input:focus-within) {
  border-color: color-mix(in srgb, var(--sidebar-search-border-focus) 80%, transparent);
  background: color-mix(in srgb, var(--sidebar-search-surface-focus) 78%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-ring) 42%, transparent);
  opacity: 1;
}

:deep(.references-sidebar-panel__search-input .ui-input-control) {
  font-size: var(--sidebar-font-search);
  line-height: 1.1;
}

:deep(.references-sidebar-panel__search-input .ui-input-control::placeholder) {
  color: color-mix(in srgb, var(--text-muted) 78%, transparent);
  opacity: 1;
}

:deep(.references-sidebar-panel__search-input.ui-input-shell--sm) {
  min-height: 28px;
  padding-inline: 10px;
}

:deep(.references-sidebar-panel__search-input .ui-input-affix) {
  height: 14px;
}

.references-sidebar-panel__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.references-sidebar-panel__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.references-sidebar-panel__section + .references-sidebar-panel__section {
  margin-top: 18px;
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

.references-sidebar-panel__section-action {
  color: color-mix(in srgb, var(--text-secondary) 74%, transparent);
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

.references-sidebar-panel__create-row {
  padding: 0 8px;
}
</style>
