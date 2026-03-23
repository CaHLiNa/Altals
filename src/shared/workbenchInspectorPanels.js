export const WORKSPACE_INSPECTOR_PANELS = ['outline', 'backlinks']

export const DEFAULT_WORKBENCH_INSPECTOR_PANEL = 'outline'

export const MAX_WORKBENCH_INSPECTOR_PANEL_COUNT = WORKSPACE_INSPECTOR_PANELS.length

export function normalizeWorkbenchInspectorPanel(panel = '') {
  if (WORKSPACE_INSPECTOR_PANELS.includes(panel)) return panel
  return DEFAULT_WORKBENCH_INSPECTOR_PANEL
}
