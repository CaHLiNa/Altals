use crate::app_dirs;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

const EXTENSION_SETTINGS_FILENAME: &str = "extension-settings.json";
const EXTENSION_RUNTIME_STATE_FILENAME: &str = "extension-runtime-state.json";

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionSettings {
    #[serde(default)]
    pub enabled_extension_ids: Vec<String>,
    #[serde(default)]
    pub extension_config: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionRuntimeStateStore {
    #[serde(default)]
    pub global_state: BTreeMap<String, Value>,
    #[serde(default)]
    pub workspace_state: BTreeMap<String, BTreeMap<String, Value>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionRuntimeStateSnapshot {
    #[serde(default)]
    pub global_state: Value,
    #[serde(default)]
    pub workspace_state: Value,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionSettingsLoadResult {
    #[serde(flatten)]
    pub settings: ExtensionSettings,
    pub settings_exists: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionSettingsLoadParams {
    #[serde(default)]
    pub global_config_dir: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionSettingsSaveParams {
    #[serde(default)]
    pub global_config_dir: String,
    #[serde(default)]
    pub settings: ExtensionSettings,
}

fn normalize_root(path: &str) -> String {
    path.trim().trim_end_matches('/').to_string()
}

fn settings_file(global_config_dir: &str) -> Result<std::path::PathBuf, String> {
    let root = normalize_root(global_config_dir);
    if root.is_empty() {
        Ok(app_dirs::data_root_dir()?.join(EXTENSION_SETTINGS_FILENAME))
    } else {
        Ok(Path::new(&root).join(EXTENSION_SETTINGS_FILENAME))
    }
}

fn runtime_state_file(global_config_dir: &str) -> Result<std::path::PathBuf, String> {
    let root = normalize_root(global_config_dir);
    if root.is_empty() {
        Ok(app_dirs::data_root_dir()?.join(EXTENSION_RUNTIME_STATE_FILENAME))
    } else {
        Ok(Path::new(&root).join(EXTENSION_RUNTIME_STATE_FILENAME))
    }
}

fn normalize_settings(settings: ExtensionSettings) -> ExtensionSettings {
    let mut enabled_extension_ids = settings
        .enabled_extension_ids
        .into_iter()
        .map(|id| id.trim().to_ascii_lowercase())
        .filter(|id| !id.is_empty())
        .collect::<Vec<_>>();
    enabled_extension_ids.sort();
    enabled_extension_ids.dedup();

    let extension_config = settings
        .extension_config
        .into_iter()
        .filter_map(|(extension_id, config)| {
            let extension_id = extension_id.trim().to_ascii_lowercase();
            if extension_id.is_empty() {
                None
            } else {
                Some((extension_id, config))
            }
        })
        .collect();

    ExtensionSettings {
        enabled_extension_ids,
        extension_config,
    }
}

fn normalize_state_value(value: Value) -> Value {
    if value.is_object() {
        value
    } else {
        Value::Object(Default::default())
    }
}

fn normalize_runtime_state_store(store: ExtensionRuntimeStateStore) -> ExtensionRuntimeStateStore {
    let global_state = store
        .global_state
        .into_iter()
        .map(|(extension_id, value)| (extension_id.trim().to_ascii_lowercase(), normalize_state_value(value)))
        .filter(|(extension_id, _)| !extension_id.is_empty())
        .collect();

    let workspace_state = store
        .workspace_state
        .into_iter()
        .filter_map(|(workspace_root, states)| {
            let normalized_workspace_root = workspace_root.trim().to_string();
            if normalized_workspace_root.is_empty() {
                return None;
            }
            let normalized_states = states
                .into_iter()
                .map(|(extension_id, value)| (extension_id.trim().to_ascii_lowercase(), normalize_state_value(value)))
                .filter(|(extension_id, _)| !extension_id.is_empty())
                .collect::<BTreeMap<_, _>>();
            Some((normalized_workspace_root, normalized_states))
        })
        .collect();

    ExtensionRuntimeStateStore {
        global_state,
        workspace_state,
    }
}

pub fn load_extension_settings(global_config_dir: &str) -> Result<ExtensionSettings, String> {
    let path = settings_file(global_config_dir)?;
    if !path.exists() {
        return Ok(ExtensionSettings::default());
    }
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let parsed = serde_json::from_str::<ExtensionSettings>(&content)
        .map_err(|error| format!("Failed to parse extension settings: {error}"))?;
    Ok(normalize_settings(parsed))
}

pub fn load_extension_settings_with_state(
    global_config_dir: &str,
) -> Result<ExtensionSettingsLoadResult, String> {
    let path = settings_file(global_config_dir)?;
    let settings_exists = path.exists();
    let settings = load_extension_settings(global_config_dir)?;
    Ok(ExtensionSettingsLoadResult {
        settings,
        settings_exists,
    })
}

pub fn save_extension_settings(
    global_config_dir: &str,
    settings: ExtensionSettings,
) -> Result<ExtensionSettings, String> {
    let normalized = normalize_settings(settings);
    let path = settings_file(global_config_dir)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let serialized = serde_json::to_string_pretty(&normalized)
        .map_err(|error| format!("Failed to serialize extension settings: {error}"))?;
    fs::write(path, serialized).map_err(|error| error.to_string())?;
    Ok(normalized)
}

pub fn load_extension_runtime_state_store(
    global_config_dir: &str,
) -> Result<ExtensionRuntimeStateStore, String> {
    let path = runtime_state_file(global_config_dir)?;
    if !path.exists() {
        return Ok(ExtensionRuntimeStateStore::default());
    }
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let parsed = serde_json::from_str::<ExtensionRuntimeStateStore>(&content)
        .map_err(|error| format!("Failed to parse extension runtime state: {error}"))?;
    Ok(normalize_runtime_state_store(parsed))
}

pub fn save_extension_runtime_state_store(
    global_config_dir: &str,
    store: ExtensionRuntimeStateStore,
) -> Result<ExtensionRuntimeStateStore, String> {
    let normalized = normalize_runtime_state_store(store);
    let path = runtime_state_file(global_config_dir)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let serialized = serde_json::to_string_pretty(&normalized)
        .map_err(|error| format!("Failed to serialize extension runtime state: {error}"))?;
    fs::write(path, serialized).map_err(|error| error.to_string())?;
    Ok(normalized)
}

pub fn load_extension_runtime_state_snapshot(
    global_config_dir: &str,
    workspace_root: &str,
    extension_id: &str,
) -> Result<ExtensionRuntimeStateSnapshot, String> {
    let store = load_extension_runtime_state_store(global_config_dir)?;
    let normalized_extension_id = extension_id.trim().to_ascii_lowercase();
    let normalized_workspace_root = workspace_root.trim().to_string();

    Ok(ExtensionRuntimeStateSnapshot {
        global_state: store
            .global_state
            .get(&normalized_extension_id)
            .cloned()
            .unwrap_or_else(|| Value::Object(Default::default())),
        workspace_state: store
            .workspace_state
            .get(&normalized_workspace_root)
            .and_then(|states| states.get(&normalized_extension_id))
            .cloned()
            .unwrap_or_else(|| Value::Object(Default::default())),
    })
}

pub fn save_extension_runtime_state_snapshot(
    global_config_dir: &str,
    workspace_root: &str,
    extension_id: &str,
    snapshot: ExtensionRuntimeStateSnapshot,
) -> Result<ExtensionRuntimeStateSnapshot, String> {
    let mut store = load_extension_runtime_state_store(global_config_dir)?;
    let normalized_extension_id = extension_id.trim().to_ascii_lowercase();
    let normalized_workspace_root = workspace_root.trim().to_string();

    store
        .global_state
        .insert(normalized_extension_id.clone(), normalize_state_value(snapshot.global_state.clone()));
    if !normalized_workspace_root.is_empty() {
        store
            .workspace_state
            .entry(normalized_workspace_root)
            .or_default()
            .insert(
                normalized_extension_id,
                normalize_state_value(snapshot.workspace_state.clone()),
            );
    }
    save_extension_runtime_state_store(global_config_dir, store)?;
    Ok(ExtensionRuntimeStateSnapshot {
        global_state: normalize_state_value(snapshot.global_state),
        workspace_state: normalize_state_value(snapshot.workspace_state),
    })
}

#[tauri::command]
pub async fn extension_settings_load(
    params: ExtensionSettingsLoadParams,
) -> Result<ExtensionSettingsLoadResult, String> {
    load_extension_settings_with_state(&params.global_config_dir)
}

#[tauri::command]
pub async fn extension_settings_save(
    params: ExtensionSettingsSaveParams,
) -> Result<ExtensionSettings, String> {
    save_extension_settings(&params.global_config_dir, params.settings)
}

#[cfg(test)]
mod tests {
    use super::{
        load_extension_runtime_state_snapshot, load_extension_settings,
        load_extension_settings_with_state, save_extension_runtime_state_snapshot,
        save_extension_settings, ExtensionRuntimeStateSnapshot, ExtensionSettings,
    };
    use std::collections::BTreeMap;
    use std::fs;

    #[test]
    fn saves_normalized_extension_settings() {
        let root = std::env::temp_dir().join(format!(
            "scribeflow-extension-settings-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("root");
        let mut extension_config = BTreeMap::new();
        extension_config.insert(
            " Example-Pdf-Extension ".to_string(),
            serde_json::json!({"targetLang": "zh-CN"}),
        );
        let saved = save_extension_settings(
            &root.to_string_lossy(),
            ExtensionSettings {
                enabled_extension_ids: vec![
                    " Example-Pdf-Extension ".to_string(),
                    "example-pdf-extension".to_string(),
                ],
                extension_config,
            },
        )
        .expect("save");
        assert_eq!(
            saved.enabled_extension_ids,
            vec!["example-pdf-extension".to_string()]
        );
        assert_eq!(
            saved.extension_config.get("example-pdf-extension"),
            Some(&serde_json::json!({"targetLang": "zh-CN"}))
        );
        assert_eq!(
            load_extension_settings(&root.to_string_lossy()).expect("load"),
            saved
        );
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn load_result_marks_missing_settings_file() {
        let root = std::env::temp_dir().join(format!(
            "scribeflow-extension-settings-missing-{}",
            uuid::Uuid::new_v4()
        ));
        let loaded = load_extension_settings_with_state(&root.to_string_lossy()).expect("load");
        assert!(!loaded.settings_exists);
        assert!(loaded.settings.enabled_extension_ids.is_empty());
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn runtime_state_snapshot_roundtrips() {
        let root = std::env::temp_dir().join(format!(
            "scribeflow-extension-runtime-state-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("root");

        let saved = save_extension_runtime_state_snapshot(
            &root.to_string_lossy(),
            "/tmp/workspace-a",
            "Example-Pdf-Extension",
            ExtensionRuntimeStateSnapshot {
                global_state: serde_json::json!({"targetLang": "zh-CN"}),
                workspace_state: serde_json::json!({"lastTarget": "paper.pdf"}),
            },
        )
        .expect("save runtime state");

        assert_eq!(saved.global_state, serde_json::json!({"targetLang": "zh-CN"}));
        assert_eq!(saved.workspace_state, serde_json::json!({"lastTarget": "paper.pdf"}));

        let loaded = load_extension_runtime_state_snapshot(
            &root.to_string_lossy(),
            "/tmp/workspace-a",
            "example-pdf-extension",
        )
        .expect("load runtime state");

        assert_eq!(loaded, saved);
        fs::remove_dir_all(root).ok();
    }
}
