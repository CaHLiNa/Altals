<template>
  <section class="reference-workbench" data-surface-context-guard="true">
    <header class="reference-workbench__toolbar">
      <div class="reference-workbench__toolbar-spacer" />
      <div class="reference-workbench__toolbar-group reference-workbench__toolbar-group--actions">
        <UiButton
          variant="secondary"
          size="sm"
          :loading="referencesStore.importInFlight"
          :disabled="referencesStore.isLoading"
          @click="handleImportBibTeX"
        >
          {{ t('Import BibTeX') }}
        </UiButton>
      </div>
    </header>

    <div v-if="referencesStore.isLoading" class="reference-workbench__empty ui-empty-copy">
      {{ t('Loading references...') }}
    </div>

    <div v-else-if="referencesStore.loadError" class="reference-workbench__empty ui-empty-copy">
      {{ referencesStore.loadError }}
    </div>

    <div v-else-if="filteredReferences.length === 0" class="reference-workbench__empty ui-empty-copy">
      {{ t('No references in this section yet.') }}
    </div>

    <div v-else class="reference-workbench__content">
      <div class="reference-workbench__table-head">
        <button
          type="button"
          class="reference-workbench__head-button"
          :class="{ 'is-active': isSortActive('title') }"
          @click="toggleTitleSort"
        >
          <span>{{ t('Title') }}</span>
          <span v-if="isSortActive('title')" class="reference-workbench__sort-chip reference-workbench__sort-chip--icon" aria-hidden="true">
            <svg
              :class="{ 'is-desc': sortKey === 'title-desc' }"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M2 6l3-3 3 3" />
            </svg>
          </span>
        </button>
        <button
          type="button"
          class="reference-workbench__head-button"
          :class="{ 'is-active': isSortActive('author') }"
          @click="toggleAuthorSort"
        >
          <span>{{ t('Authors') }}</span>
          <span v-if="isSortActive('author')" class="reference-workbench__sort-chip reference-workbench__sort-chip--icon" aria-hidden="true">
            <svg
              :class="{ 'is-desc': sortKey === 'author-desc' }"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M2 6l3-3 3 3" />
            </svg>
          </span>
        </button>
        <button
          type="button"
          class="reference-workbench__head-button"
          :class="{ 'is-active': isSortActive('year') }"
          @click="toggleYearSort"
        >
          <span>{{ t('Year') }}</span>
          <span v-if="isSortActive('year')" class="reference-workbench__sort-chip reference-workbench__sort-chip--icon" aria-hidden="true">
            <svg
              :class="{ 'is-desc': sortKey === 'year-desc' }"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M2 6l3-3 3 3" />
            </svg>
          </span>
        </button>
        <div>{{ t('Source') }}</div>
      </div>

      <div
        v-for="reference in filteredReferences"
        :key="reference.id"
        class="reference-workbench__row ui-list-row"
        :class="{ 'is-active': reference.id === selectedReference?.id }"
        @click="referencesStore.selectReference(reference.id)"
        @contextmenu.prevent="openReferenceContextMenu($event, reference)"
      >
        <div class="reference-workbench__cell reference-workbench__cell--title">
          <span class="reference-workbench__title-icon" aria-hidden="true">
            <IconFileText :size="15" :stroke-width="1.85" />
          </span>
          <span class="reference-workbench__truncate">{{ reference.title }}</span>
        </div>
        <div class="reference-workbench__cell">
          <span class="reference-workbench__truncate">{{ getReferenceAuthorLabel(reference) }}</span>
        </div>
        <div class="reference-workbench__cell">
          {{ reference.year || '—' }}
        </div>
        <div class="reference-workbench__cell">
          <span class="reference-workbench__truncate">{{ reference.source || '—' }}</span>
        </div>
      </div>
    </div>

    <SurfaceContextMenu
      :visible="menuVisible"
      :x="menuX"
      :y="menuY"
      :groups="menuGroups"
      @close="closeSurfaceContextMenu"
      @select="handleSurfaceContextMenuSelect"
    />
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { IconFileText } from '@tabler/icons-vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useToastStore } from '../../stores/toast'
import { useUxStatusStore } from '../../stores/uxStatus'
import { useI18n } from '../../i18n'
import { useReferencesStore } from '../../stores/references'
import { useSurfaceContextMenu } from '../../composables/useSurfaceContextMenu.js'
import { readWorkspaceTextFile } from '../../services/fileStoreIO'
import {
  mergeImportedReferences,
  parseBibTeXText,
} from '../../services/references/bibtexImport.js'
import { writeReferenceLibrarySnapshot } from '../../services/references/referenceLibraryIO.js'
import SurfaceContextMenu from '../shared/SurfaceContextMenu.vue'
import UiButton from '../shared/ui/UiButton.vue'

const { t } = useI18n()
const referencesStore = useReferencesStore()
const workspace = useWorkspaceStore()
const toastStore = useToastStore()
const uxStatusStore = useUxStatusStore()
const {
  menuVisible,
  menuX,
  menuY,
  menuGroups,
  closeSurfaceContextMenu,
  openSurfaceContextMenu,
  handleSurfaceContextMenuSelect,
} = useSurfaceContextMenu()

const filteredReferences = computed(() => referencesStore.filteredReferences)
const selectedReference = computed(() => referencesStore.selectedReference)
const sortKey = computed({
  get: () => referencesStore.sortKey,
  set: (value) => referencesStore.setSortKey(value),
})
const availableCollections = computed(() => referencesStore.collections)

function getReferenceAuthorLabel(reference) {
  const authors = Array.isArray(reference?.authors) ? reference.authors : []
  if (!authors.length) return '—'
  if (authors.length === 1) return authors[0]
  return `${authors[0]} et al.`
}

function isSortActive(group) {
  return sortKey.value.startsWith(`${group}-`)
}

function toggleTitleSort() {
  referencesStore.setSortKey(sortKey.value === 'title-asc' ? 'title-desc' : 'title-asc')
}

function toggleAuthorSort() {
  referencesStore.setSortKey(sortKey.value === 'author-asc' ? 'author-desc' : 'author-asc')
}

function toggleYearSort() {
  referencesStore.setSortKey(sortKey.value === 'year-desc' ? 'year-asc' : 'year-desc')
}

function referenceIsInCollection(reference = {}, collectionKey = '') {
  const collection = availableCollections.value.find((item) => item.key === collectionKey)
  if (!collection) return false

  const memberships = Array.isArray(reference.collections) ? reference.collections : []
  const normalizedKey = String(collection.key || '').trim().toLowerCase()
  const normalizedLabel = String(collection.label || '').trim().toLowerCase()
  return memberships.some((value) => {
    const normalizedValue = String(value || '').trim().toLowerCase()
    return normalizedValue === normalizedKey || normalizedValue === normalizedLabel
  })
}

function openReferenceContextMenu(event, reference) {
  referencesStore.selectReference(reference.id)

  const groups = [
    {
      key: 'collections',
      label: t('Collections'),
      items: availableCollections.value.length
        ? availableCollections.value.map((collection) => ({
            key: `collection:${collection.key}`,
            label: collection.label,
            checked: referenceIsInCollection(reference, collection.key),
            action: () =>
              referencesStore.toggleReferenceCollection(
                workspace.workspaceDataDir,
                reference.id,
                collection.key
              ),
          }))
        : [
            {
              key: 'collections-empty',
              label: t('No collections yet'),
              disabled: true,
            },
          ],
    },
  ]

  openSurfaceContextMenu({
    x: event.clientX,
    y: event.clientY,
    groups,
  })
}

async function handleImportBibTeX() {
  const selected = await open({
    multiple: false,
    title: t('Import BibTeX'),
    filters: [{ name: 'BibTeX', extensions: ['bib'] }],
  })

  if (!selected || Array.isArray(selected)) return

  const statusId = uxStatusStore.show(t('Importing BibTeX...'), {
    type: 'info',
    duration: 0,
  })

  try {
    const content = await readWorkspaceTextFile(String(selected))
    const importedCount =
      typeof referencesStore.importBibTeXContent === 'function'
        ? await referencesStore.importBibTeXContent(workspace.workspaceDataDir, content)
        : await importBibTeXWithFallback(content)

    uxStatusStore.success(
      importedCount > 0
        ? t('Imported {count} references', { count: importedCount })
        : t('No new references were added'),
      { duration: 2200 }
    )
  } catch (error) {
    const message = error?.message || String(error || 'Failed to import BibTeX')
    uxStatusStore.error(t('Failed to import BibTeX'), { duration: 3200 })
    toastStore.show(message, { type: 'error', duration: 5000 })
  } finally {
    uxStatusStore.clear(statusId)
  }
}

async function importBibTeXWithFallback(content = '') {
  const importedReferences = parseBibTeXText(content)
  const mergedReferences = mergeImportedReferences(referencesStore.references, importedReferences)
  const importedCount = Math.max(0, mergedReferences.length - referencesStore.references.length)

  const snapshot = {
    version: 1,
    collections: referencesStore.collections,
    tags: referencesStore.tags,
    references: mergedReferences,
  }

  await writeReferenceLibrarySnapshot(workspace.workspaceDataDir, snapshot)

  if (typeof referencesStore.applyLibrarySnapshot === 'function') {
    referencesStore.applyLibrarySnapshot(snapshot)
  } else {
    referencesStore.references = snapshot.references
    referencesStore.collections = snapshot.collections
    referencesStore.tags = snapshot.tags
  }

  const importedSelection = mergedReferences.find((reference) =>
    importedReferences.some((candidate) => candidate.id === reference.id)
  )
  if (importedSelection) {
    referencesStore.selectedReferenceId = importedSelection.id
  }

  return importedCount
}
</script>

<style scoped>
.reference-workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: transparent;
}

.reference-workbench__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 31px;
  padding: 0 12px;
  border-bottom: 1px solid var(--workbench-divider-soft);
}

.reference-workbench__toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.reference-workbench__toolbar-group--actions {
  flex: 0 0 auto;
}

.reference-workbench__toolbar-spacer {
  flex: 1 1 auto;
  min-width: 0;
}

.reference-workbench__content {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  padding: 6px 0 20px;
}

.reference-workbench__table-head,
.reference-workbench__row {
  display: grid;
  grid-template-columns: minmax(280px, 3fr) minmax(140px, 1.35fr) 92px minmax(160px, 1.4fr);
  align-items: center;
  gap: 14px;
}

.reference-workbench__table-head {
  padding: 0 12px 8px;
  border-bottom: 1px solid var(--workbench-divider-soft);
  color: color-mix(in srgb, var(--text-secondary) 84%, transparent);
  font-size: var(--workbench-font-secondary);
  font-weight: var(--workbench-weight-medium);
  letter-spacing: 0.01em;
  line-height: var(--workbench-line-height-secondary);
}

.reference-workbench__head-button {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.reference-workbench__head-button.is-active {
  color: var(--text-primary);
}

.reference-workbench__sort-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 20px;
  padding: 0 6px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--surface-hover) 22%, transparent);
  color: color-mix(in srgb, var(--text-secondary) 88%, transparent);
  font-size: 10.5px;
  font-weight: var(--workbench-weight-medium);
  line-height: 1;
}

.reference-workbench__sort-chip--icon {
  padding: 0 4px;
}

.reference-workbench__sort-chip--icon svg.is-desc {
  transform: rotate(180deg);
}

.reference-workbench__row {
  min-height: 40px;
  padding: 0 12px;
  border-radius: 8px;
  cursor: pointer;
}

.reference-workbench__cell {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  color: color-mix(in srgb, var(--text-secondary) 90%, transparent);
  font-size: var(--workbench-font-primary);
  font-weight: var(--workbench-weight-regular);
  line-height: var(--workbench-line-height-primary);
}

.reference-workbench__cell--title {
  gap: 9px;
  color: var(--text-primary);
  font-size: var(--workbench-font-primary);
  font-weight: var(--workbench-weight-medium);
}

.reference-workbench__title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  color: color-mix(in srgb, var(--text-secondary) 86%, transparent);
}

.reference-workbench__truncate {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reference-workbench__empty {
  padding: 16px 12px;
}

@media (max-width: 1200px) {
  .reference-workbench__table-head,
  .reference-workbench__row {
    grid-template-columns: minmax(220px, 2.5fr) minmax(120px, 1.2fr) 84px minmax(120px, 1.2fr);
    gap: 12px;
  }
}

@media (max-width: 920px) {
  .reference-workbench__toolbar {
    flex-wrap: wrap;
    padding-top: 6px;
    padding-bottom: 6px;
  }

  .reference-workbench__toolbar-group--actions {
    width: 100%;
  }
}
</style>
