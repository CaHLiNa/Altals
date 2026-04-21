use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

const STATE_FILE: &str = "editor-state.json";
const STATE_VERSION: u64 = 1;
const ROOT_PANE_ID: &str = "pane-root";
const DEFAULT_SPLIT_RATIO: f64 = 0.5;
const MIN_SPLIT_RATIO: f64 = 0.15;
const MAX_SPLIT_RATIO: f64 = 0.85;
const REMOVED_VIRTUAL_TAB_PREFIXES: &[&str] = &["library:", "ref:@"];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorSessionLoadParams {
    #[serde(default)]
    pub workspace_data_dir: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorSessionSaveParams {
    #[serde(default)]
    pub workspace_data_dir: String,
    #[serde(default)]
    pub pane_tree: Value,
    #[serde(default)]
    pub active_pane_id: String,
    #[serde(default)]
    pub legacy_preview_paths: Vec<String>,
    #[serde(default)]
    pub last_context_path: String,
}

fn clamp_ratio(value: f64) -> f64 {
    value.max(MIN_SPLIT_RATIO).min(MAX_SPLIT_RATIO)
}

fn is_preview_path(path: &str) -> bool {
    path.starts_with("preview:")
}

fn preview_source_path_from_path(path: &str) -> String {
    path.strip_prefix("preview:")
        .unwrap_or_default()
        .to_string()
}

fn is_virtual_new_tab(path: &str) -> bool {
    path.starts_with("newtab:")
}

fn is_virtual_draft_tab(path: &str) -> bool {
    path.starts_with("draft:")
}

fn is_removed_virtual_tab_path(path: &str) -> bool {
    REMOVED_VIRTUAL_TAB_PREFIXES
        .iter()
        .any(|prefix| path.starts_with(prefix))
}

fn is_context_candidate_path(path: &str) -> bool {
    !path.is_empty() && !is_virtual_new_tab(path) && !is_preview_path(path)
}

fn make_leaf(id: &str, tabs: Vec<String>, active_tab: Option<String>) -> Value {
    json!({
        "type": "leaf",
        "id": if id.is_empty() { ROOT_PANE_ID } else { id },
        "tabs": tabs,
        "activeTab": active_tab,
    })
}

fn collect_leaves(node: &Value, leaves: &mut Vec<Value>) {
    if node.get("type").and_then(Value::as_str) == Some("leaf") {
        leaves.push(node.clone());
        return;
    }
    if let Some(children) = node.get("children").and_then(Value::as_array) {
        for child in children {
            collect_leaves(child, leaves);
        }
    }
}

fn collect_all_tabs(node: &Value, tabs: &mut Vec<String>) {
    if node.get("type").and_then(Value::as_str) == Some("leaf") {
        for tab in node
            .get("tabs")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|tab| tab.as_str().map(|value| value.to_string()))
        {
            tabs.push(tab);
        }
        return;
    }
    if let Some(children) = node.get("children").and_then(Value::as_array) {
        for child in children {
            collect_all_tabs(child, tabs);
        }
    }
}

fn find_first_leaf(node: &Value) -> Option<Value> {
    if node.get("type").and_then(Value::as_str) == Some("leaf") {
        return Some(node.clone());
    }
    node.get("children")
        .and_then(Value::as_array)
        .and_then(|children| children.iter().find_map(find_first_leaf))
}

fn find_pane(node: &Value, pane_id: &str) -> Option<Value> {
    if node.get("type").and_then(Value::as_str) == Some("leaf")
        && node.get("id").and_then(Value::as_str) == Some(pane_id)
    {
        return Some(node.clone());
    }
    node.get("children")
        .and_then(Value::as_array)
        .and_then(|children| children.iter().find_map(|child| find_pane(child, pane_id)))
}

fn find_context_leaf(node: &Value) -> Option<Value> {
    if node.get("type").and_then(Value::as_str) == Some("leaf") {
        let active_tab = node
            .get("activeTab")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if is_context_candidate_path(active_tab) {
            return Some(node.clone());
        }
    }
    node.get("children")
        .and_then(Value::as_array)
        .and_then(|children| children.iter().find_map(find_context_leaf))
}

fn normalize_legacy_preview_paths(paths: &[String]) -> HashSet<String> {
    paths
        .iter()
        .map(|path| path.trim().to_string())
        .filter(|path| is_preview_path(path))
        .collect()
}

fn is_valid_tab_path(path: &str) -> bool {
    if path.is_empty() || is_removed_virtual_tab_path(path) || is_virtual_draft_tab(path) {
        return false;
    }
    if is_virtual_new_tab(path) {
        return true;
    }

    let target_path = if is_preview_path(path) {
        preview_source_path_from_path(path)
    } else {
        path.to_string()
    };

    !target_path.is_empty() && Path::new(&target_path).exists()
}

fn normalize_tabs_for_save(
    tabs: &[Value],
    preserved_legacy_preview_paths: &HashSet<String>,
) -> Vec<String> {
    tabs.iter()
        .filter_map(Value::as_str)
        .filter(|tab| {
            !is_virtual_draft_tab(tab)
                && !is_removed_virtual_tab_path(tab)
                && (!is_preview_path(tab) || preserved_legacy_preview_paths.contains(*tab))
        })
        .map(|tab| tab.to_string())
        .collect()
}

fn normalize_tabs_for_load(tabs: &[Value]) -> Vec<String> {
    tabs.iter()
        .filter_map(Value::as_str)
        .filter(|tab| is_valid_tab_path(tab))
        .map(|tab| tab.to_string())
        .collect()
}

fn serialize_leaf_for_save(
    node: &Value,
    preserved_legacy_preview_paths: &HashSet<String>,
) -> Option<Value> {
    let tabs = normalize_tabs_for_save(
        &node
            .get("tabs")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default(),
        preserved_legacy_preview_paths,
    );
    if tabs.is_empty() {
        return None;
    }
    let active_tab = node
        .get("activeTab")
        .and_then(Value::as_str)
        .filter(|active_tab| tabs.iter().any(|tab| tab == active_tab))
        .map(|value| value.to_string())
        .or_else(|| tabs.first().cloned());
    Some(make_leaf(
        node.get("id")
            .and_then(Value::as_str)
            .unwrap_or(ROOT_PANE_ID),
        tabs,
        active_tab,
    ))
}

fn serialize_leaf_for_load(node: &Value) -> Option<Value> {
    let tabs = normalize_tabs_for_load(
        &node
            .get("tabs")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default(),
    );
    if tabs.is_empty() {
        return None;
    }
    let active_tab = node
        .get("activeTab")
        .and_then(Value::as_str)
        .filter(|active_tab| tabs.iter().any(|tab| tab == active_tab))
        .map(|value| value.to_string())
        .or_else(|| tabs.first().cloned());
    Some(make_leaf(
        node.get("id")
            .and_then(Value::as_str)
            .unwrap_or(ROOT_PANE_ID),
        tabs,
        active_tab,
    ))
}

fn serialize_pane_tree_for_save(
    node: &Value,
    preserved_legacy_preview_paths: &HashSet<String>,
) -> Option<Value> {
    if node.is_null() {
        return None;
    }

    if node.get("type").and_then(Value::as_str) == Some("leaf") {
        return serialize_leaf_for_save(node, preserved_legacy_preview_paths);
    }

    if node.get("type").and_then(Value::as_str) == Some("split") {
        let children = node
            .get("children")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|child| {
                serialize_pane_tree_for_save(&child, preserved_legacy_preview_paths)
            })
            .collect::<Vec<_>>();

        if children.len() < 2 {
            return children.into_iter().next();
        }

        return Some(json!({
            "type": "split",
            "direction": "vertical",
            "ratio": clamp_ratio(node.get("ratio").and_then(Value::as_f64).unwrap_or(DEFAULT_SPLIT_RATIO)),
            "children": [children[0].clone(), children[1].clone()],
        }));
    }

    None
}

fn normalize_loaded_pane_tree(node: &Value) -> Value {
    if node.is_null() {
        return make_leaf(ROOT_PANE_ID, Vec::new(), None);
    }

    if node.get("type").and_then(Value::as_str) == Some("leaf") {
        return serialize_leaf_for_load(node)
            .unwrap_or_else(|| make_leaf(ROOT_PANE_ID, Vec::new(), None));
    }

    let mut leaves = Vec::new();
    collect_leaves(node, &mut leaves);
    let normalized_leaves = leaves
        .into_iter()
        .filter_map(|leaf| serialize_leaf_for_load(&leaf))
        .collect::<Vec<_>>();

    if normalized_leaves.is_empty() {
        return make_leaf(ROOT_PANE_ID, Vec::new(), None);
    }
    if normalized_leaves.len() == 1 {
        return normalized_leaves[0].clone();
    }

    make_split(
        normalized_leaves[0].clone(),
        normalized_leaves[1].clone(),
        node.get("ratio")
            .and_then(Value::as_f64)
            .unwrap_or(DEFAULT_SPLIT_RATIO),
    )
}

fn make_split(left: Value, right: Value, ratio: f64) -> Value {
    json!({
        "type": "split",
        "direction": "vertical",
        "ratio": clamp_ratio(ratio),
        "children": [left, right],
    })
}

fn build_persisted_editor_state(
    pane_tree: &Value,
    active_pane_id: &str,
    last_context_path: &str,
    legacy_preview_paths: &[String],
) -> Value {
    let preserved = normalize_legacy_preview_paths(legacy_preview_paths);
    json!({
        "version": STATE_VERSION,
        "paneTree": serialize_pane_tree_for_save(pane_tree, &preserved),
        "activePaneId": active_pane_id,
        "lastContextPath": last_context_path,
    })
}

fn normalize_loaded_editor_state(state: &Value) -> Value {
    let pane_tree =
        normalize_loaded_pane_tree(&state.get("paneTree").cloned().unwrap_or(Value::Null));
    let mut all_tabs = Vec::new();
    collect_all_tabs(&pane_tree, &mut all_tabs);
    let open_tabs = all_tabs.iter().cloned().collect::<HashSet<_>>();
    let legacy_preview_paths = all_tabs
        .iter()
        .filter(|tab| is_preview_path(tab))
        .cloned()
        .collect::<Vec<_>>();

    let active_pane_id = state
        .get("activePaneId")
        .and_then(Value::as_str)
        .filter(|pane_id| find_pane(&pane_tree, pane_id).is_some())
        .map(|value| value.to_string())
        .or_else(|| {
            find_first_leaf(&pane_tree).and_then(|leaf| {
                leaf.get("id")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
            })
        })
        .unwrap_or_else(|| ROOT_PANE_ID.to_string());

    let active_pane = find_pane(&pane_tree, &active_pane_id);
    let context_leaf = active_pane
        .as_ref()
        .filter(|leaf| {
            is_context_candidate_path(
                leaf.get("activeTab")
                    .and_then(Value::as_str)
                    .unwrap_or_default(),
            )
        })
        .cloned()
        .or_else(|| find_context_leaf(&pane_tree));

    let last_context_path = state
        .get("lastContextPath")
        .and_then(Value::as_str)
        .filter(|path| is_context_candidate_path(path) && open_tabs.contains(*path))
        .map(|value| value.to_string())
        .or_else(|| {
            context_leaf.as_ref().and_then(|leaf| {
                leaf.get("activeTab")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
            })
        })
        .unwrap_or_default();

    json!({
        "version": STATE_VERSION,
        "paneTree": pane_tree,
        "activePaneId": active_pane_id,
        "legacyPreviewPaths": legacy_preview_paths,
        "lastContextPath": last_context_path,
    })
}

fn state_file_path(workspace_data_dir: &str) -> String {
    format!(
        "{}/{}",
        workspace_data_dir.trim_end_matches('/'),
        STATE_FILE
    )
}

#[tauri::command]
pub async fn editor_session_save(params: EditorSessionSaveParams) -> Result<Value, String> {
    let workspace_data_dir = params.workspace_data_dir.trim();
    if workspace_data_dir.is_empty() {
        return Ok(Value::Null);
    }

    let state = build_persisted_editor_state(
        &params.pane_tree,
        &params.active_pane_id,
        &params.last_context_path,
        &params.legacy_preview_paths,
    );
    let file_path = state_file_path(workspace_data_dir);
    let serialized = serde_json::to_string_pretty(&state)
        .map_err(|error| format!("Failed to serialize editor session: {error}"))?;
    fs::write(&file_path, serialized).map_err(|error| error.to_string())?;
    Ok(normalize_loaded_editor_state(&state))
}

#[tauri::command]
pub async fn editor_session_load(params: EditorSessionLoadParams) -> Result<Value, String> {
    let workspace_data_dir = params.workspace_data_dir.trim();
    if workspace_data_dir.is_empty() {
        return Ok(Value::Null);
    }

    let file_path = state_file_path(workspace_data_dir);
    if !Path::new(&file_path).exists() {
        return Ok(Value::Null);
    }

    let content = fs::read_to_string(&file_path).map_err(|error| error.to_string())?;
    let parsed: Value = serde_json::from_str(&content)
        .map_err(|error| format!("Invalid editor session: {error}"))?;
    if parsed.get("version").and_then(Value::as_u64) != Some(STATE_VERSION) {
        return Ok(Value::Null);
    }

    Ok(normalize_loaded_editor_state(&parsed))
}

#[cfg(test)]
mod tests {
    use super::{build_persisted_editor_state, normalize_loaded_editor_state};
    use serde_json::json;
    use std::fs;

    #[test]
    fn save_state_filters_removed_virtual_tabs() {
        let state = build_persisted_editor_state(
            &json!({
                "type": "leaf",
                "id": "pane-root",
                "tabs": ["draft:1", "newtab:1", "preview:/tmp/a.md", "/tmp/a.md", "library:foo"],
                "activeTab": "/tmp/a.md"
            }),
            "pane-root",
            "/tmp/a.md",
            &["preview:/tmp/a.md".to_string()],
        );

        let tabs = state["paneTree"]["tabs"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        assert_eq!(tabs.len(), 3);
    }

    #[test]
    fn load_state_restores_active_pane_and_context() {
        let file_path = std::env::temp_dir().join("scribeflow-editor-session-test.md");
        fs::write(&file_path, "# test").expect("write temp file");
        let file_path = file_path.to_string_lossy().to_string();

        let state = normalize_loaded_editor_state(&json!({
            "version": 1,
            "activePaneId": "missing-pane",
            "paneTree": {
                "type": "split",
                "ratio": 0.8,
                "children": [
                    { "type": "leaf", "id": "pane-left", "tabs": ["newtab:1"], "activeTab": "newtab:1" },
                    { "type": "leaf", "id": "pane-right", "tabs": [file_path], "activeTab": file_path }
                ]
            }
        }));

        assert_eq!(state["activePaneId"].as_str(), Some("pane-left"));
        assert_eq!(state["lastContextPath"].as_str(), Some(file_path.as_str()));
    }
}
