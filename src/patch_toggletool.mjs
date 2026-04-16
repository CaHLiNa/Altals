import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('/Users/math173sr/Documents/GitHub项目/Altals/src/components/settings/SettingsAi.vue', 'utf-8');

// We need to add the import to `useToastStore`.
if (!content.includes('useToastStore')) {
  // Add import near the top of <script setup>
  content = content.replace(
    "import { computed, onMounted, ref } from 'vue'",
    "import { computed, onMounted, ref } from 'vue'\nimport { useToastStore } from '../../stores/toast'"
  );
}

// Add const toastStore = useToastStore() near the top of setup function body
if (!content.includes('const toastStore = useToastStore()')) {
  content = content.replace(
    "const aiStore = useAiStore()",
    "const aiStore = useAiStore()\nconst toastStore = useToastStore()"
  );
}

// Update toggleTool to use toast instead of globalError/globalSuccess
content = content.replace(
  /async function toggleTool\([\s\S]*?\}\n\}/,
  `async function toggleTool(toolId = '', nextValue = false) {
  const next = new Set(loadedEnabledTools.value)
  if (nextValue) next.add(toolId)
  else next.delete(toolId)
  loadedEnabledTools.value = [...next]

  try {
    await saveAiConfig(buildConfig())
    await aiStore.refreshProviderState()
    toastStore.show(t('Tool registry updated.'))
  } catch (error) {
    toastStore.show(normalizeErrorMessage(error, t('Failed to update tool registry.')), { type: 'error' })
  }
}`
);

// We should also replace the unstyled .settings-inline-message CSS for the global messages if they lack styles.
// Wait, looking at the screenshot, "工具能力已更新。" actually looks like a dark box because SettingsAi.vue inherited nothing or only default.

writeFileSync('/Users/math173sr/Documents/GitHub项目/Altals/src/components/settings/SettingsAi.vue', content);
