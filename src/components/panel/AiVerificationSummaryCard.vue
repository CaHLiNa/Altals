<template>
  <section v-if="task || verifications.length > 0" class="ai-verification-summary">
    <div class="ai-verification-summary__header">
      <span class="ai-verification-summary__title">{{ t('Verification') }}</span>
      <span
        v-if="verdictLabel"
        class="ai-verification-summary__badge"
        :class="`is-${verdictTone}`"
      >
        {{ verdictLabel }}
      </span>
    </div>

    <div v-if="summaryText" class="ai-verification-summary__summary">
      {{ summaryText }}
    </div>

    <div v-if="resumeHint" class="ai-verification-summary__hint">
      {{ resumeHint }}
    </div>

    <div v-if="recentVerifications.length > 0" class="ai-verification-summary__list">
      <div
        v-for="verification in recentVerifications"
        :key="verification.id"
        class="ai-verification-summary__item"
      >
        <span
          class="ai-verification-summary__dot"
          :class="`is-${String(verification.status || '').toLowerCase()}`"
        ></span>
        <span class="ai-verification-summary__item-text">
          {{ verification.summary || verification.kind }}
        </span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'

const props = defineProps({
  task: { type: Object, default: null },
  verifications: { type: Array, default: () => [] },
})

const { t } = useI18n()

const recentVerifications = computed(() =>
  [...(Array.isArray(props.verifications) ? props.verifications : [])]
    .sort((left, right) => Number(right?.updatedAt || 0) - Number(left?.updatedAt || 0))
    .slice(0, 3)
)

const verdict = computed(() => String(props.task?.verificationVerdict || '').trim().toLowerCase())
const verdictLabel = computed(() => {
  if (verdict.value === 'pass') return 'PASS'
  if (verdict.value === 'block') return 'BLOCK'
  if (verdict.value === 'fail') return 'FAIL'
  return ''
})
const verdictTone = computed(() => {
  if (verdict.value === 'pass') return 'pass'
  if (verdict.value === 'block') return 'block'
  if (verdict.value === 'fail') return 'fail'
  return 'idle'
})
const summaryText = computed(() => String(props.task?.verificationSummary || '').trim())
const resumeHint = computed(() => String(props.task?.resumeHint || '').trim())
</script>

<style scoped>
.ai-verification-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border-color) 32%, transparent);
  background: color-mix(in srgb, var(--surface-base) 72%, transparent);
}

.ai-verification-summary__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ai-verification-summary__title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}

.ai-verification-summary__badge {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.ai-verification-summary__badge.is-pass {
  color: color-mix(in srgb, var(--success) 90%, black 10%);
  background: color-mix(in srgb, var(--success) 14%, transparent);
}

.ai-verification-summary__badge.is-block,
.ai-verification-summary__badge.is-fail {
  color: color-mix(in srgb, var(--error) 90%, black 10%);
  background: color-mix(in srgb, var(--error) 12%, transparent);
}

.ai-verification-summary__summary {
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-secondary);
}

.ai-verification-summary__hint {
  font-size: 10px;
  line-height: 1.45;
  color: var(--text-tertiary);
}

.ai-verification-summary__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-verification-summary__item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}

.ai-verification-summary__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--text-tertiary);
}

.ai-verification-summary__dot.is-verified {
  background: var(--success);
}

.ai-verification-summary__dot.is-failed {
  background: var(--error);
}

.ai-verification-summary__item-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
