<template>
  <section
    v-if="task || evidence.length > 0 || artifacts.length > 0 || verifications.length > 0"
    class="ai-task-detail"
  >
    <div class="ai-task-detail__section">
      <div class="ai-task-detail__section-title">{{ t('Task') }}</div>
      <div v-if="task" class="ai-task-detail__task">
        <div class="ai-task-detail__task-title">{{ task.title || t('Research task') }}</div>
        <div v-if="task.goal" class="ai-task-detail__task-goal">{{ task.goal }}</div>
        <div class="ai-task-detail__task-meta">
          <span>{{ task.phase || 'scoping' }}</span>
          <span>{{ task.status || 'active' }}</span>
          <span v-if="task.verificationVerdict">{{ String(task.verificationVerdict).toUpperCase() }}</span>
        </div>
        <div v-if="task.blockedReason" class="ai-task-detail__task-note is-warning">
          {{ task.blockedReason }}
        </div>
        <div v-if="task.resumeHint" class="ai-task-detail__task-note">
          {{ task.resumeHint }}
        </div>
      </div>
      <div v-else class="ai-task-detail__empty">{{ t('No active research task.') }}</div>
    </div>

    <div class="ai-task-detail__section">
      <div class="ai-task-detail__section-title">{{ t('Evidence') }}</div>
      <div v-if="evidence.length > 0" class="ai-task-detail__list">
        <div
          v-for="entry in evidence.slice(0, 4)"
          :key="entry.id"
          class="ai-task-detail__list-item"
        >
          <div class="ai-task-detail__list-title">
            {{ entry.label || entry.citationKey || entry.sourcePath || entry.sourceType }}
          </div>
          <div v-if="entry.excerpt" class="ai-task-detail__list-body">{{ entry.excerpt }}</div>
          <div class="ai-task-detail__list-meta">
            <span v-if="entry.whyRelevant">{{ entry.whyRelevant }}</span>
            <span v-if="entry.sourcePath">{{ entry.sourcePath }}</span>
          </div>
        </div>
      </div>
      <div v-else class="ai-task-detail__empty">{{ t('No evidence captured yet.') }}</div>
    </div>

    <div class="ai-task-detail__section">
      <div class="ai-task-detail__section-title">{{ t('Artifacts') }}</div>
      <div v-if="artifacts.length > 0" class="ai-task-detail__artifact-list">
        <AiArtifactInlineCard
          v-for="artifact in artifacts"
          :key="artifact.id"
          :artifact="artifact"
          :can-apply="canApply(artifact)"
          :can-dismiss="canDismiss(artifact)"
          :can-rollback="canRollback(artifact)"
          :action-label="actionLabel(artifact)"
          @apply="$emit('apply-artifact', $event)"
          @dismiss="$emit('dismiss-artifact', $event)"
          @rollback="$emit('rollback-artifact', $event)"
        />
      </div>
      <div v-else class="ai-task-detail__empty">{{ t('No artifacts yet.') }}</div>
    </div>

    <div class="ai-task-detail__section">
      <div class="ai-task-detail__section-title">{{ t('Verification') }}</div>
      <div v-if="verifications.length > 0" class="ai-task-detail__list">
        <div
          v-for="entry in verifications.slice(0, 4)"
          :key="entry.id"
          class="ai-task-detail__list-item"
        >
          <div class="ai-task-detail__list-title">
            {{ entry.summary || entry.kind }}
          </div>
          <div v-if="Array.isArray(entry.details) && entry.details.length > 0" class="ai-task-detail__list-body">
            {{ entry.details[0] }}
          </div>
          <div class="ai-task-detail__list-meta">
            <span>{{ entry.status }}</span>
            <span v-if="entry.blocking">{{ t('Blocking') }}</span>
          </div>
        </div>
      </div>
      <div v-else class="ai-task-detail__empty">{{ t('No verification records yet.') }}</div>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from '../../i18n'
import AiArtifactInlineCard from './AiArtifactInlineCard.vue'

const props = defineProps({
  task: { type: Object, default: null },
  evidence: { type: Array, default: () => [] },
  artifacts: { type: Array, default: () => [] },
  verifications: { type: Array, default: () => [] },
  enabledToolIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['apply-artifact', 'dismiss-artifact', 'rollback-artifact'])
const { t } = useI18n()

function actionLabel(artifact = null) {
  return String(artifact?.capabilityLabelKey || '').trim() || t('Apply')
}

function canApply(artifact = null) {
  if (!artifact) return false
  const status = String(artifact.status || '').trim()
  if (['applied', 'dismissed', 'rolled-back'].includes(status)) return false
  if (artifact.type === 'reference_patch') return true
  const toolId = String(artifact.capabilityToolId || '').trim()
  if (!toolId) return false
  return Array.isArray(props.enabledToolIds) && props.enabledToolIds.includes(toolId)
}

function canDismiss(artifact = null) {
  if (!artifact) return false
  const status = String(artifact.status || '').trim()
  return status !== 'applied' && status !== 'dismissed' && status !== 'rolled-back'
}

function canRollback(artifact = null) {
  if (!artifact) return false
  return artifact.rollbackSupported === true && String(artifact.status || '').trim() === 'applied'
}
</script>

<style scoped>
.ai-task-detail {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ai-task-detail__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border-color) 34%, transparent);
  background: color-mix(in srgb, var(--surface-base) 74%, transparent);
}

.ai-task-detail__section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}

.ai-task-detail__task,
.ai-task-detail__list,
.ai-task-detail__artifact-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-task-detail__task-title,
.ai-task-detail__list-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.ai-task-detail__task-goal,
.ai-task-detail__list-body,
.ai-task-detail__task-note {
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-task-detail__task-meta,
.ai-task-detail__list-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 10px;
  color: var(--text-tertiary);
}

.ai-task-detail__task-note.is-warning {
  color: var(--error);
}

.ai-task-detail__list-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel-muted) 34%, transparent);
}

.ai-task-detail__empty {
  font-size: 11px;
  color: var(--text-tertiary);
}

@media (max-width: 900px) {
  .ai-task-detail {
    grid-template-columns: 1fr;
  }
}
</style>
