import { useUsageStore } from '../stores/usage'

export function isUsageBudgetExceeded() {
  return useUsageStore().isOverBudget
}

export function recordUsageEntry(payload) {
  return useUsageStore().record(payload)
}

export function loadUsageSummary() {
  const usageStore = useUsageStore()
  usageStore.loadSettings()
  usageStore.loadMonth()
  usageStore.loadTrend()
}
