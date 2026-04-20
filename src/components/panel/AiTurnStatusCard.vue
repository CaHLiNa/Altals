<template>
  <AiRuntimeStateCard
    :visible="!!turn"
    :tone="tone"
    :title="title"
    :body="body"
    :items="items"
    :max-visible-items="4"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'
import AiRuntimeStateCard from './AiRuntimeStateCard.vue'

const props = defineProps({
  turn: { type: Object, default: null },
})

const { t } = useI18n()

const statusLabel = computed(() => {
  const status = String(props.turn?.status || '').trim().toLowerCase()
  switch (status) {
    case 'awaiting-permission':
      return t('Awaiting permission')
    case 'awaiting-user-input':
      return t('Awaiting user input')
    case 'awaiting-plan-exit':
      return t('Awaiting plan confirmation')
    case 'responding':
      return t('Responding')
    case 'running':
      return t('Running')
    case 'completed':
      return t('Completed')
    case 'failed':
      return t('Failed')
    case 'interrupted':
      return t('Interrupted')
    default:
      return t('Preparing')
  }
})

const tone = computed(() => {
  const status = String(props.turn?.status || '').trim().toLowerCase()
  if (status === 'failed' || status === 'interrupted') return 'warning'
  if (status.startsWith('awaiting')) return 'accent'
  return 'info'
})

const title = computed(() => {
  const label = String(props.turn?.label || '').trim()
  return label || t('Active turn')
})

const body = computed(() => {
  const summary = String(props.turn?.summary || '').trim()
  if (summary) return summary
  return statusLabel.value
})

const items = computed(() => {
  if (!props.turn) return []
  const items = [
    {
      key: 'status',
      label: t('Status'),
      detail: statusLabel.value,
    },
  ]
  const phase = String(props.turn?.phase || '').trim()
  if (phase) {
    items.push({
      key: 'phase',
      label: t('Phase'),
      detail: phase,
    })
  }
  const pendingKind = String(props.turn?.pendingRequestKind || '').trim()
  if (pendingKind) {
    items.push({
      key: 'pending',
      label: t('Pending'),
      detail: pendingKind,
    })
  }
  const lastToolName = String(props.turn?.lastToolName || '').trim()
  if (lastToolName) {
    items.push({
      key: 'tool',
      label: t('Tool'),
      detail: lastToolName,
    })
  }
  const transport = String(props.turn?.transport || '').trim()
  if (transport) {
    items.push({
      key: 'transport',
      label: t('Transport'),
      detail: transport,
    })
  }
  return items
})
</script>
