<template>
  <section class="reference-detail-panel">
    <div v-if="!selectedReference" class="reference-detail-panel__empty ui-empty-copy">
      {{ t('Select a reference to inspect its details.') }}
    </div>

    <div v-else class="reference-detail-panel__scroll">
      <div class="reference-detail-panel__headline">
        <div class="reference-detail-panel__type">{{ selectedReferenceTypeLabel }}</div>
        <h2 class="reference-detail-panel__title">{{ selectedReference.title }}</h2>
        <div class="reference-detail-panel__authors">
          {{ selectedReference.authors.join('; ') }}
        </div>
        <div class="reference-detail-panel__citation-key">
          {{ selectedReference.citationKey || t('Missing citation key') }}
        </div>
      </div>

      <div class="reference-detail-panel__section">
        <div class="reference-detail-panel__section-title">{{ t('Citation') }}</div>
        <div class="reference-detail-panel__grid">
          <div class="reference-detail-panel__field">
            <span class="reference-detail-panel__label">{{ t('Year') }}</span>
            <span class="reference-detail-panel__value">{{ selectedReference.year }}</span>
          </div>
          <div class="reference-detail-panel__field">
            <span class="reference-detail-panel__label">{{ t('Source') }}</span>
            <span class="reference-detail-panel__value">{{ selectedReference.source }}</span>
          </div>
          <div class="reference-detail-panel__field">
            <span class="reference-detail-panel__label">{{ t('Identifier') }}</span>
            <span class="reference-detail-panel__value">{{
              selectedReference.identifier || t('Missing')
            }}</span>
          </div>
          <div class="reference-detail-panel__field">
            <span class="reference-detail-panel__label">{{ t('Pages') }}</span>
            <span class="reference-detail-panel__value">{{ selectedReference.pages || '—' }}</span>
          </div>
        </div>
      </div>

      <div class="reference-detail-panel__section">
        <div class="reference-detail-panel__section-title">{{ t('Library') }}</div>
        <div class="reference-detail-panel__grid">
          <div class="reference-detail-panel__field">
            <span class="reference-detail-panel__label">{{ t('PDF') }}</span>
            <span class="reference-detail-panel__value">{{
              selectedReference.hasPdf ? t('Available') : t('Missing')
            }}</span>
          </div>
          <div class="reference-detail-panel__field">
            <span class="reference-detail-panel__label">{{ t('Collections') }}</span>
            <span class="reference-detail-panel__value">{{
              selectedReference.collections.length
                ? selectedReference.collections.join(', ')
                : t('None')
            }}</span>
          </div>
          <div class="reference-detail-panel__field">
            <span class="reference-detail-panel__label">{{ t('Tags') }}</span>
            <span class="reference-detail-panel__value">{{
              selectedReference.tags.length ? selectedReference.tags.join(', ') : t('None')
            }}</span>
          </div>
          <div class="reference-detail-panel__field">
            <span class="reference-detail-panel__label">{{ t('File') }}</span>
            <div class="reference-detail-panel__actions">
              <UiButton
                variant="ghost"
                size="sm"
                :disabled="!canOpenPdf"
                @click="handleOpenPdf"
              >
                {{ t('Open PDF') }}
              </UiButton>
              <UiButton
                variant="ghost"
                size="sm"
                :disabled="!canOpenPdf"
                @click="handleRevealPdf"
              >
                {{ t('Reveal in Finder') }}
              </UiButton>
            </div>
          </div>
        </div>
      </div>

      <div class="reference-detail-panel__section">
        <div class="reference-detail-panel__section-title">{{ t('Abstract') }}</div>
        <div class="reference-detail-panel__field">
          <p class="reference-detail-panel__abstract">{{ selectedReference.abstract }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'
import { getReferenceTypeLabelKey } from '../../domains/references/referencePresentation.js'
import { useReferencesStore } from '../../stores/references'
import { openLocalPath } from '../../services/localFileOpen'
import { revealPathInFileManager } from '../../services/fileTreeSystem'
import UiButton from '../shared/ui/UiButton.vue'

const { t } = useI18n()
const referencesStore = useReferencesStore()

const selectedReference = computed(() => referencesStore.selectedReference)
const selectedReferenceTypeLabel = computed(() =>
  selectedReference.value
    ? t(getReferenceTypeLabelKey(selectedReference.value.typeKey || selectedReference.value.typeLabel))
    : ''
)
const selectedReferencePdfPath = computed(() =>
  String(selectedReference.value?.pdfPath || '').trim()
)
const canOpenPdf = computed(() => selectedReferencePdfPath.value.length > 0)

async function handleOpenPdf() {
  if (!canOpenPdf.value) return
  await openLocalPath(selectedReferencePdfPath.value)
}

async function handleRevealPdf() {
  if (!canOpenPdf.value) return
  await revealPathInFileManager({ path: selectedReferencePdfPath.value })
}
</script>

<style scoped>
.reference-detail-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: transparent;
  color: var(--text-primary);
}

.reference-detail-panel__scroll {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
  padding: 0 0 4px;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    black 18px,
    black calc(100% - 18px),
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    black 18px,
    black calc(100% - 18px),
    transparent 100%
  );
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

.reference-detail-panel__headline {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 10px 2px 12px;
}

.reference-detail-panel__type {
  color: color-mix(in srgb, var(--text-secondary) 72%, transparent);
  font-size: var(--sidebar-font-meta);
  font-weight: var(--workbench-weight-medium);
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
}

.reference-detail-panel__title {
  margin: 0;
  font-size: var(--ui-font-body);
  font-weight: var(--workbench-weight-strong);
  line-height: 1.5;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.reference-detail-panel__authors,
.reference-detail-panel__citation-key {
  color: color-mix(in srgb, var(--text-secondary) 84%, transparent);
  font-size: var(--sidebar-font-body);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.reference-detail-panel__section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reference-detail-panel__section-title {
  padding: 6px 10px 5px;
  color: var(--text-muted);
  opacity: 0.72;
  font-size: var(--sidebar-font-meta);
  font-weight: var(--workbench-weight-medium);
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
}

.reference-detail-panel__grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.reference-detail-panel__field {
  display: grid;
  gap: 2px;
  padding: 4px 10px 4px 12px;
}

.reference-detail-panel__label {
  color: color-mix(in srgb, var(--text-secondary) 72%, transparent);
  font-size: var(--sidebar-font-meta);
  line-height: var(--workbench-line-height-secondary);
}

.reference-detail-panel__value {
  color: var(--text-secondary);
  font-size: var(--sidebar-font-body);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.reference-detail-panel__abstract {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--sidebar-font-body);
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.reference-detail-panel__actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}

.reference-detail-panel__empty {
  padding: 0 12px;
}
</style>
