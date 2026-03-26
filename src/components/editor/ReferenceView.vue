<template>
  <div v-if="ref" class="flex flex-col h-full min-h-0">
    <!-- Metadata header -->
    <div class="ref-header-shell shrink-0">
      <!-- Needs review banner (always visible) -->
      <div
        v-if="ref._needsReview"
        class="ref-review-banner px-3 py-1.5 ui-text-xs flex items-center gap-2"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M8 1l7 13H1L8 1zM8 6v3M8 11h0" />
        </svg>
        <span>{{ t('Unverified — review metadata before citing') }}</span>
        <UiButton
          class="ml-auto ref-review-confirm-btn"
          variant="secondary"
          size="sm"
          @click="confirmRef"
        >
          {{ t('Confirm') }}
        </UiButton>
      </div>

      <!-- Toggle row -->
      <div
        class="ref-header-row flex items-center gap-1.5 px-3 py-1.5 cursor-pointer select-none hover:bg-[var(--bg-hover)]"
        @click="detailsOpen = !detailsOpen"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="ref-header-chevron"
          :class="{ 'ref-header-chevron-open': detailsOpen }"
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <span class="ref-header-label ui-text-xs font-medium">{{ t('Details') }}</span>
        <span class="ref-key-badge ui-text-micro ml-1">@{{ ref._key }}</span>
        <!-- Collapsed summary -->
        <span
          v-if="!detailsOpen"
          class="ref-header-summary ref-header-summary-text ui-text-xs ml-2 truncate flex-1"
        >
          {{ authorLine }}{{ year ? ` (${year})` : '' }}
        </span>
        <div class="ref-header-spacer flex-1" v-if="detailsOpen"></div>
        <!-- Actions -->
        <div class="ref-header-actions flex items-center gap-1 ml-auto" @click.stop>
          <template v-if="libraryEmbedded">
            <UiButton
              class="ref-header-action-button"
              variant="secondary"
              size="sm"
              @click="pdfPath ? openPdf() : attachPdf()"
            >
              {{ pdfPath ? t('Open PDF') : t('Attach PDF...') }}
            </UiButton>
          </template>
          <template v-else>
            <UiButton
              class="ref-header-action-button"
              variant="secondary"
              size="sm"
              @click="askAiAboutReference"
            >
              {{ t('Ask AI') }}
            </UiButton>
            <UiButton
              class="ref-header-action-button"
              variant="secondary"
              size="sm"
              @click="pdfPath ? openPdf() : attachPdf()"
            >
              {{ pdfPath ? t('Open PDF') : t('Attach PDF...') }}
            </UiButton>
            <UiButton
              class="ref-header-action-button"
              :class="{ 'ref-header-action-button-success': copyFlash }"
              variant="secondary"
              size="sm"
              @click="handleCopyAs(copyFormat)"
            >
              {{ copyFlash ? t('Copied!') : t('Copy') }}
            </UiButton>
            <UiSelect
              :model-value="copyFormat"
              size="sm"
              shell-class="ref-header-select-shell"
              @update:modelValue="handleCopyAs"
            >
              <option value="apa">APA</option>
              <option value="chicago">Chicago</option>
              <option value="ieee">IEEE</option>
              <option value="harvard">Harvard</option>
              <option value="vancouver">Vancouver</option>
              <option value="bibtex">BibTeX</option>
            </UiSelect>
          </template>
        </div>
        <template v-if="!libraryEmbedded">
          <UiButton
            class="ref-header-inline-action"
            variant="ghost"
            size="sm"
            @click.stop="deleteRef"
          >
            {{ t('Remove from this project') }}
          </UiButton>
          <UiButton
            class="ref-header-inline-action ref-header-inline-action-danger"
            variant="ghost"
            size="sm"
            @click.stop="deleteRefGlobally"
          >
            {{ t('Delete from global library') }}
          </UiButton>
        </template>
      </div>
    </div>

    <!-- Details -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <div v-if="detailsOpen" class="h-full overflow-y-auto">
        <div class="px-3 py-3 space-y-2.5">
          <!-- Title -->
          <div>
            <label class="ref-detail-label">{{ t('Title') }}</label>
            <UiInput
              :model-value="ref.title"
              shell-class="ref-detail-shell"
              @blur="update('title', $event.target.value)"
            />
          </div>

          <div>
            <label class="ref-detail-label">{{ t('Citation Key') }}</label>
            <UiInput
              :model-value="ref._key"
              monospace
              shell-class="ref-detail-shell"
              :placeholder="t('Example: Wang2019')"
              @blur="updateCitationKey($event.target.value)"
            />
          </div>

          <!-- Authors + Year row -->
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="ref-detail-label">{{ t('Authors') }}</label>
              <UiInput
                :model-value="authorsString"
                shell-class="ref-detail-shell"
                :placeholder="t('Last, First and Last, First')"
                @blur="updateAuthors($event.target.value)"
              />
            </div>
            <div class="w-20">
              <label class="ref-detail-label">{{ t('Year') }}</label>
              <UiInput
                :model-value="year"
                shell-class="ref-detail-shell"
                type="number"
                @blur="updateYear($event.target.value)"
              />
            </div>
          </div>

          <!-- Type + Journal row -->
          <div class="flex gap-2">
            <div class="w-40">
              <label class="ref-detail-label">{{ t('Reference Type') }}</label>
              <UiSelect
                :model-value="ref.type"
                shell-class="ref-detail-shell"
                @update:modelValue="update('type', $event)"
              >
                <option value="article-journal">{{ t('Journal Article') }}</option>
                <option value="paper-conference">{{ t('Conference Paper') }}</option>
                <option value="book">{{ t('Book') }}</option>
                <option value="chapter">{{ t('Book Chapter') }}</option>
                <option value="thesis">{{ t('Thesis') }}</option>
                <option value="report">{{ t('Report') }}</option>
                <option value="article">{{ t('Preprint / Article') }}</option>
                <option value="webpage">{{ t('Webpage') }}</option>
              </UiSelect>
            </div>
            <div class="flex-1">
              <label class="ref-detail-label">{{ t('Journal / Conference') }}</label>
              <UiInput
                :model-value="ref['container-title']"
                shell-class="ref-detail-shell"
                @blur="update('container-title', $event.target.value)"
              />
            </div>
          </div>

          <!-- Volume / Issue / Pages / DOI row -->
          <div class="flex gap-2">
            <div class="w-16">
              <label class="ref-detail-label">{{ t('Vol') }}</label>
              <UiInput
                :model-value="ref.volume"
                shell-class="ref-detail-shell"
                @blur="update('volume', $event.target.value)"
              />
            </div>
            <div class="w-16">
              <label class="ref-detail-label">{{ t('Issue') }}</label>
              <UiInput
                :model-value="ref.issue"
                shell-class="ref-detail-shell"
                @blur="update('issue', $event.target.value)"
              />
            </div>
            <div class="w-20">
              <label class="ref-detail-label">{{ t('Pages') }}</label>
              <UiInput
                :model-value="ref.page"
                shell-class="ref-detail-shell"
                @blur="update('page', $event.target.value)"
              />
            </div>
            <div class="flex-1">
              <label class="ref-detail-label">DOI</label>
              <UiInput
                :model-value="ref.DOI"
                shell-class="ref-detail-shell"
                @blur="update('DOI', $event.target.value)"
              />
            </div>
          </div>

          <!-- Tags -->
          <div>
            <label class="ref-detail-label">{{ t('Tags') }}</label>
            <UiInput
              :model-value="(ref._tags || []).join(', ')"
              shell-class="ref-detail-shell"
              :placeholder="t('comma-separated')"
              @blur="updateTags($event.target.value)"
            />
          </div>

          <!-- Extra fields (publisher, URL, ISBN, etc.) -->
          <div v-if="extraFields.length > 0">
            <label class="ref-detail-label">{{ t('Other fields') }}</label>
            <div class="space-y-1">
              <div v-for="f in extraFields" :key="f.key" class="flex gap-1.5 items-start">
                <span
                  class="ref-extra-field-label ui-text-micro w-20 shrink-0 text-right pt-[3px]"
                  >{{ f.label }}</span
                >
                <UiInput
                  :model-value="f.value"
                  shell-class="ref-detail-shell"
                  @blur="update(f.key, $event.target.value)"
                />
              </div>
            </div>
          </div>

          <!-- Add field -->
          <div v-if="!addingField">
            <UiButton
              class="ref-inline-action"
              variant="ghost"
              size="sm"
              @click="addingField = true"
            >
              {{ t('+ Add field') }}
            </UiButton>
          </div>
          <div v-else class="flex gap-1.5 items-center">
            <UiSelect v-model="newFieldKey" size="sm" shell-class="ref-add-field-select-shell">
              <option value="" disabled>{{ t('Field...') }}</option>
              <option v-for="opt in addableFields" :key="opt.key" :value="opt.key">
                {{ opt.label }}
              </option>
            </UiSelect>
            <UiInput
              v-model="newFieldValue"
              shell-class="ref-detail-shell"
              :placeholder="t('Value')"
              @keydown.enter="confirmAddField"
            />
            <UiButton
              class="ref-inline-action ref-inline-action-accent"
              variant="ghost"
              size="sm"
              :disabled="!newFieldKey || !newFieldValue"
              @click="confirmAddField"
            >
              {{ t('Add') }}
            </UiButton>
            <UiButton class="ref-inline-action" variant="ghost" size="sm" @click="cancelAddField">
              {{ t('Cancel') }}
            </UiButton>
          </div>

          <!-- Abstract (collapsible) -->
          <div v-if="ref.abstract">
            <label class="ref-detail-label">{{ t('Abstract') }}</label>
            <div class="ref-supporting-copy ui-text-xs leading-relaxed">
              <template v-if="!abstractExpanded">
                <span class="ref-abstract-clamped">{{ ref.abstract }}</span>
                <UiButton
                  v-if="ref.abstract.length > 200"
                  class="ref-inline-action ref-inline-action-accent ml-1"
                  variant="ghost"
                  size="sm"
                  @click="abstractExpanded = true"
                >
                  {{ t('read more') }}
                </UiButton>
              </template>
              <template v-else>
                <span>{{ ref.abstract }}</span>
                <UiButton
                  class="ref-inline-action ref-inline-action-accent ml-1"
                  variant="ghost"
                  size="sm"
                  @click="abstractExpanded = false"
                >
                  {{ t('collapse') }}
                </UiButton>
              </template>
            </div>
          </div>

          <!-- Cited in -->
          <div v-if="citedInFiles.length > 0">
            <label class="ref-detail-label">{{ citedInLabel }}</label>
            <div class="flex flex-wrap gap-x-3 gap-y-0.5">
              <span
                v-for="file in citedInFiles"
                :key="file"
                class="ref-linked-file ui-text-xs cursor-pointer hover:underline truncate"
                @click="editorStore.openFile(file)"
              >
                {{ relativePath(file) }}
              </span>
            </div>
          </div>

          <div v-if="auditVisible" class="ref-audit-panel">
            <div class="ref-audit-header">
              <label class="ref-detail-label">{{ t('Reference Audit') }}</label>
              <UiButton
                class="ref-inline-action ref-inline-action-accent"
                variant="ghost"
                size="sm"
                @click="refreshAudit"
              >
                {{ auditLoading ? t('Checking...') : t('Refresh audit') }}
              </UiButton>
            </div>

            <div v-if="auditLoading" class="ref-muted-copy ui-text-xs">
              {{ t('Checking citations and bibliography state...') }}
            </div>

            <div v-else-if="auditError" class="ref-error-copy ui-text-xs">
              {{ auditError }}
            </div>

            <template v-else>
              <div class="ref-audit-summary">
                <span class="ref-audit-chip">{{
                  t('{count} files checked', { count: auditSummary.checkedFileCount || 0 })
                }}</span>
                <span
                  class="ref-audit-chip"
                  :class="{ 'ref-audit-chip-warn': (auditSummary.missingReferenceCount || 0) > 0 }"
                >
                  {{
                    t('{count} missing citations', {
                      count: auditSummary.missingReferenceCount || 0,
                    })
                  }}
                </span>
                <span
                  class="ref-audit-chip"
                  :class="{ 'ref-audit-chip-warn': (auditSummary.bibliographyIssueCount || 0) > 0 }"
                >
                  {{
                    t('{count} bibliography issues', {
                      count: auditSummary.bibliographyIssueCount || 0,
                    })
                  }}
                </span>
              </div>

              <div v-if="currentRefAuditIssues.length > 0" class="ref-audit-list">
                <div class="ref-supporting-label ui-text-micro font-medium">
                  {{ t('Files citing this reference that need attention') }}
                </div>
                <div
                  v-for="issue in currentRefAuditIssues"
                  :key="`${issue.type}:${issue.filePath}`"
                  class="ref-audit-issue"
                >
                  <div class="ref-audit-issue-title">{{ issueLabel(issue) }}</div>
                  <UiButton
                    class="ref-audit-issue-link"
                    variant="ghost"
                    size="sm"
                    @click="editorStore.openFile(issue.filePath)"
                  >
                    {{ relativePath(issue.filePath) }}
                  </UiButton>
                </div>
              </div>

              <div v-if="auditSummary.missingKeys?.length > 0" class="ref-audit-list">
                <div class="ref-supporting-label ui-text-micro font-medium">
                  {{ t('Missing reference keys in this project') }}
                </div>
                <div class="ref-audit-key-list">
                  <span v-for="key in auditSummary.missingKeys" :key="key" class="ref-key-badge"
                    >@{{ key }}</span
                  >
                </div>
              </div>

              <div
                v-if="
                  (auditSummary.missingReferenceCount || 0) === 0 &&
                  (auditSummary.bibliographyIssueCount || 0) === 0
                "
                class="ref-success-copy ui-text-xs"
              >
                {{ t('No bibliography issues found for the currently loaded files.') }}
              </div>
            </template>
          </div>
          <div v-if="!pdfPath" class="ref-empty-pdf rounded-lg border px-3 py-2 ui-text-xs">
            {{ t('No PDF attached') }}
          </div>
        </div>
      </div>
      <div v-else class="ref-empty-state flex items-center justify-center h-full ui-text-xs">
        {{ t('Details') }}
      </div>
    </div>
  </div>

  <!-- Deleted / not found -->
  <div v-else class="ref-empty-state flex items-center justify-center h-full ui-text-xs">
    {{ t('Reference not found') }}
  </div>
</template>

<script setup>
import { ref as vRef, computed, watch, onMounted, nextTick } from 'vue'
import { useReferencesStore } from '../../stores/references'
import { useEditorStore } from '../../stores/editor'
import { useChatStore } from '../../stores/chat'
import { useWorkspaceStore } from '../../stores/workspace'
import { useFilesStore } from '../../stores/files'
import { useToastStore } from '../../stores/toast'
import { getFormatter } from '../../services/citationStyleRegistry'
import { launchReferenceAuditTask } from '../../services/ai/workbenchTaskLaunchers'
import { ask, open } from '@tauri-apps/plugin-dialog'
import { useI18n } from '../../i18n'
import { auditReferenceUsage } from '../../services/referenceAudit'
import UiButton from '../shared/ui/UiButton.vue'
import UiInput from '../shared/ui/UiInput.vue'
import UiSelect from '../shared/ui/UiSelect.vue'

const props = defineProps({
  refKey: { type: String, required: true },
  paneId: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
  libraryEmbedded: { type: Boolean, default: false },
})
const emit = defineEmits(['close-embedded'])

const referencesStore = useReferencesStore()
const editorStore = useEditorStore()
const chatStore = useChatStore()
const workspace = useWorkspaceStore()
const filesStore = useFilesStore()
const toastStore = useToastStore()
const { t } = useI18n()
const libraryEmbedded = computed(() => props.embedded && props.libraryEmbedded)

const detailsOpen = vRef(true)
const abstractExpanded = vRef(false)
const copyFlash = vRef(false)
let copyFlashTimer = null
const copyFormat = vRef(localStorage.getItem('refCopyFormat') || referencesStore.citationStyle)
const addingField = vRef(false)
const newFieldKey = vRef('')
const newFieldValue = vRef('')
const auditSummary = vRef({
  issues: [],
  missingKeys: [],
  missingReferenceCount: 0,
  bibliographyIssueCount: 0,
  checkedFileCount: 0,
})
const auditLoading = vRef(false)
const auditError = vRef('')
const suppressMissingClose = vRef(false)

const ADDABLE_FIELDS = [
  { key: 'publisher', label: t('Publisher') },
  { key: 'URL', label: 'URL' },
  { key: 'ISBN', label: 'ISBN' },
  { key: 'ISSN', label: 'ISSN' },
  { key: 'language', label: t('Language') },
  { key: 'edition', label: t('Edition') },
  { key: 'note', label: t('Note') },
  { key: 'collection-title', label: t('Series') },
  { key: 'number-of-pages', label: t('Page count') },
  { key: 'source', label: t('Source') },
]

const addableFields = computed(() => {
  if (!ref.value) return ADDABLE_FIELDS
  return ADDABLE_FIELDS.filter((f) => ref.value[f.key] == null || ref.value[f.key] === '')
})

const ref = computed(() => referencesStore.getByKey(props.refKey))

const pdfPath = computed(() => {
  return referencesStore.pdfPathForKey(props.refKey)
})
const citedInLabel = computed(() =>
  t(citedInFiles.value.length === 1 ? 'Cited in {count} file' : 'Cited in {count} files', {
    count: citedInFiles.value.length,
  })
)

const authorsString = computed(() => {
  if (!ref.value?.author) return ''
  return ref.value.author.map((a) => (a.given ? `${a.family}, ${a.given}` : a.family)).join(' and ')
})

const year = computed(() => {
  return ref.value?.issued?.['date-parts']?.[0]?.[0] || ''
})

const authorLine = computed(() => {
  const authors = ref.value?.author || []
  if (authors.length === 0) return t('Unknown')
  const first = authors[0].family || authors[0].given || ''
  if (authors.length === 1) return first
  if (authors.length === 2) return `${first} & ${authors[1].family || ''}`
  return `${first} et al.`
})

// Fields already shown in the main form
const MAIN_FIELDS = new Set([
  'id',
  '_key',
  '_addedAt',
  '_matchMethod',
  '_needsReview',
  '_pdfFile',
  '_textFile',
  '_tags',
  'type',
  'title',
  'author',
  'issued',
  'container-title',
  'volume',
  'issue',
  'page',
  'DOI',
  'abstract',
])

const EXTRA_LABELS = {
  publisher: t('Publisher'),
  URL: 'URL',
  ISBN: 'ISBN',
  ISSN: 'ISSN',
  editor: t('Reference editor'),
  edition: t('Edition'),
  note: t('Note'),
  language: t('Language'),
  'collection-title': t('Series'),
  'number-of-pages': t('Pages'),
  source: t('Source'),
}

const extraFields = computed(() => {
  if (!ref.value) return []
  return Object.keys(ref.value)
    .filter((k) => !MAIN_FIELDS.has(k) && ref.value[k] != null && ref.value[k] !== '')
    .map((k) => ({
      key: k,
      label: EXTRA_LABELS[k] || k,
      value: typeof ref.value[k] === 'object' ? JSON.stringify(ref.value[k]) : String(ref.value[k]),
    }))
})

const citedInFiles = computed(() => {
  if (!ref.value?._key) return []
  return referencesStore.citedIn[ref.value._key] || []
})

const auditVisible = computed(
  () => citedInFiles.value.length > 0 || (auditSummary.value.missingKeys?.length || 0) > 0
)
const currentRefAuditIssues = computed(() => {
  if (citedInFiles.value.length === 0) return []
  const citedSet = new Set(citedInFiles.value)
  return (auditSummary.value.issues || []).filter((issue) => citedSet.has(issue.filePath))
})

// Sync activeKey
onMounted(() => {
  referencesStore.activeKey = props.refKey
  refreshAudit()
})

// Auto-close tab when reference is deleted
watch(ref, (val) => {
  if (!val && !suppressMissingClose.value) {
    if (props.embedded) {
      emit('close-embedded')
    } else {
      editorStore.closeTab(props.paneId, `ref:@${props.refKey}`)
    }
  }
})

watch(
  () => props.refKey,
  (nextKey) => {
    referencesStore.activeKey = nextKey
    refreshAudit()
  }
)

watch(
  () => filesStore.fileContents,
  () => {
    refreshAudit()
  },
  { deep: true }
)

watch(
  () => referencesStore.library.length,
  () => {
    refreshAudit()
  }
)

function update(field, value) {
  if (!ref.value) return
  referencesStore.updateReference(ref.value._key, { [field]: value || undefined })
}

function updateCitationKey(value) {
  if (!ref.value) return

  const oldKey = ref.value._key
  const result = referencesStore.renameReferenceKey(oldKey, value)

  if (!result?.ok) {
    toastStore.show(t(result?.error || 'Failed to update citation key.'), {
      type: 'error',
      duration: 4000,
    })
    return
  }

  if (!result.changed) return

  if (!props.embedded) {
    suppressMissingClose.value = true
    editorStore.updateFilePath(`ref:@${oldKey}`, `ref:@${result.key}`)
    nextTick(() => {
      suppressMissingClose.value = false
    })
  }
}

async function refreshAudit() {
  auditLoading.value = true
  auditError.value = ''
  try {
    auditSummary.value = await auditReferenceUsage(filesStore.fileContents, referencesStore)
  } catch (error) {
    auditError.value = error?.message || String(error)
  } finally {
    auditLoading.value = false
  }
}

function issueLabel(issue) {
  if (issue.type === 'missing-bibliography')
    return t('Bibliography has not been generated for this file yet')
  if (issue.type === 'stale-bibliography') return t('Generated bibliography is out of date')
  if (issue.type === 'missing-reference')
    return t('This file cites keys that are missing from the library')
  return issue.type
}

function updateAuthors(value) {
  const authors = value
    .split(/\s+and\s+/i)
    .map((part) => {
      part = part.trim()
      if (part.includes(',')) {
        const [family, ...rest] = part.split(',')
        return { family: family.trim(), given: rest.join(',').trim() }
      }
      const words = part.split(/\s+/)
      return {
        family: words[words.length - 1],
        given: words.slice(0, -1).join(' '),
      }
    })
    .filter((a) => a.family)
  referencesStore.updateReference(ref.value._key, { author: authors })
}

function updateYear(value) {
  const yr = parseInt(value, 10)
  if (!isNaN(yr)) {
    referencesStore.updateReference(ref.value._key, {
      issued: { 'date-parts': [[yr]] },
    })
  }
}

function updateTags(value) {
  const tags = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  referencesStore.updateReference(ref.value._key, { _tags: tags })
}

function confirmRef() {
  referencesStore.updateReference(ref.value._key, { _needsReview: false })
}

function cancelAddField() {
  addingField.value = false
  newFieldKey.value = ''
  newFieldValue.value = ''
}

async function handleCopyAs(style) {
  if (!ref.value || !style) return
  let text
  if (style === 'bibtex') {
    text = referencesStore.exportBibTeX([ref.value._key])
  } else {
    const formatter = getFormatter(style)
    const result = formatter.formatReference(ref.value)
    text = result instanceof Promise ? await result : result
  }
  navigator.clipboard.writeText(text)
  copyFormat.value = style
  localStorage.setItem('refCopyFormat', style)
  copyFlash.value = true
  clearTimeout(copyFlashTimer)
  copyFlashTimer = setTimeout(() => {
    copyFlash.value = false
  }, 1500)
}

function confirmAddField() {
  if (!newFieldKey.value || !newFieldValue.value || !ref.value) return
  referencesStore.updateReference(ref.value._key, { [newFieldKey.value]: newFieldValue.value })
  newFieldKey.value = ''
  newFieldValue.value = ''
  addingField.value = false
}

async function askAiAboutReference() {
  if (!ref.value?._key) return
  await launchReferenceAuditTask({
    editorStore,
    chatStore,
    paneId: props.embedded ? editorStore.activePaneId || null : props.paneId,
    refKey: ref.value._key,
  })
}

function openPdf() {
  if (!pdfPath.value) return
  editorStore.openFile(pdfPath.value)
}

async function deleteRef() {
  if (!ref.value) return
  const yes = await ask(t('Remove reference @{key} from this project?', { key: ref.value._key }), {
    title: t('Confirm Remove'),
    kind: 'warning',
  })
  if (yes) {
    const removed = referencesStore.removeReference(ref.value._key)
    if (removed) {
      await referencesStore.saveLibrary({ immediate: true })
      if (props.embedded) {
        emit('close-embedded')
      } else {
        editorStore.closeTab(props.paneId, `ref:@${props.refKey}`)
      }
    }
  }
}

async function deleteRefGlobally() {
  if (!ref.value) return
  const key = ref.value._key
  const yes = await ask(t('Delete reference @{key} from the global library?', { key }), {
    title: t('Confirm Global Delete'),
    kind: 'warning',
  })
  if (!yes) return

  const removed = await referencesStore.removeReferenceFromGlobal(key)
  if (removed) {
    if (props.embedded) {
      emit('close-embedded')
    } else {
      editorStore.closeTab(props.paneId, `ref:@${props.refKey}`)
    }
  }
}

async function attachPdf() {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (!selected || !ref.value) return

  await referencesStore.storePdf(ref.value._key, selected)
}

function relativePath(path) {
  if (workspace.path && path.startsWith(workspace.path)) {
    return path.slice(workspace.path.length + 1)
  }
  return path
}
</script>

<style scoped>
.ref-header-shell {
  border-bottom: 1px solid var(--border);
}

.ref-review-banner {
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  color: var(--warning);
}

.ref-review-confirm-btn {
  background: color-mix(in srgb, var(--warning) 14%, transparent);
  border-color: color-mix(in srgb, var(--warning) 32%, var(--border));
  color: var(--warning);
}

.ref-review-confirm-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--warning) 20%, transparent);
}

.ref-header-row {
  flex-wrap: wrap;
  align-items: flex-start;
}

.ref-header-chevron {
  color: var(--text-muted);
  transition: transform 0.1s ease;
}

.ref-header-chevron-open {
  transform: rotate(90deg);
}

.ref-header-label {
  color: var(--text-secondary);
}

.ref-header-summary,
.ref-header-spacer {
  min-width: 120px;
}

.ref-header-summary-text {
  color: var(--text-muted);
}

.ref-header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex: 0 0 auto;
}

.ref-header-action-button,
.ref-header-inline-action,
.ref-header-select-shell {
  flex-shrink: 0;
  white-space: nowrap;
}

.ref-header-action-button-success {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 32%, var(--border));
}

.ref-header-inline-action {
  color: var(--text-muted);
}

.ref-header-inline-action-danger {
  color: var(--error);
}

.ref-header-select-shell {
  max-width: 110px;
}

.ref-detail-label {
  display: block;
  margin-bottom: 2px;
  font-size: var(--ui-font-caption);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.ref-detail-shell {
  width: 100%;
}

.ref-extra-field-label,
.ref-supporting-copy,
.ref-supporting-label {
  color: var(--text-secondary);
}

.ref-inline-action {
  color: var(--text-muted);
}

.ref-inline-action-accent {
  color: var(--accent);
}

.ref-add-field-select-shell {
  width: 100px;
}

.ref-linked-file {
  color: var(--hl-link);
}

.ref-abstract-clamped {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ref-audit-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 86%, var(--bg-secondary));
}

.ref-audit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ref-audit-summary,
.ref-audit-key-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ref-audit-chip {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 88%, var(--bg-primary));
  color: var(--fg-secondary);
  font-size: var(--ui-font-micro);
}

.ref-audit-chip-warn {
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 26%, transparent);
  background: color-mix(in srgb, var(--warning) 8%, transparent);
}

.ref-audit-list {
  display: grid;
  gap: 6px;
}

.ref-audit-issue {
  display: grid;
  gap: 3px;
  padding: 8px 9px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 82%, var(--bg-primary));
}

.ref-audit-issue-title {
  color: var(--fg-secondary);
  font-size: var(--ui-font-caption);
}

.ref-audit-issue-link {
  justify-self: start;
  color: var(--hl-link);
  font-size: var(--ui-font-caption);
}

.ref-audit-issue-link:hover {
  text-decoration: underline;
}

.ref-muted-copy,
.ref-empty-state,
.ref-empty-pdf {
  color: var(--text-muted);
}

.ref-error-copy {
  color: var(--error);
}

.ref-success-copy {
  color: var(--success);
}

.ref-empty-pdf {
  border-color: var(--border);
  background: color-mix(in srgb, var(--bg-secondary) 82%, var(--bg-primary));
}
</style>
