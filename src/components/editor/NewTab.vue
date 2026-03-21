<template>
  <WorkspaceStarter :pane-id="paneId" />
</template>

<script setup>
import WorkspaceStarter from './WorkspaceStarter.vue'

defineProps({
  paneId: { type: String, required: true },
})
</script>
