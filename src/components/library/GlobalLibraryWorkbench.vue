<template>
  <div class="library-workbench h-full min-h-0">
    <div class="library-shell h-full min-h-0" :class="{ 'is-editing': isEditing }">
      <aside class="library-sidebar">
        <div class="library-sidebar-header">
          <button type="button" class="library-back-button" @click="returnToWorkspace">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7">
              <path d="M9.5 3.5L5 8l4.5 4.5" />
            </svg>
            <span>{{ t('Back to workspace') }}</span>
          </button>
          <div class="library-sidebar-meta">
            <div class="library-section-label">{{ t('Current workspace') }}</div>
            <div class="library-sidebar-workspace-name">{{ workspaceName }}</div>
          </div>
        </div>

        <section class="library-sidebar-section">
          <div class="library-section-label">{{ t('Views') }}</div>
          <div class="library-nav-list">
            <button
              v-for="view in primaryViewOptions"
              :key="view.id"
              type="button"
              class="library-nav-item"
              :class="{ 'is-active': activeView === view.id }"
              @click="activateView(view.id)"
            >
              <span class="truncate">{{ view.label }}</span>
              <span class="library-nav-count">{{ view.count }}</span>
            </button>
          </div>
        </section>

        <section class="library-sidebar-section">
          <div class="library-section-label">{{ t('Smart views') }}</div>
          <div class="library-nav-list">
            <button
              v-for="view in smartViewOptions"
              :key="view.id"
              type="button"
              class="library-nav-item"
              :class="{ 'is-active': activeView === view.id }"
              @click="activateView(view.id)"
            >
              <span class="truncate">{{ view.label }}</span>
              <span class="library-nav-count">{{ view.count }}</span>
            </button>
          </div>
        </section>

        <section class="library-sidebar-section">
          <div class="library-sidebar-row">
            <div class="library-section-label">{{ t('Collections') }}</div>
            <div class="library-sidebar-actions">
              <button
                v-if="activeCollection"
                type="button"
                class="library-link-button"
                @click="deleteActiveCollection"
              >
                {{ t('Delete') }}
              </button>
              <button
                type="button"
                class="library-link-button"
                @click="toggleCollectionComposer"
              >
                {{ showCollectionComposer ? t('Cancel') : t('New') }}
              </button>
            </div>
          </div>

          <div v-if="showCollectionComposer" class="library-inline-form">
            <input
              v-model="newCollectionName"
              class="library-batch-input"
              :placeholder="t('New collection')"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              @keydown.enter.prevent="createCollection"
            />
            <button type="button" class="library-inline-button" @click="createCollection">
              {{ t('Create') }}
            </button>
          </div>

          <div v-if="collections.length > 0" class="library-nav-list">
            <button
              v-for="collection in collections"
              :key="collection.id"
              type="button"
              class="library-nav-item"
              :class="{ 'is-active': activeView === `collection:${collection.id}` }"
              @click="activateCollection(collection.id)"
            >
              <span class="truncate">{{ collection.name }}</span>
              <span class="library-nav-count">{{ collectionCounts[collection.id] || 0 }}</span>
            </button>
          </div>
          <div v-else class="library-inline-empty">
            {{ t('No collections yet') }}
          </div>
        </section>

        <section class="library-sidebar-section">
          <div class="library-sidebar-row">
            <div class="library-section-label">{{ t('Saved views') }}</div>
            <div class="library-sidebar-actions">
              <button
                v-if="activeSavedView"
                type="button"
                class="library-link-button"
                @click="deleteCurrentSavedView"
              >
                {{ t('Delete') }}
              </button>
              <button
                type="button"
                class="library-link-button"
                @click="toggleSavedViewComposer"
              >
                {{ showSavedViewComposer ? t('Cancel') : t('Save current view') }}
              </button>
            </div>
          </div>

          <div v-if="showSavedViewComposer" class="library-inline-form">
            <input
              v-model="newSavedViewName"
              class="library-batch-input"
              :placeholder="t('New saved view')"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              @keydown.enter.prevent="createSavedView"
            />
            <button type="button" class="library-inline-button" @click="createSavedView">
              {{ t('Create') }}
            </button>
          </div>

          <div v-if="savedViews.length > 0" class="library-nav-list">
            <button
              v-for="savedView in savedViews"
              :key="savedView.id"
              type="button"
              class="library-nav-item"
              :class="{ 'is-active': activeView === `preset:${savedView.id}` }"
              @click="applySavedView(savedView.id)"
            >
              <span class="truncate">{{ savedView.name }}</span>
            </button>
          </div>
          <div v-else class="library-inline-empty">
            {{ t('No saved views yet') }}
          </div>
        </section>

        <section class="library-sidebar-section grow">
          <div class="library-sidebar-row">
            <div class="library-section-label">{{ t('Tags') }}</div>
            <button
              v-if="selectedTags.length > 0"
              type="button"
              class="library-link-button"
              @click="selectedTags = []"
            >
              {{ t('Clear') }}
            </button>
          </div>

          <div v-if="tagFacets.length > 0" class="library-tag-list">
            <button
              v-for="tag in tagFacets"
              :key="tag.tag"
              type="button"
              class="library-tag-row"
              :class="{ 'is-active': selectedTags.includes(tag.tag) }"
              @click="toggleTag(tag.tag)"
            >
              <span class="truncate">{{ tag.tag }}</span>
              <span class="library-nav-count">{{ tag.count }}</span>
            </button>
          </div>
          <div v-else class="library-inline-empty">
            {{ t('No tags in this view') }}
          </div>
        </section>
      </aside>

      <template v-if="isEditing && activeRef">
        <section class="library-editor-stage">
          <div class="library-editor-toolbar">
            <div class="library-editor-meta">
              <div class="library-section-label">{{ t('Edit reference metadata') }}</div>
              <div class="library-editor-title-row">
                <div class="library-editor-title">{{ activeRef.title || `@${activeRef._key}` }}</div>
                <span class="library-state-pill active">@{{ activeRef._key }}</span>
              </div>
            </div>

            <div class="library-editor-actions">
              <button type="button" class="library-inline-button" @click="exitEditMode">
                {{ t('Back to overview') }}
              </button>
            </div>
          </div>

          <div class="library-editor-surface">
            <ReferenceView
              :refKey="activeRef._key"
              :embedded="true"
              :library-embedded="true"
              @close-embedded="handleEmbeddedEditorClose"
            />
          </div>
        </section>
      </template>

      <template v-else>
        <main class="library-main">
          <div class="library-toolbar">
            <div class="library-toolbar-row">
              <div class="library-search-shell">
                <input
                  v-model="searchQuery"
                  class="library-search-input"
                  :placeholder="t('Search title, author, DOI, tags, abstract...')"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                />
              </div>

              <select v-model="sortKey" class="library-select">
                <option value="added-desc">{{ t('Date added (newest)') }}</option>
                <option value="year-desc">{{ t('Year (newest)') }}</option>
                <option value="year-asc">{{ t('Year (oldest)') }}</option>
                <option value="title-asc">{{ t('Title A → Z') }}</option>
                <option value="author-asc">{{ t('Author A → Z') }}</option>
              </select>

              <button type="button" class="library-inline-button is-primary" @click="showImportDialog = true">
                {{ t('Import references') }}
              </button>
            </div>

            <div v-if="selectedTags.length > 0" class="library-filter-row">
              <div class="library-section-label">{{ t('Tags') }}</div>
              <div class="library-filter-chip-row">
                <button
                  v-for="tag in selectedTags"
                  :key="tag"
                  type="button"
                  class="library-filter-chip"
                  @click="toggleTag(tag)"
                >
                  {{ tag }}
                </button>
              </div>
            </div>

            <div v-if="hasBatchSelection" class="library-batch-row">
              <div class="library-batch-head">
                <div class="library-batch-label">
                  {{ t('Selected ({count})', { count: selectedKeys.length }) }}
                </div>
                <button type="button" class="library-link-button" @click="clearSelection">
                  {{ t('Clear') }}
                </button>
              </div>

              <div class="library-batch-actions">
                <button type="button" class="library-inline-button" @click="addSelectionToWorkspace">
                  {{ t('Add to project') }}
                </button>
                <button type="button" class="library-inline-button" @click="removeSelectionFromWorkspace">
                  {{ t('Remove from this project') }}
                </button>
                <input
                  v-model="tagActionInput"
                  class="library-batch-input"
                  :placeholder="t('comma-separated')"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                />
                <select v-model="batchTagAction" class="library-select library-batch-select">
                  <option value="add">{{ t('Add tags') }}</option>
                  <option value="replace">{{ t('Replace tags') }}</option>
                  <option value="remove">{{ t('Remove tags') }}</option>
                </select>
                <button type="button" class="library-inline-button" @click="applyTagAction(batchTagAction)">
                  {{ t('Apply') }}
                </button>
                <template v-if="collections.length > 0">
                  <select v-model="batchCollectionId" class="library-select library-batch-select">
                    <option value="">{{ t('Collection') }}</option>
                    <option v-for="collection in collections" :key="collection.id" :value="collection.id">
                      {{ collection.name }}
                    </option>
                  </select>
                  <button type="button" class="library-inline-button" @click="applyCollectionAction('add')">
                    {{ t('Add to collection') }}
                  </button>
                  <button type="button" class="library-inline-button" @click="applyCollectionAction('remove')">
                    {{ t('Remove from collection') }}
                  </button>
                </template>
                <button
                  v-if="selectedKeys.length >= 2"
                  type="button"
                  class="library-inline-button"
                  @click="clusterSelectedReferences"
                >
                  {{ t('AI cluster') }}
                </button>
              </div>
            </div>
          </div>

          <div class="library-table">
            <div class="library-table-header">
              <div></div>
              <div>{{ t('Reference') }}</div>
              <div>{{ t('Tags') }}</div>
              <div>{{ t('Current project') }}</div>
            </div>

            <div class="library-table-body">
              <template v-if="isLibraryLoading">
                <div class="library-empty-state">
                  <div class="library-empty-title">{{ t('Loading references...') }}</div>
                  <div class="library-empty-copy">{{ t('Global library is loading for the current workspace.') }}</div>
                </div>
              </template>

              <template v-else-if="filteredRefs.length === 0">
                <div class="library-empty-state">
                  <div class="library-empty-title">{{ t('No references found.') }}</div>
                  <div class="library-empty-copy">{{ t('Try another view, clear tag filters, or adjust the search query.') }}</div>
                </div>
              </template>

              <template v-else>
                <div
                  v-for="refItem in filteredRefs"
                  :key="refItem._key"
                  class="library-table-row"
                  :class="{ 'is-focused': activeKey === refItem._key }"
                  @click="focusReference(refItem._key)"
                  @dblclick="enterEditMode(refItem._key)"
                >
                  <label class="library-checkbox-cell" @click.stop>
                    <input
                      :checked="selectedKeySet.has(refItem._key)"
                      type="checkbox"
                      @change="toggleSelection(refItem._key)"
                    />
                  </label>

                  <div class="library-ref-cell">
                    <div class="library-ref-title-row">
                      <span class="library-ref-title">{{ refItem.title || `@${refItem._key}` }}</span>
                      <span v-if="refItem._needsReview" class="library-state-pill warning">{{ t('Needs review') }}</span>
                      <span v-if="refItem._pdfFile" class="library-state-pill">{{ t('PDF') }}</span>
                      <span v-if="readingState(refItem) !== 'unread'" class="library-state-pill">
                        {{ readingState(refItem) === 'reading' ? t('Reading') : t('Reviewed') }}
                      </span>
                      <span v-if="priorityState(refItem) === 'high'" class="library-state-pill warning">
                        {{ t('High priority') }}
                      </span>
                    </div>
                    <div class="library-ref-meta">
                      <span>{{ formatAuthors(refItem) || t('Unknown author') }}</span>
                      <span v-if="extractYear(refItem)"> · {{ extractYear(refItem) }}</span>
                      <span v-if="containerLabel(refItem)"> · {{ containerLabel(refItem) }}</span>
                      <span class="library-ref-key">@{{ refItem._key }}</span>
                    </div>
                  </div>

                  <div class="library-tags-cell">
                    <template v-if="(refItem._tags || []).length > 0">
                      <span
                        v-for="tag in visibleTags(refItem)"
                        :key="`${refItem._key}-${tag}`"
                        class="library-tag-chip"
                      >
                        {{ tag }}
                      </span>
                      <span v-if="hiddenTagCount(refItem) > 0" class="library-tag-chip muted">
                        +{{ hiddenTagCount(refItem) }}
                      </span>
                    </template>
                    <span v-else class="library-muted-copy">
                      {{ t('Untagged') }}
                    </span>
                  </div>

                  <div class="library-project-cell">
                    <span class="library-state-pill" :class="{ active: isInCurrentProject(refItem._key) }">
                      {{ isInCurrentProject(refItem._key) ? t('In project') : t('Library only') }}
                    </span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </main>

        <aside class="library-detail">
          <div class="library-pane-header">
            <div class="library-section-label">{{ t('Overview') }}</div>
            <div v-if="activeRef" class="library-detail-toolbar">
              <button type="button" class="library-inline-button" @click="askAiForCleanup">
                {{ t('AI cleanup') }}
              </button>
              <button type="button" class="library-inline-button" @click="enterEditMode(activeRef._key)">
                {{ t('Edit metadata') }}
              </button>
              <div ref="detailMenuRef" class="library-menu-wrap">
                <button
                  type="button"
                  class="library-menu-button"
                  :title="t('More actions')"
                  @click.stop="showDetailMenu = !showDetailMenu"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="4" cy="8" r="1.2" />
                    <circle cx="8" cy="8" r="1.2" />
                    <circle cx="12" cy="8" r="1.2" />
                  </svg>
                </button>
                <div v-if="showDetailMenu" class="library-menu-panel">
                  <button
                    type="button"
                    class="library-menu-item danger"
                    @click="deleteActiveReferenceGlobally"
                  >
                    {{ t('Delete from global library') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeRef" class="library-detail-inner">
            <div class="library-detail-primary">
              <div class="library-detail-title">{{ activeRef.title || `@${activeRef._key}` }}</div>
              <div class="library-detail-subtitle">
                {{ formatAuthors(activeRef) || t('Unknown author') }}
                <span v-if="extractYear(activeRef)"> · {{ extractYear(activeRef) }}</span>
                <span v-if="containerLabel(activeRef)"> · {{ containerLabel(activeRef) }}</span>
              </div>
              <div class="library-detail-pill-row">
                <span class="library-state-pill" :class="{ active: isInCurrentProject(activeRef._key) }">
                  {{ isInCurrentProject(activeRef._key) ? t('In current project') : t('Global only') }}
                </span>
                <span v-if="activeRef._needsReview" class="library-state-pill warning">{{ t('Needs review') }}</span>
                <span v-if="activeRef._pdfFile" class="library-state-pill">{{ t('PDF') }}</span>
                <span class="library-state-pill">{{ activeReadingState === 'reading' ? t('Reading') : activeReadingState === 'reviewed' ? t('Reviewed') : t('Unread') }}</span>
                <span v-if="activePriority" class="library-state-pill warning">{{ t(activePriority === 'high' ? 'High priority' : activePriority === 'medium' ? 'Medium priority' : 'Low priority') }}</span>
              </div>
            </div>

            <div class="library-detail-section">
              <div class="library-detail-grid">
                <div class="library-detail-label">{{ t('Key') }}</div>
                <div class="library-detail-value">@{{ activeRef._key }}</div>
                <div class="library-detail-label">{{ t('Year') }}</div>
                <div class="library-detail-value">{{ extractYear(activeRef) || t('None') }}</div>
                <div class="library-detail-label">{{ t('Journal / Conference') }}</div>
                <div class="library-detail-value">{{ containerLabel(activeRef) || t('None') }}</div>
                <div class="library-detail-label">DOI</div>
                <div class="library-detail-value">{{ activeRef.DOI || t('None') }}</div>
                <div class="library-detail-label">{{ t('Cited in') }}</div>
                <div class="library-detail-value">
                  {{ activeCitedCount > 0 ? t('Cited in {count} files', { count: activeCitedCount }) : t('Not cited') }}
                </div>
              </div>

              <div class="library-detail-actions">
                <button type="button" class="library-inline-button" @click="toggleProjectMembership(activeRef._key)">
                  {{ isInCurrentProject(activeRef._key) ? t('Remove from this project') : t('Add to project') }}
                </button>
                <button
                  v-if="activePdfPath"
                  type="button"
                  class="library-quiet-button"
                  @click="openReferencePdf(activeRef._key)"
                >
                  {{ t('Open PDF') }}
                </button>
              </div>
            </div>

            <div class="library-detail-section">
              <div class="library-section-label">{{ t('Workflow') }}</div>
              <div class="library-detail-grid workflow">
                <div class="library-detail-label">{{ t('Reading state') }}</div>
                <select v-model="activeReadingState" class="library-select library-detail-select">
                  <option value="unread">{{ t('Unread') }}</option>
                  <option value="reading">{{ t('Reading') }}</option>
                  <option value="reviewed">{{ t('Reviewed') }}</option>
                </select>
                <div class="library-detail-label">{{ t('Priority') }}</div>
                <select v-model="activePriority" class="library-select library-detail-select">
                  <option value="">{{ t('None') }}</option>
                  <option value="high">{{ t('High') }}</option>
                  <option value="medium">{{ t('Medium') }}</option>
                  <option value="low">{{ t('Low') }}</option>
                </select>
                <div class="library-detail-label">{{ t('Rating') }}</div>
                <select v-model="activeRating" class="library-select library-detail-select">
                  <option value="0">{{ t('None') }}</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>
            </div>

            <div class="library-detail-section">
              <div class="library-sidebar-row">
                <div class="library-section-label">{{ t('Collections') }}</div>
              </div>
              <div v-if="collections.length > 0" class="library-collection-list">
                <button
                  v-for="collection in collections"
                  :key="collection.id"
                  type="button"
                  class="library-collection-row"
                  :class="{ 'is-active': activeCollectionSet.has(collection.id) }"
                  @click="toggleActiveCollection(collection.id)"
                >
                  <span class="truncate">{{ collection.name }}</span>
                  <span class="library-nav-count">{{ collectionCounts[collection.id] || 0 }}</span>
                </button>
              </div>
              <div v-else class="library-inline-empty">
                {{ t('No collections yet') }}
              </div>
            </div>

            <div class="library-detail-section">
              <div class="library-sidebar-row">
                <div class="library-section-label">{{ t('Tags') }}</div>
              </div>
              <div class="library-tags-cell detail">
                <span
                  v-for="tag in activeRef._tags || []"
                  :key="tag"
                  class="library-tag-chip"
                >
                  {{ tag }}
                </span>
                <span v-if="!activeRef._tags || activeRef._tags.length === 0" class="library-muted-copy">
                  {{ t('Untagged') }}
                </span>
              </div>
              <div class="library-detail-tag-edit">
                <input
                  v-model="detailTagsInput"
                  class="library-batch-input"
                  :placeholder="t('comma-separated')"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                />
                <button type="button" class="library-inline-button" @click="saveDetailTags">
                  {{ t('Save tags') }}
                </button>
              </div>
            </div>

            <div class="library-detail-section">
              <div class="library-sidebar-row">
                <div class="library-section-label">{{ t('Reading note') }}</div>
                <button type="button" class="library-link-button" @click="insertReadingNoteIntoManuscript">
                  {{ t('Insert note into manuscript') }}
                </button>
              </div>
              <textarea
                v-model="detailReadingNoteInput"
                class="library-detail-textarea"
                :placeholder="t('Add a reading note about why this source matters...')"
              />
              <div class="library-detail-actions">
                <button type="button" class="library-inline-button" @click="saveReadingNote">
                  {{ t('Save note') }}
                </button>
              </div>
            </div>

            <div class="library-detail-section">
              <div class="library-sidebar-row">
                <div class="library-section-label">{{ t('Summary') }}</div>
                <button type="button" class="library-link-button" @click="askAiForSummary">
                  {{ t('AI summarize') }}
                </button>
              </div>
              <textarea
                v-model="detailSummaryInput"
                class="library-detail-textarea"
                :placeholder="t('Capture the main argument, method, findings, and relevance...')"
              />
              <div class="library-detail-actions">
                <button type="button" class="library-inline-button" @click="saveSummary">
                  {{ t('Save summary') }}
                </button>
              </div>
            </div>

            <div class="library-detail-section">
              <div class="library-section-label">{{ t('Research assets') }}</div>
              <div class="library-stat-grid">
                <div class="library-stat-card">
                  <span class="library-section-label">{{ t('PDF annotations') }}</span>
                  <span class="library-stat-value">{{ activeAnnotationCount }}</span>
                </div>
                <div class="library-stat-card">
                  <span class="library-section-label">{{ t('Research notes') }}</span>
                  <span class="library-stat-value">{{ activeResearchNoteCount }}</span>
                </div>
              </div>
              <div class="library-detail-actions">
                <button
                  v-if="activePdfPath"
                  type="button"
                  class="library-inline-button"
                  @click="openReferencePdf(activeRef._key)"
                >
                  {{ t('Continue reading') }}
                </button>
                <button
                  v-if="latestResearchNote"
                  type="button"
                  class="library-quiet-button"
                  @click="insertLatestResearchNote"
                >
                  {{ t('Insert latest note') }}
                </button>
              </div>
            </div>

            <div class="library-detail-section grow">
              <div class="library-section-label">{{ t('Abstract') }}</div>
              <div class="library-abstract">
                {{ activeRef.abstract || t('No abstract available.') }}
              </div>
            </div>
          </div>

          <div v-else-if="isLibraryLoading" class="library-empty-state detail">
            <div class="library-empty-title">{{ t('Loading references...') }}</div>
            <div class="library-empty-copy">{{ t('Global library is loading for the current workspace.') }}</div>
          </div>

          <div v-else class="library-empty-state detail">
            <div class="library-empty-title">{{ t('No reference selected') }}</div>
            <div class="library-empty-copy">{{ t('Select a reference from the global library to inspect and manage it.') }}</div>
          </div>
        </aside>
      </template>
    </div>

    <AddReferenceDialog
      v-if="showImportDialog"
      @close="showImportDialog = false"
    />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { ask } from '@tauri-apps/plugin-dialog'
import { useReferencesStore } from '../../stores/references'
import { useEditorStore } from '../../stores/editor'
import { useResearchArtifactsStore } from '../../stores/researchArtifacts'
import { useChatStore } from '../../stores/chat'
import { useToastStore } from '../../stores/toast'
import { useWorkspaceStore } from '../../stores/workspace'
import { useI18n } from '../../i18n'
import { launchAiTask } from '../../services/ai/launch'
import {
  createReferenceCleanupTask,
  createReferenceClusterTask,
  createReferenceSummaryTask,
} from '../../services/ai/taskCatalog'
import AddReferenceDialog from '../sidebar/AddReferenceDialog.vue'

const ReferenceView = defineAsyncComponent(() => import('../editor/ReferenceView.vue'))

const referencesStore = useReferencesStore()
const editorStore = useEditorStore()
const researchArtifactsStore = useResearchArtifactsStore()
const chatStore = useChatStore()
const toastStore = useToastStore()
const workspace = useWorkspaceStore()
const { t } = useI18n()

const activeView = ref('all')
const searchQuery = ref('')
const sortKey = ref('added-desc')
const selectedTags = ref([])
const selectedKeys = ref([])
const tagActionInput = ref('')
const batchTagAction = ref('add')
const batchCollectionId = ref('')
const detailTagsInput = ref('')
const detailSummaryInput = ref('')
const detailReadingNoteInput = ref('')
const showImportDialog = ref(false)
const showDetailMenu = ref(false)
const detailMenuRef = ref(null)
const showCollectionComposer = ref(false)
const showSavedViewComposer = ref(false)
const newCollectionName = ref('')
const newSavedViewName = ref('')

const workspaceName = computed(() => workspace.path?.split('/').pop() || t('No workspace'))
const allRefs = computed(() => referencesStore.globalLibrary || [])
const collections = computed(() => referencesStore.collections || [])
const savedViews = computed(() => referencesStore.savedViews || [])
const selectedKeySet = computed(() => new Set(selectedKeys.value))
const projectKeySet = computed(() => new Set(referencesStore.workspaceKeys || []))
const activeKey = computed(() => referencesStore.activeKey || '')
const activeSavedView = computed(() => {
  if (!activeView.value.startsWith('preset:')) return null
  const savedViewId = activeView.value.slice('preset:'.length)
  return savedViews.value.find((entry) => entry.id === savedViewId) || null
})
const resolvedViewId = computed(() => activeSavedView.value?.filters?.viewId || activeView.value)
const activeCollection = computed(() => {
  if (!resolvedViewId.value.startsWith('collection:')) return null
  const collectionId = resolvedViewId.value.slice('collection:'.length)
  return collections.value.find((entry) => entry.id === collectionId) || null
})
const isEditing = computed(() => referencesStore.libraryDetailMode === 'edit' && !!activeRef.value)
const hasBatchSelection = computed(() => selectedKeys.value.length > 1)
const isLibraryLoading = computed(() => referencesStore.loading && allRefs.value.length === 0)

const collectionCounts = computed(() => {
  const counts = {}
  for (const refItem of allRefs.value) {
    for (const collectionId of refItem._collections || []) {
      counts[collectionId] = (counts[collectionId] || 0) + 1
    }
  }
  return counts
})

const primaryViewOptions = computed(() => ([
  { id: 'all', label: t('All references'), count: allRefs.value.length },
  { id: 'project', label: t('Current project'), count: referencesStore.workspaceKeys.length },
]))

const smartViewOptions = computed(() => ([
  { id: 'recently-added', label: t('Recently added'), count: allRefs.value.filter((refItem) => isRecentlyAdded(refItem)).length },
  { id: 'with-pdf', label: t('With PDF'), count: allRefs.value.filter((refItem) => !!refItem._pdfFile).length },
  { id: 'missing-pdf', label: t('Missing PDF'), count: allRefs.value.filter((refItem) => !refItem._pdfFile).length },
  { id: 'needs-review', label: t('Needs review'), count: allRefs.value.filter((refItem) => !!refItem._needsReview).length },
  { id: 'frequently-cited', label: t('Frequently cited'), count: allRefs.value.filter((refItem) => citationCount(refItem) >= 2).length },
  { id: 'unread', label: t('Unread'), count: allRefs.value.filter((refItem) => readingState(refItem) === 'unread').length },
  { id: 'reading', label: t('Reading'), count: allRefs.value.filter((refItem) => readingState(refItem) === 'reading').length },
  { id: 'reviewed', label: t('Reviewed'), count: allRefs.value.filter((refItem) => readingState(refItem) === 'reviewed').length },
  { id: 'high-priority', label: t('High priority'), count: allRefs.value.filter((refItem) => priorityState(refItem) === 'high').length },
  { id: 'untagged', label: t('Untagged'), count: allRefs.value.filter((refItem) => !refItem._tags || refItem._tags.length === 0).length },
]))

const scopeFilteredRefs = computed(() => {
  const viewId = resolvedViewId.value
  if (viewId.startsWith('collection:')) {
    const collectionId = viewId.slice('collection:'.length)
    return allRefs.value.filter((refItem) => (refItem._collections || []).includes(collectionId))
  }

  switch (viewId) {
    case 'project':
      return allRefs.value.filter((refItem) => projectKeySet.value.has(refItem._key))
    case 'recently-added':
      return allRefs.value.filter((refItem) => isRecentlyAdded(refItem))
    case 'with-pdf':
      return allRefs.value.filter((refItem) => !!refItem._pdfFile)
    case 'missing-pdf':
      return allRefs.value.filter((refItem) => !refItem._pdfFile)
    case 'needs-review':
      return allRefs.value.filter((refItem) => !!refItem._needsReview)
    case 'frequently-cited':
      return allRefs.value.filter((refItem) => citationCount(refItem) >= 2)
    case 'unread':
      return allRefs.value.filter((refItem) => readingState(refItem) === 'unread')
    case 'reading':
      return allRefs.value.filter((refItem) => readingState(refItem) === 'reading')
    case 'reviewed':
      return allRefs.value.filter((refItem) => readingState(refItem) === 'reviewed')
    case 'high-priority':
      return allRefs.value.filter((refItem) => priorityState(refItem) === 'high')
    case 'untagged':
      return allRefs.value.filter((refItem) => !refItem._tags || refItem._tags.length === 0)
    case 'all':
    default:
      return allRefs.value
  }
})

const textFilteredRefs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return scopeFilteredRefs.value
  const tokens = query.split(/\s+/).filter(Boolean)
  return scopeFilteredRefs.value.filter((refItem) => {
    const haystack = [
      refItem.title || '',
      refItem._key || '',
      refItem.DOI || '',
      containerLabel(refItem),
      formatAuthors(refItem),
      extractYear(refItem),
      refItem.abstract || '',
      refItem._summary || '',
      refItem._readingNote || '',
      ...(refItem._tags || []),
    ].join(' ').toLowerCase()
    return tokens.every((token) => haystack.includes(token))
  })
})

const tagFacets = computed(() => {
  const counts = new Map()
  for (const refItem of textFilteredRefs.value) {
    for (const tag of refItem._tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
})

const filteredRefs = computed(() => {
  let list = textFilteredRefs.value
  if (selectedTags.value.length > 0) {
    list = list.filter((refItem) => {
      const tags = new Set(refItem._tags || [])
      return selectedTags.value.every((tag) => tags.has(tag))
    })
  }

  const copy = [...list]
  switch (sortKey.value) {
    case 'author-asc':
      return copy.sort((a, b) => formatAuthors(a).localeCompare(formatAuthors(b)))
    case 'title-asc':
      return copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    case 'year-asc':
      return copy.sort((a, b) => extractYear(a) - extractYear(b))
    case 'year-desc':
      return copy.sort((a, b) => extractYear(b) - extractYear(a))
    case 'added-desc':
    default:
      return copy.sort((a, b) => String(b._addedAt || '').localeCompare(String(a._addedAt || '')))
  }
})

const activeRef = computed(() => {
  if (referencesStore.activeKey) {
    return referencesStore.getByKey(referencesStore.activeKey)
  }
  if (filteredRefs.value.length > 0) return filteredRefs.value[0]
  return null
})

const activePdfPath = computed(() => {
  if (!activeRef.value?._key) return null
  return referencesStore.pdfPathForKey(activeRef.value._key)
})

const activeCitedCount = computed(() => {
  if (!activeRef.value?._key) return 0
  return referencesStore.citedIn[activeRef.value._key]?.length || 0
})

const activeCollectionSet = computed(() => new Set(activeRef.value?._collections || []))
const activeReadingState = computed({
  get: () => readingState(activeRef.value),
  set: (value) => {
    if (!activeRef.value?._key) return
    referencesStore.setReadingState([activeRef.value._key], value)
  },
})
const activePriority = computed({
  get: () => priorityState(activeRef.value),
  set: (value) => {
    if (!activeRef.value?._key) return
    referencesStore.setPriority([activeRef.value._key], value)
  },
})
const activeRating = computed({
  get: () => String(ratingValue(activeRef.value)),
  set: (value) => {
    if (!activeRef.value?._key) return
    referencesStore.setRating([activeRef.value._key], Number(value || 0))
  },
})
const activeAnnotations = computed(() => (
  activePdfPath.value ? researchArtifactsStore.annotationsForPdf(activePdfPath.value) : []
))
const activeAnnotationCount = computed(() => activeAnnotations.value.length)
const activeResearchNotes = computed(() => {
  if (!activeRef.value?._key) return []
  const annotationIds = new Set(activeAnnotations.value.map((entry) => entry.id))
  return [...researchArtifactsStore.notes]
    .filter((note) => (
      (note?.sourceAnnotationId && annotationIds.has(note.sourceAnnotationId))
      || note?.sourceRef?.referenceKey === activeRef.value._key
    ))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
})
const activeResearchNoteCount = computed(() => activeResearchNotes.value.length)
const latestResearchNote = computed(() => activeResearchNotes.value[0] || null)

watch(activeRef, (refItem) => {
  detailTagsInput.value = (refItem?._tags || []).join(', ')
  detailSummaryInput.value = refItem?._summary || ''
  detailReadingNoteInput.value = refItem?._readingNote || ''
  showDetailMenu.value = false
}, { immediate: true })

watch(filteredRefs, (refs) => {
  const visibleKeys = new Set(refs.map((item) => item._key))
  selectedKeys.value = selectedKeys.value.filter((key) => visibleKeys.has(key))

  if (referencesStore.activeKey && referencesStore.getByKey(referencesStore.activeKey)) {
    if (isEditing.value) return
    if (visibleKeys.has(referencesStore.activeKey)) return
  }

  referencesStore.activeKey = refs[0]?._key || null
}, { immediate: true })

watch(allRefs, (refs) => {
  const availableKeys = new Set(refs.map((item) => item._key))
  selectedKeys.value = selectedKeys.value.filter((key) => availableKeys.has(key))
  if (referencesStore.activeKey && !availableKeys.has(referencesStore.activeKey)) {
    referencesStore.activeKey = null
    referencesStore.closeLibraryDetailMode()
  }
}, { deep: true })

watch(collections, (items) => {
  const activeCollectionId = activeCollection.value?.id || ''
  if (activeCollectionId && !items.some((entry) => entry.id === activeCollectionId)) {
    activeView.value = 'all'
  }
  if (batchCollectionId.value && !items.some((entry) => entry.id === batchCollectionId.value)) {
    batchCollectionId.value = ''
  }
}, { deep: true })

watch(savedViews, (items) => {
  if (!activeSavedView.value && activeView.value.startsWith('preset:')) {
    activeView.value = 'all'
  }
  if (items.length === 0) {
    showSavedViewComposer.value = false
  }
}, { deep: true })

function formatAuthors(refItem = {}) {
  const authors = Array.isArray(refItem.author) ? refItem.author : []
  return authors
    .map((author) => author?.family || author?.given || '')
    .filter(Boolean)
    .join(', ')
}

function extractYear(refItem = {}) {
  return Number(refItem?.issued?.['date-parts']?.[0]?.[0] || 0)
}

function containerLabel(refItem = {}) {
  return refItem['container-title'] || refItem.publisher || ''
}

function readingState(refItem = {}) {
  const value = String(refItem?._readingState || '').trim().toLowerCase()
  return ['reading', 'reviewed'].includes(value) ? value : 'unread'
}

function priorityState(refItem = {}) {
  const value = String(refItem?._priority || '').trim().toLowerCase()
  return ['low', 'medium', 'high'].includes(value) ? value : ''
}

function ratingValue(refItem = {}) {
  const numeric = Number(refItem?._rating || 0)
  return Number.isFinite(numeric) && numeric >= 1 && numeric <= 5 ? Math.round(numeric) : 0
}

function citationCount(refItem = {}) {
  return referencesStore.citedIn[refItem?._key]?.length || 0
}

function isRecentlyAdded(refItem = {}) {
  const addedAt = Date.parse(refItem?._addedAt || '')
  if (!Number.isFinite(addedAt)) return false
  return Date.now() - addedAt <= 30 * 24 * 60 * 60 * 1000
}

function parseTags(value = '') {
  return Array.from(new Set(
    String(value || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  ))
}

function visibleTags(refItem = {}) {
  return (refItem._tags || []).slice(0, 2)
}

function hiddenTagCount(refItem = {}) {
  return Math.max(0, (refItem._tags || []).length - 2)
}

function activateView(viewId) {
  activeView.value = viewId
}

function activateCollection(collectionId) {
  if (!collectionId) return
  activeView.value = `collection:${collectionId}`
}

function applySavedView(savedViewId) {
  const savedView = savedViews.value.find((entry) => entry.id === savedViewId)
  if (!savedView) return
  activeView.value = `preset:${savedView.id}`
  selectedTags.value = [...(savedView.filters?.tags || [])]
  searchQuery.value = savedView.filters?.searchQuery || ''
  sortKey.value = savedView.filters?.sortKey || 'added-desc'
}

function toggleTag(tag) {
  if (selectedTags.value.includes(tag)) {
    selectedTags.value = selectedTags.value.filter((item) => item !== tag)
    return
  }
  selectedTags.value = [...selectedTags.value, tag]
}

function focusReference(key) {
  referencesStore.focusReferenceInLibrary(key, { mode: 'browse' })
}

function enterEditMode(key) {
  referencesStore.focusReferenceInLibrary(key, { mode: 'edit' })
}

function exitEditMode() {
  referencesStore.closeLibraryDetailMode()
}

function handleEmbeddedEditorClose() {
  referencesStore.closeLibraryDetailMode()
  if (!referencesStore.activeKey && filteredRefs.value[0]?._key) {
    referencesStore.activeKey = filteredRefs.value[0]._key
  }
}

function toggleSelection(key) {
  if (selectedKeySet.value.has(key)) {
    selectedKeys.value = selectedKeys.value.filter((item) => item !== key)
    if (referencesStore.activeKey === key && selectedKeys.value.length > 0) {
      referencesStore.activeKey = selectedKeys.value[0]
    }
    return
  }
  selectedKeys.value = [...selectedKeys.value, key]
  referencesStore.activeKey = key
}

function clearSelection() {
  selectedKeys.value = []
}

function toggleCollectionComposer() {
  showCollectionComposer.value = !showCollectionComposer.value
  if (!showCollectionComposer.value) {
    newCollectionName.value = ''
  }
}

function toggleSavedViewComposer() {
  showSavedViewComposer.value = !showSavedViewComposer.value
  if (!showSavedViewComposer.value) {
    newSavedViewName.value = ''
  }
}

function isInCurrentProject(key) {
  return projectKeySet.value.has(key)
}

function addSelectionToWorkspace() {
  for (const key of selectedKeys.value) {
    referencesStore.addKeyToWorkspace(key)
  }
}

function removeSelectionFromWorkspace() {
  if (selectedKeys.value.length === 0) return
  referencesStore.removeReferences(selectedKeys.value)
}

function applyCollectionAction(action = 'add') {
  if (!batchCollectionId.value || selectedKeys.value.length === 0) return
  if (action === 'remove') {
    referencesStore.removeCollectionFromReferences(selectedKeys.value, batchCollectionId.value)
    return
  }
  referencesStore.addCollectionToReferences(selectedKeys.value, batchCollectionId.value)
}

function toggleProjectMembership(key) {
  if (isInCurrentProject(key)) {
    referencesStore.removeReference(key)
    return
  }
  referencesStore.addKeyToWorkspace(key)
}

function toggleActiveCollection(collectionId) {
  if (!activeRef.value?._key) return
  referencesStore.toggleCollectionForReference(activeRef.value._key, collectionId)
}

function openReferencePdf(key) {
  if (!key) return
  const pdfPath = referencesStore.pdfPathForKey(key)
  if (!pdfPath) return
  editorStore.openFile(pdfPath)
}

function applyTagAction(action) {
  const keys = selectedKeys.value
  const tags = parseTags(tagActionInput.value)
  if (keys.length === 0) return
  if (action === 'replace') {
    referencesStore.replaceTagsForReferences(keys, tags)
  } else if (action === 'remove') {
    referencesStore.removeTagsFromReferences(keys, tags)
  } else {
    referencesStore.addTagsToReferences(keys, tags)
  }
  tagActionInput.value = ''
}

function saveDetailTags() {
  if (!activeRef.value?._key) return
  referencesStore.replaceTagsForReferences([activeRef.value._key], parseTags(detailTagsInput.value))
}

function saveSummary() {
  if (!activeRef.value?._key) return
  referencesStore.saveReferenceSummary(activeRef.value._key, detailSummaryInput.value)
}

function saveReadingNote() {
  if (!activeRef.value?._key) return
  referencesStore.saveReferenceReadingNote(activeRef.value._key, detailReadingNoteInput.value)
}

function createCollection() {
  const result = referencesStore.createCollection(newCollectionName.value)
  if (!result?.ok) return
  newCollectionName.value = ''
  showCollectionComposer.value = false
  if (result.collection?.id) {
    activateCollection(result.collection.id)
  }
}

async function deleteActiveCollection() {
  if (!activeCollection.value?.id) return
  const yes = await ask(
    t('Delete collection "{name}"?', { name: activeCollection.value.name }),
    { title: t('Confirm Delete'), kind: 'warning' },
  )
  if (!yes) return
  referencesStore.deleteCollection(activeCollection.value.id)
}

function createSavedView() {
  const result = referencesStore.createSavedView({
    name: newSavedViewName.value,
    filters: {
      viewId: resolvedViewId.value,
      tags: [...selectedTags.value],
      searchQuery: searchQuery.value,
      sortKey: sortKey.value,
    },
  })
  if (!result?.ok) return
  newSavedViewName.value = ''
  showSavedViewComposer.value = false
  if (result.savedView?.id) {
    applySavedView(result.savedView.id)
  }
}

async function deleteCurrentSavedView() {
  if (!activeSavedView.value?.id) return
  const yes = await ask(
    t('Delete saved view "{name}"?', { name: activeSavedView.value.name }),
    { title: t('Confirm Delete'), kind: 'warning' },
  )
  if (!yes) return
  const deletedId = activeSavedView.value.id
  referencesStore.deleteSavedView(deletedId)
  if (activeView.value === `preset:${deletedId}`) {
    activeView.value = 'all'
  }
}

async function askAiForSummary() {
  if (!activeRef.value?._key) return
  await launchAiTask({
    editorStore,
    chatStore,
    paneId: editorStore.activePaneId || null,
    beside: true,
    task: createReferenceSummaryTask({
      refKey: activeRef.value._key,
      source: 'library-workbench',
      entryContext: 'library-workbench',
    }),
  })
}

async function askAiForCleanup() {
  if (!activeRef.value?._key) return
  await launchAiTask({
    editorStore,
    chatStore,
    paneId: editorStore.activePaneId || null,
    beside: true,
    task: createReferenceCleanupTask({
      refKeys: [activeRef.value._key],
      source: 'library-workbench',
      entryContext: 'library-workbench',
    }),
  })
}

async function clusterSelectedReferences() {
  if (selectedKeys.value.length < 2) return
  await launchAiTask({
    editorStore,
    chatStore,
    paneId: editorStore.activePaneId || null,
    beside: true,
    task: createReferenceClusterTask({
      refKeys: selectedKeys.value,
      source: 'library-workbench',
      entryContext: 'library-workbench',
    }),
  })
}

function insertReadingNoteIntoManuscript() {
  if (!activeRef.value?._key) return
  const notePayload = {
    quote: detailSummaryInput.value || activeRef.value.abstract || activeRef.value.title || `@${activeRef.value._key}`,
    comment: detailReadingNoteInput.value,
    sourceRef: {
      type: 'reference',
      referenceKey: activeRef.value._key,
      pdfPath: activePdfPath.value,
      page: 0,
    },
  }
  const result = editorStore.insertResearchNoteIntoManuscript(notePayload, null)
  if (!result?.ok) {
    toastStore.show(
      t('Open a text manuscript in another pane to insert this note.'),
      { type: 'error', duration: 4200 },
    )
    return
  }
  toastStore.show(t('Inserted note into {name}', {
    name: result.path?.split('/').pop() || t('current manuscript'),
  }), {
    type: 'success',
    duration: 2400,
  })
}

function insertLatestResearchNote() {
  if (!latestResearchNote.value) return
  const annotation = latestResearchNote.value.sourceAnnotationId
    ? researchArtifactsStore.getAnnotation(latestResearchNote.value.sourceAnnotationId)
    : null
  const result = editorStore.insertResearchNoteIntoManuscript(latestResearchNote.value, annotation || null)
  if (!result?.ok) {
    toastStore.show(
      t('Open a text manuscript in another pane to insert this note.'),
      { type: 'error', duration: 4200 },
    )
    return
  }
  if (latestResearchNote.value.id) {
    researchArtifactsStore.updateResearchNote(latestResearchNote.value.id, {
      insertedInto: {
        path: result.path,
        insertedAt: new Date().toISOString(),
      },
    })
  }
  toastStore.show(t('Inserted note into {name}', {
    name: result.path?.split('/').pop() || t('current manuscript'),
  }), {
    type: 'success',
    duration: 2400,
  })
}

async function deleteActiveReferenceGlobally() {
  if (!activeRef.value?._key) return
  showDetailMenu.value = false
  const key = activeRef.value._key
  const yes = await ask(
    t('Delete reference @{key} from the global library?', { key }),
    { title: t('Confirm Global Delete'), kind: 'warning' },
  )
  if (!yes) return
  await referencesStore.removeReferenceFromGlobal(key)
}

function returnToWorkspace() {
  editorStore.closeLibrarySurface('global')
}

function onDocumentMousedown(event) {
  if (!showDetailMenu.value) return
  const menuEl = detailMenuRef.value
  if (!menuEl || !(event.target instanceof Node)) return
  if (!menuEl.contains(event.target)) {
    showDetailMenu.value = false
  }
}

function onDocumentKeydown(event) {
  if (event.key === 'Escape' && showDetailMenu.value) {
    event.preventDefault()
    showDetailMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMousedown, true)
  document.addEventListener('keydown', onDocumentKeydown, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentMousedown, true)
  document.removeEventListener('keydown', onDocumentKeydown, true)
})
</script>

<style scoped>
.library-workbench {
  background: var(--bg-primary);
  color: var(--fg-primary);
}

.library-shell {
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr) 320px;
  background: var(--bg-secondary);
}

.library-shell.is-editing {
  grid-template-columns: 196px minmax(0, 1fr);
}

.library-sidebar,
.library-main,
.library-detail,
.library-editor-stage {
  min-height: 0;
}

.library-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-right: 1px solid var(--border);
  background: var(--bg-secondary);
  overflow: auto;
}

.library-sidebar-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 10px 9px;
  border-bottom: 1px solid var(--border);
}

.library-sidebar-row,
.library-toolbar-row,
.library-filter-row,
.library-batch-head,
.library-batch-actions,
.library-detail-toolbar,
.library-detail-actions,
.library-detail-tag-edit,
.library-editor-actions,
.library-editor-title-row,
.library-main-meta,
.library-detail-pill-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.library-sidebar-row,
.library-filter-row,
.library-toolbar-row,
.library-batch-actions,
.library-detail-toolbar,
.library-detail-actions,
.library-detail-tag-edit,
.library-editor-actions,
.library-main-meta,
.library-detail-pill-row {
  flex-wrap: wrap;
}

.library-section-label,
.library-detail-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.library-editor-title,
.library-detail-title,
.library-empty-title {
  margin: 0;
  color: var(--fg-primary);
  font-weight: 650;
}

.library-inline-empty,
.library-muted-copy,
.library-empty-copy,
.library-ref-meta,
.library-detail-subtitle,
.library-detail-value,
.library-abstract {
  font-size: 12px;
  color: var(--fg-muted);
}

.library-sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 8px;
}

.library-sidebar-section.grow {
  min-height: 0;
  flex: 1;
  padding-bottom: 10px;
}

.library-nav-list,
.library-tag-list,
.library-filter-chip-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.library-tag-list {
  min-height: 0;
  overflow: auto;
}

.library-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-primary);
}

.library-toolbar,
.library-editor-toolbar,
.library-pane-header {
  border-bottom: 1px solid var(--border);
}

.library-back-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: flex-start;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  font-size: 12px;
  line-height: 1.2;
  transition: color 120ms, opacity 120ms;
}

.library-back-button:hover {
  color: var(--fg-primary);
}

.library-back-button svg {
  width: 10px;
  height: 10px;
  opacity: 0.8;
}

.library-sidebar-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.library-sidebar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.library-sidebar-workspace-name {
  font-size: 14px;
  line-height: 1.2;
  color: var(--fg-primary);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-inline-label {
  color: var(--fg-muted);
}

.library-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
}

.library-search-shell {
  flex: 1 1 320px;
  min-width: 220px;
}

.library-search-input,
.library-select,
.library-batch-input {
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--fg-primary);
  outline: none;
}

.library-select {
  width: 170px;
  appearance: none;
  -webkit-appearance: none;
  padding-right: 30px;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--fg-muted) 50%),
    linear-gradient(135deg, var(--fg-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 15px) calc(50% - 2px),
    calc(100% - 10px) calc(50% - 2px);
  background-size: 5px 5px;
  background-repeat: no-repeat;
}

.library-batch-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.library-batch-head {
  justify-content: space-between;
}

.library-batch-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-secondary);
}

.library-batch-actions .library-batch-input {
  flex: 1;
  min-width: 180px;
}

.library-batch-select {
  width: 132px;
  flex: 0 0 auto;
}

.library-inline-form {
  display: flex;
  align-items: center;
  gap: 6px;
}

.library-inline-form .library-batch-input {
  flex: 1;
}

.library-menu-wrap {
  position: relative;
}

.library-menu-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-muted);
  transition: background-color 120ms, color 120ms;
}

.library-menu-button:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.library-menu-panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  min-width: 164px;
  padding: 4px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
}

.library-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 28px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: var(--fg-secondary);
  font-size: 12px;
  text-align: left;
}

.library-menu-item:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.library-menu-item.danger {
  color: var(--error);
}

.library-menu-item.danger:hover {
  background: color-mix(in srgb, var(--error) 10%, var(--bg-hover));
  color: var(--error);
}

.library-nav-item,
.library-tag-row,
.library-inline-button,
.library-quiet-button,
.library-filter-chip {
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-secondary);
  transition: background-color 120ms, border-color 120ms, color 120ms;
}

.library-nav-item,
.library-tag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 26px;
  padding: 0 6px 0 10px;
  border-left: 2px solid transparent;
  border-radius: 0 6px 6px 0;
}

.library-inline-button,
.library-quiet-button,
.library-filter-chip {
  height: 28px;
  padding: 0 9px;
  white-space: nowrap;
  flex-shrink: 0;
}

.library-nav-item:hover,
.library-tag-row:hover,
.library-inline-button:hover:not(:disabled),
.library-quiet-button:hover:not(:disabled),
.library-filter-chip:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.library-inline-button.is-primary {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--border));
  background: color-mix(in srgb, var(--accent) 18%, var(--bg-primary));
  color: var(--accent);
}

.library-inline-button.is-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 24%, var(--bg-hover));
  color: var(--accent);
}

.library-nav-item.is-active,
.library-tag-row.is-active,
.library-state-pill.active {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-hover));
  border-color: transparent;
  border-left-color: var(--accent);
  color: var(--accent);
}

.library-collection-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.library-collection-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--fg-secondary);
  transition: background-color 120ms, border-color 120ms, color 120ms;
}

.library-collection-row:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.library-collection-row.is-active {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  color: var(--accent);
}

.library-nav-count {
  min-width: 22px;
  text-align: right;
  font-size: 11px;
  color: var(--fg-muted);
}

.library-link-button {
  border: none;
  background: transparent;
  color: var(--fg-muted);
  padding: 0;
  font-size: 12px;
}

.library-link-button:hover {
  color: var(--fg-primary);
}

.library-count-pill,
.library-state-pill,
.library-tag-chip {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  border: 1px solid var(--border);
  border-radius: 999px;
}

.library-count-pill {
  height: 20px;
  padding: 0 7px;
  font-size: 11px;
  color: var(--fg-muted);
  background: var(--bg-primary);
}

.library-state-pill,
.library-tag-chip {
  padding: 1px 7px;
  font-size: 11px;
  color: var(--fg-secondary);
  background: var(--bg-primary);
}

.library-state-pill.warning {
  border-color: color-mix(in srgb, #d97706 45%, var(--border));
  color: #d97706;
  background: color-mix(in srgb, #d97706 10%, var(--bg-primary));
}

.library-tag-chip.muted {
  color: var(--fg-muted);
}

.library-table {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.library-table-header,
.library-table-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1.8fr) minmax(0, 0.8fr) 108px;
  gap: 10px;
}

.library-table-header {
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.library-table-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.library-table-row {
  align-items: flex-start;
  padding: 8px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 62%, transparent);
  cursor: default;
}

.library-table-row:hover {
  background: var(--bg-hover);
}

.library-table-row.is-focused {
  background: color-mix(in srgb, var(--bg-hover) 82%, var(--bg-primary));
  box-shadow: inset 2px 0 0 var(--accent);
}

.library-checkbox-cell {
  padding-top: 3px;
}

.library-ref-cell,
.library-project-cell {
  min-width: 0;
}

.library-ref-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.library-ref-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 14px;
  line-height: 1.32;
  color: var(--fg-primary);
  font-weight: 650;
}

.library-ref-meta {
  margin-top: 4px;
  line-height: 1.35;
}

.library-ref-key {
  margin-left: 6px;
  color: var(--fg-secondary);
}

.library-tags-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding-top: 1px;
}

.library-project-cell {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding-top: 1px;
}

.library-detail {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
  background: var(--bg-secondary);
  overflow: auto;
}

.library-pane-header,
.library-editor-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-height: 28px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  flex-wrap: wrap;
}

.library-detail-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.library-detail-primary {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.library-detail-title {
  font-size: 18px;
  line-height: 1.34;
}

.library-detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.library-detail-section.grow {
  flex: 1;
}

.library-detail-grid {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  gap: 6px 10px;
  align-items: start;
}

.library-detail-grid.workflow {
  grid-template-columns: 88px minmax(0, 1fr);
}

.library-detail-value {
  overflow-wrap: anywhere;
}

.library-detail-select {
  width: 100%;
}

.library-detail-textarea {
  width: 100%;
  min-height: 78px;
  padding: 8px 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--fg-primary);
  resize: vertical;
  outline: none;
  line-height: 1.45;
}

.library-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.library-stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 58px;
  padding: 8px 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
}

.library-stat-value {
  font-size: 18px;
  line-height: 1;
  color: var(--fg-primary);
  font-weight: 650;
}

.library-abstract {
  line-height: 1.58;
  white-space: pre-wrap;
}

.library-editor-stage {
  display: flex;
  flex-direction: column;
  min-width: 0;
  grid-column: 2 / -1;
  background: var(--bg-primary);
}

.library-editor-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1 1 360px;
}

.library-editor-title {
  font-size: 15px;
  line-height: 1.3;
  min-width: 0;
  flex: 1 1 320px;
  overflow-wrap: anywhere;
}

.library-editor-title-row {
  align-items: flex-start;
}

.library-editor-actions,
.library-detail-toolbar {
  flex: 0 0 auto;
  margin-left: auto;
}

.library-editor-surface {
  flex: 1;
  min-height: 0;
}

.library-empty-state {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 12px;
}

.library-empty-state.detail {
  padding-top: 14px;
}

.library-empty-title {
  font-size: 15px;
}

.library-inline-button:disabled,
.library-quiet-button:disabled {
  opacity: 0.45;
  cursor: default;
}

@media (max-width: 1260px) {
  .library-shell {
    grid-template-columns: 188px minmax(0, 1fr) 296px;
  }
}

@media (max-width: 980px) {
  .library-shell,
  .library-shell.is-editing {
    grid-template-columns: 1fr;
  }

  .library-sidebar,
  .library-detail {
    border: none;
  }

  .library-sidebar {
    border-bottom: 1px solid var(--border);
  }

  .library-detail {
    border-top: 1px solid var(--border);
    max-height: 42%;
  }

  .library-editor-stage {
    grid-column: auto;
  }

  .library-inline-form {
    flex-direction: column;
    align-items: stretch;
  }

  .library-stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
