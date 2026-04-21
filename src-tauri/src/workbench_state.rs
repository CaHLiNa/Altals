use serde::{Deserialize, Serialize};

const WORKSPACE_SURFACE: &str = "workspace";
const SETTINGS_SURFACE: &str = "settings";

const DEFAULT_WORKSPACE_SIDEBAR_PANEL: &str = "files";
const DEFAULT_SETTINGS_SIDEBAR_PANEL: &str = "files";
const DEFAULT_WORKSPACE_INSPECTOR_PANEL: &str = "outline";
const DEFAULT_SETTINGS_INSPECTOR_PANEL: &str = "";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkbenchState {
    #[serde(default = "default_primary_surface")]
    pub primary_surface: String,
    #[serde(default = "default_left_sidebar_open")]
    pub left_sidebar_open: bool,
    #[serde(default = "default_left_sidebar_panel")]
    pub left_sidebar_panel: String,
    #[serde(default = "default_right_sidebar_open")]
    pub right_sidebar_open: bool,
    #[serde(default = "default_right_sidebar_panel")]
    pub right_sidebar_panel: String,
}

impl Default for WorkbenchState {
    fn default() -> Self {
        Self {
            primary_surface: default_primary_surface(),
            left_sidebar_open: default_left_sidebar_open(),
            left_sidebar_panel: default_left_sidebar_panel(),
            right_sidebar_open: default_right_sidebar_open(),
            right_sidebar_panel: default_right_sidebar_panel(),
        }
    }
}

fn default_primary_surface() -> String {
    WORKSPACE_SURFACE.to_string()
}

fn default_left_sidebar_open() -> bool {
    true
}

fn default_left_sidebar_panel() -> String {
    DEFAULT_WORKSPACE_SIDEBAR_PANEL.to_string()
}

fn default_right_sidebar_open() -> bool {
    false
}

fn default_right_sidebar_panel() -> String {
    DEFAULT_WORKSPACE_INSPECTOR_PANEL.to_string()
}

fn allowed_sidebar_panels(surface: &str) -> &'static [&'static str] {
    match surface {
        SETTINGS_SURFACE => &[DEFAULT_SETTINGS_SIDEBAR_PANEL],
        _ => &[DEFAULT_WORKSPACE_SIDEBAR_PANEL, "references"],
    }
}

fn allowed_inspector_panels(surface: &str) -> &'static [&'static str] {
    match surface {
        SETTINGS_SURFACE => &[DEFAULT_SETTINGS_INSPECTOR_PANEL],
        _ => &[DEFAULT_WORKSPACE_INSPECTOR_PANEL],
    }
}

fn default_sidebar_panel_for_surface(surface: &str) -> &'static str {
    match surface {
        SETTINGS_SURFACE => DEFAULT_SETTINGS_SIDEBAR_PANEL,
        _ => DEFAULT_WORKSPACE_SIDEBAR_PANEL,
    }
}

fn default_inspector_panel_for_surface(surface: &str) -> &'static str {
    match surface {
        SETTINGS_SURFACE => DEFAULT_SETTINGS_INSPECTOR_PANEL,
        _ => DEFAULT_WORKSPACE_INSPECTOR_PANEL,
    }
}

pub fn normalize_workbench_surface(value: &str) -> String {
    match value.trim() {
        SETTINGS_SURFACE => SETTINGS_SURFACE.to_string(),
        _ => WORKSPACE_SURFACE.to_string(),
    }
}

pub fn normalize_workbench_sidebar_panel(surface: &str, panel: &str) -> String {
    let normalized_surface = normalize_workbench_surface(surface);
    let normalized_panel = panel.trim();
    if allowed_sidebar_panels(&normalized_surface).contains(&normalized_panel) {
        normalized_panel.to_string()
    } else {
        default_sidebar_panel_for_surface(&normalized_surface).to_string()
    }
}

pub fn normalize_workbench_inspector_panel(surface: &str, panel: &str) -> String {
    let normalized_surface = normalize_workbench_surface(surface);
    let normalized_panel = panel.trim();
    if allowed_inspector_panels(&normalized_surface).contains(&normalized_panel) {
        normalized_panel.to_string()
    } else {
        default_inspector_panel_for_surface(&normalized_surface).to_string()
    }
}

pub fn normalize_workbench_state(state: WorkbenchState) -> WorkbenchState {
    let primary_surface = normalize_workbench_surface(&state.primary_surface);

    WorkbenchState {
        primary_surface: primary_surface.clone(),
        left_sidebar_open: state.left_sidebar_open,
        left_sidebar_panel: normalize_workbench_sidebar_panel(
            &primary_surface,
            &state.left_sidebar_panel,
        ),
        right_sidebar_open: state.right_sidebar_open,
        right_sidebar_panel: normalize_workbench_inspector_panel(
            &primary_surface,
            &state.right_sidebar_panel,
        ),
    }
}

#[tauri::command]
pub async fn workbench_state_normalize(params: WorkbenchState) -> Result<WorkbenchState, String> {
    Ok(normalize_workbench_state(params))
}

#[cfg(test)]
mod tests {
    use super::{
        normalize_workbench_inspector_panel, normalize_workbench_sidebar_panel,
        normalize_workbench_state, WorkbenchState,
    };

    #[test]
    fn sidebar_panel_falls_back_by_surface() {
        assert_eq!(
            normalize_workbench_sidebar_panel("workspace", "missing"),
            "files"
        );
        assert_eq!(
            normalize_workbench_sidebar_panel("settings", "references"),
            "files"
        );
    }

    #[test]
    fn inspector_panel_is_cleared_on_settings_surface() {
        assert_eq!(
            normalize_workbench_inspector_panel("settings", "outline"),
            ""
        );
    }

    #[test]
    fn state_normalization_uses_surface_specific_defaults() {
        let normalized = normalize_workbench_state(WorkbenchState {
            primary_surface: "settings".to_string(),
            left_sidebar_open: true,
            left_sidebar_panel: "references".to_string(),
            right_sidebar_open: true,
            right_sidebar_panel: "outline".to_string(),
        });

        assert_eq!(normalized.primary_surface, "settings");
        assert_eq!(normalized.left_sidebar_panel, "files");
        assert_eq!(normalized.right_sidebar_panel, "");
    }
}
