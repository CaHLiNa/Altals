use crate::app_dirs;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

const EXTENSION_SETTINGS_FILENAME: &str = "extension-settings.json";

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionSettings {
    #[serde(default)]
    pub enabled_extension_ids: Vec<String>,
    #[serde(default)]
    pub extension_config: BTreeMap<String, Value>,
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
        load_extension_settings, load_extension_settings_with_state, save_extension_settings,
        ExtensionSettings,
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
}
