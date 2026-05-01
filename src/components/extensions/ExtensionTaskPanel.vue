<template>
  <div class="extension-task-panel">
    <div v-if="tasks.length === 0" class="extension-task-empty">{{ t('No extension tasks yet') }}</div>
    <div v-for="task in tasks" :key="task.id" class="extension-task-row">
      <div class="extension-task-main">
        <div class="extension-task-title">
          <span>{{ taskTitle(task) }}</span>
          <span class="extension-task-state" :class="`is-${task.state}`">{{ taskStateLabel(task) }}</span>
        </div>
        <div class="extension-task-meta">
          {{ taskMeta(task) }}
          <span v-if="task.error"> · {{ task.error }}</span>
        </div>
        <div v-if="taskProgressSummary(task)" class="extension-task-progress">
          {{ taskProgressSummary(task) }}
        </div>
        <div v-if="task.artifacts?.length" class="extension-artifacts">
          <button
            v-for="artifact in task.artifacts"
            :key="artifact.id || artifact.path"
            type="button"
            class="extension-artifact-link"
            @click="openArtifact(artifact)"
          >
            {{ artifact.kind || t('Artifact') }}
          </button>
        </div>
      </div>
      <div class="extension-task-actions">
        <UiButton
          v-if="task.state === 'running' || task.state === 'queued'"
          variant="secondary"
          size="sm"
          @click="extensionsStore.cancelTask(task.id)"
        >
          {{ t('Cancel') }}
        </UiButton>
        <UiButton
          v-if="task.logPath"
          variant="ghost"
          size="sm"
          @click="extensionsStore.revealArtifact({ path: task.logPath })"
        >
          {{ t('Log') }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'
import { useEditorStore } from '../../stores/editor'
import { useExtensionsStore } from '../../stores/extensions'
import UiButton from '../shared/ui/UiButton.vue'

const { t } = useI18n()
const editorStore = useEditorStore()
const extensionsStore = useExtensionsStore()
const props = defineProps({
  extensionId: { type: String, default: '' },
})
const tasks = computed(() => extensionsStore.recentTasksForExtension(props.extensionId))

function openArtifact(artifact = {}) {
  const path = String(artifact?.path || '')
  const isPdf = artifact?.mediaType === 'application/pdf' || path.toLowerCase().endsWith('.pdf')
  if (isPdf && path) {
    editorStore.openFile(path)
    return
  }
  void extensionsStore.openArtifact(artifact)
}

function taskTitle(task = {}) {
  return String(task.commandId || task.capability || t('Extension task'))
}

function taskStateLabel(task = {}) {
  return String(task?.progress?.label || task?.state || '').trim() || t('Completed')
}

function taskTargetLabel(task = {}) {
  const target = task?.target || {}
  if (target.path) return target.path
  if (target.referenceId) return `ref:${target.referenceId}`
  if (target.kind) return target.kind
  return ''
}

function taskMeta(task = {}) {
  const parts = [String(task.extensionId || t('Unknown extension')).trim()]
  const targetLabel = taskTargetLabel(task)
  if (targetLabel) parts.push(targetLabel)
  return parts.filter(Boolean).join(' · ')
}

function taskProgressSummary(task = {}) {
  const label = String(task?.progress?.label || '').trim()
  const current = Number(task?.progress?.current || 0)
  const total = Number(task?.progress?.total || 0)
  if (total > 0) {
    return `${label || t('Progress')}: ${current}/${total}`
  }
  return label && label !== taskStateLabel(task) ? label : ''
}
</script>

<style scoped>
.extension-task-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.extension-task-empty {
  padding: 14px 16px;
  color: var(--text-muted);
  font-size: 12px;
}

.extension-task-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
}

.extension-task-row:last-child {
  border-bottom: none;
}

.extension-task-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.extension-task-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
}

.extension-task-state {
  font-size: 11px;
  color: var(--text-muted);
}

.extension-task-state.is-succeeded {
  color: var(--success);
}

.extension-task-state.is-failed {
  color: var(--error);
}

.extension-task-meta {
  font-size: 12px;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.extension-task-progress {
  font-size: 11px;
  color: var(--text-muted);
}

.extension-artifacts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.extension-artifact-link {
  border: none;
  padding: 0;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
}

.extension-task-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
</style>
