<template>
  <Teleport to="body">
    <div class="ref-import-overlay" @click.self="$emit('close')">
      <div class="ref-import-modal">
        <div class="ref-import-header">
          <div>
            <div class="ref-import-title">{{ t('Import Preview') }}</div>
            <div class="ref-import-subtitle">{{ subtitle }}</div>
          </div>
          <button
            type="button"
            class="ref-import-close"
            :title="t('Close pane')"
            @click="$emit('close')"
          >
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 2l6 6M8 2l-6 6"/>
            </svg>
          </button>
        </div>

        <div class="ref-import-summary">
          <span class="ref-import-chip">{{ t('{count} ready to add', { count: readyToAddCount }) }}</span>
          <span v-if="strongDuplicateCount > 0" class="ref-import-chip">{{ t('{count} strong duplicates', { count: strongDuplicateCount }) }}</span>
          <span v-if="possibleDuplicateCount > 0" class="ref-import-chip">{{ t('{count} possible duplicates', { count: possibleDuplicateCount }) }}</span>
          <span v-if="resolvedCount > 0" class="ref-import-chip">{{ t('{count} resolved', { count: resolvedCount }) }}</span>
        </div>

        <div class="ref-import-list">
          <article
            v-for="item in items"
            :key="item.id"
            class="ref-import-item"
            :class="statusClass(item)"
          >
            <div class="ref-import-item-top">
              <div class="ref-import-badges">
                <span class="ref-import-badge" :class="confidenceClass(item.confidence)">
                  {{ confidenceLabel(item.confidence) }}
                </span>
                <span v-if="item.matchType" class="ref-import-badge ref-import-badge-duplicate" :class="`ref-import-badge-${item.matchType}`">
                  {{ duplicateLabel(item.matchType) }}
                </span>
                <span v-if="item.sourceLabel" class="ref-import-badge ref-import-badge-source">
                  {{ t('Source: {name}', { name: item.sourceLabel }) }}
                </span>
              </div>
              <span class="ref-key-badge">{{ item.csl._key || t('auto') }}</span>
            </div>

            <div class="ref-import-item-title">
              {{ item.csl.title || t('Untitled') }}
            </div>

            <div class="ref-import-item-meta">
              {{ formatAuthors(item.csl) }}{{ yearSuffix(item.csl) }}
              <template v-if="item.csl['container-title']"> — {{ item.csl['container-title'] }}</template>
            </div>

            <div v-if="item.csl.DOI" class="ref-import-item-doi">
              DOI: {{ item.csl.DOI }}
            </div>

            <div v-if="item.existingKey" class="ref-import-item-match">
              <div>{{ t('Matches existing reference @{key}', { key: item.existingKey }) }}</div>
              <div v-if="item.existingTitle" class="ref-import-item-match-title">{{ item.existingTitle }}</div>
              <div v-if="item.matchReason" class="ref-import-item-reason">{{ matchReasonLabel(item.matchReason) }}</div>
            </div>

            <div v-if="item.resolution === 'merged'" class="ref-import-item-status ref-import-item-status-success">
              {{ t('Merged into @{key}', { key: item.existingKey }) }}
            </div>
            <div v-else-if="item.resolution === 'kept'" class="ref-import-item-status">
              {{ t('Kept existing @{key}', { key: item.existingKey }) }}
            </div>
            <div v-else-if="item.resolution === 'added'" class="ref-import-item-status ref-import-item-status-success">
              {{ t('Added to library') }}
            </div>

            <div class="ref-import-actions">
              <template v-if="item.resolution === 'pending-add'">
                <button type="button" class="ref-import-primary" @click="$emit('add-item', item.id)">
                  {{ t('Add') }}
                </button>
              </template>
              <template v-else-if="item.resolution === 'pending-duplicate'">
                <button type="button" class="ref-import-primary" @click="$emit('merge-item', item.id)">
                  {{ t('Merge') }}
                </button>
                <button type="button" class="ref-import-secondary" @click="$emit('keep-existing', item.id)">
                  {{ t('Keep existing') }}
                </button>
                <button type="button" class="ref-import-secondary" @click="$emit('view-existing', item.existingKey)">
                  {{ t('View') }}
                </button>
              </template>
              <template v-else>
                <button
                  v-if="item.existingKey"
                  type="button"
                  class="ref-import-secondary"
                  @click="$emit('view-existing', item.existingKey)"
                >
                  {{ t('View') }}
                </button>
              </template>
            </div>
          </article>
        </div>

        <div class="ref-import-footer">
          <button
            type="button"
            class="ref-import-primary"
            :disabled="readyToAddCount === 0"
            @click="$emit('add-all-new')"
          >
            {{ t('Add all new') }}
          </button>
          <button type="button" class="ref-import-secondary" @click="$emit('close')">
            {{ t('Done') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'

const props = defineProps({
  items: { type: Array, default: () => [] },
})

defineEmits(['close', 'add-item', 'merge-item', 'keep-existing', 'view-existing', 'add-all-new'])

const { t } = useI18n()

const readyToAddCount = computed(() => props.items.filter(item => item.resolution === 'pending-add').length)
const strongDuplicateCount = computed(() => props.items.filter(item => item.resolution === 'pending-duplicate' && item.matchType === 'strong').length)
const possibleDuplicateCount = computed(() => props.items.filter(item => item.resolution === 'pending-duplicate' && item.matchType === 'possible').length)
const resolvedCount = computed(() => props.items.filter(item => ['added', 'merged', 'kept'].includes(item.resolution)).length)
const subtitle = computed(() => t('Review {count} imported references before adding them to your library.', { count: props.items.length }))

function yearSuffix(csl) {
  const year = csl?.issued?.['date-parts']?.[0]?.[0]
  return year ? ` (${year})` : ''
}

function formatAuthors(csl) {
  const authors = csl?.author || []
  if (authors.length === 0) return ''
  const first = authors[0].family || authors[0].given || ''
  if (authors.length === 1) return first
  if (authors.length === 2) return `${first} & ${authors[1].family || authors[1].given || ''}`
  return `${first} et al.`
}

function confidenceClass(confidence) {
  return {
    'ref-import-badge-verified': confidence === 'verified',
    'ref-import-badge-matched': confidence === 'matched',
    'ref-import-badge-unverified': confidence === 'unverified',
    'ref-import-badge-failed': confidence === 'failed',
  }
}

function confidenceLabel(confidence) {
  return {
    verified: t('Verified via CrossRef'),
    matched: t('Matched via CrossRef'),
    unverified: t('Unverified'),
    failed: t('Failed'),
  }[confidence] || confidence
}

function duplicateLabel(matchType) {
  return matchType === 'strong'
    ? t('Strong duplicate')
    : t('Possible duplicate')
}

function matchReasonLabel(reason) {
  return {
    doi: t('Exact DOI match'),
    'title-author-year': t('Title, first author, and year match'),
  }[reason] || reason
}

function statusClass(item) {
  return {
    'ref-import-item-added': item.resolution === 'added',
    'ref-import-item-merged': item.resolution === 'merged',
    'ref-import-item-kept': item.resolution === 'kept',
    'ref-import-item-duplicate': item.resolution === 'pending-duplicate',
  }
}
</script>

<style scoped>
.ref-import-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(7, 10, 18, 0.46);
  backdrop-filter: blur(10px);
}

.ref-import-modal {
  width: min(880px, calc(100vw - 48px));
  max-height: min(78vh, 860px);
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 92%, var(--bg-primary));
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.32);
}

.ref-import-header,
.ref-import-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ref-import-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--fg-primary);
}

.ref-import-subtitle {
  margin-top: 4px;
  font-size: var(--ui-font-caption);
  color: var(--fg-muted);
}

.ref-import-close,
.ref-import-primary,
.ref-import-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: var(--ui-font-caption);
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, opacity 0.16s ease;
}

.ref-import-close {
  width: 28px;
  height: 28px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  color: var(--fg-muted);
}

.ref-import-close:hover {
  color: var(--fg-primary);
  background: var(--bg-hover);
}

.ref-import-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ref-import-chip,
.ref-import-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: var(--ui-font-micro);
  border: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 86%, var(--bg-secondary));
  color: var(--fg-secondary);
}

.ref-import-badge-duplicate {
  border-color: color-mix(in srgb, var(--warning) 24%, transparent);
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 8%, transparent);
}

.ref-import-badge-strong {
  border-color: color-mix(in srgb, var(--warning) 30%, transparent);
}

.ref-import-badge-possible {
  border-style: dashed;
}

.ref-import-badge-source {
  color: var(--fg-muted);
}

.ref-import-badge-verified {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 28%, transparent);
}

.ref-import-badge-matched {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 28%, transparent);
}

.ref-import-badge-unverified {
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 24%, transparent);
}

.ref-import-list {
  overflow: auto;
  display: grid;
  gap: 10px;
  padding-right: 2px;
}

.ref-import-item {
  display: grid;
  gap: 10px;
  padding: 13px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 82%, var(--bg-secondary));
}

.ref-import-item-duplicate {
  border-color: color-mix(in srgb, var(--warning) 18%, transparent);
}

.ref-import-item-added,
.ref-import-item-merged {
  border-color: color-mix(in srgb, var(--success) 18%, transparent);
}

.ref-import-item-top,
.ref-import-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ref-import-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ref-import-item-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg-primary);
}

.ref-import-item-meta,
.ref-import-item-doi,
.ref-import-item-match,
.ref-import-item-reason,
.ref-import-item-status {
  font-size: var(--ui-font-caption);
  color: var(--fg-muted);
}

.ref-import-item-match {
  display: grid;
  gap: 4px;
}

.ref-import-item-match-title {
  color: var(--fg-secondary);
}

.ref-import-item-status-success {
  color: var(--success);
}

.ref-import-primary,
.ref-import-secondary {
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
}

.ref-import-primary {
  color: var(--bg-primary);
  background: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 28%, transparent);
}

.ref-import-primary:disabled {
  opacity: 0.45;
  cursor: default;
}

.ref-import-secondary {
  color: var(--fg-secondary);
  background: transparent;
}

.ref-import-secondary:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}
</style>
