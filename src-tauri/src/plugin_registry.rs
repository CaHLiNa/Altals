use crate::app_dirs;
use crate::plugin_manifest::{
    normalize_plugin_id, validate_plugin_manifest, PluginManifest, PluginPermissions, PluginRuntime,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const PLUGIN_MANIFEST_FILENAME: &str = "plugin.json";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginRegistryListParams {
    #[serde(default)]
    pub global_config_dir: String,
    #[serde(default)]
    pub workspace_root: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginRegistryEntry {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub capabilities: Vec<String>,
    pub runtime: PluginRuntime,
    pub permissions: PluginPermissions,
    pub scope: String,
    pub path: String,
    pub status: String,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub manifest: Option<PluginManifest>,
}

fn normalize_root(path: &str) -> String {
    path.trim().trim_end_matches('/').to_string()
}

pub fn global_plugins_root(global_config_dir: &str) -> Result<PathBuf, String> {
    let normalized = normalize_root(global_config_dir);
    if normalized.is_empty() {
        return app_dirs::plugins_dir();
    }
    let dir = Path::new(&normalized).join("plugins");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    }
    Ok(dir)
}

pub fn workspace_plugins_root(workspace_root: &str) -> Option<PathBuf> {
    let normalized = normalize_root(workspace_root);
    if normalized.is_empty() {
        return None;
    }
    Some(Path::new(&normalized).join(".scribeflow").join("plugins"))
}

pub fn command_exists(command: &str) -> bool {
    let command = command.trim();
    if command.is_empty() {
        return false;
    }

    for candidate_dir in app_dirs::candidate_bin_dirs() {
        if candidate_dir.join(command).is_file() {
            return true;
        }
        #[cfg(windows)]
        if candidate_dir.join(format!("{command}.exe")).is_file() {
            return true;
        }
    }

    let Some(path_var) = env::var_os("PATH") else {
        return false;
    };
    for dir in env::split_paths(&path_var) {
        if dir.join(command).is_file() {
            return true;
        }
        #[cfg(windows)]
        if dir.join(format!("{command}.exe")).is_file() {
            return true;
        }
    }
    false
}

fn status_for_manifest(manifest: &PluginManifest, errors: &[String]) -> String {
    if !errors.is_empty() {
        if errors.iter().any(|error| {
            error.contains("Unsupported runtime")
                || error.contains("requires")
                || error.contains("permission")
        }) {
            return "blocked".to_string();
        }
        return "invalid".to_string();
    }

    if manifest.runtime.runtime_type == "cli" && !command_exists(&manifest.runtime.command) {
        return "missingRuntime".to_string();
    }

    "available".to_string()
}

fn invalid_entry(
    scope: &str,
    manifest_path: &Path,
    id_hint: &str,
    error: String,
) -> PluginRegistryEntry {
    PluginRegistryEntry {
        id: normalize_plugin_id(id_hint),
        name: id_hint.to_string(),
        version: String::new(),
        description: String::new(),
        capabilities: Vec::new(),
        runtime: PluginRuntime::default(),
        permissions: PluginPermissions::default(),
        scope: scope.to_string(),
        path: manifest_path.to_string_lossy().to_string(),
        status: "invalid".to_string(),
        warnings: Vec::new(),
        errors: vec![error],
        manifest: None,
    }
}

fn load_entry(scope: &str, plugin_dir: &Path) -> Option<PluginRegistryEntry> {
    let manifest_path = plugin_dir.join(PLUGIN_MANIFEST_FILENAME);
    if !manifest_path.exists() {
        return None;
    }

    let id_hint = plugin_dir
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("plugin");

    let content = match fs::read_to_string(&manifest_path) {
        Ok(content) => content,
        Err(error) => {
            return Some(invalid_entry(
                scope,
                &manifest_path,
                id_hint,
                format!("Failed to read manifest: {error}"),
            ))
        }
    };

    let manifest = match serde_json::from_str::<PluginManifest>(&content) {
        Ok(manifest) => manifest,
        Err(error) => {
            return Some(invalid_entry(
                scope,
                &manifest_path,
                id_hint,
                format!("Failed to parse manifest: {error}"),
            ))
        }
    };

    let validation = validate_plugin_manifest(&manifest);
    let status = status_for_manifest(&manifest, &validation.errors);
    let id = if manifest.id.trim().is_empty() {
        normalize_plugin_id(id_hint)
    } else {
        normalize_plugin_id(&manifest.id)
    };

    Some(PluginRegistryEntry {
        id,
        name: manifest.name.clone(),
        version: manifest.version.clone(),
        description: manifest.description.clone(),
        capabilities: manifest.capabilities.clone(),
        runtime: manifest.runtime.clone(),
        permissions: manifest.permissions.clone(),
        scope: scope.to_string(),
        path: manifest_path.to_string_lossy().to_string(),
        status,
        warnings: validation.warnings,
        errors: validation.errors,
        manifest: Some(manifest),
    })
}

fn scan_root(scope: &str, root: &Path) -> Vec<PluginRegistryEntry> {
    if !root.exists() {
        return Vec::new();
    }

    let Ok(entries) = fs::read_dir(root) else {
        return Vec::new();
    };

    entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .filter_map(|path| load_entry(scope, &path))
        .collect()
}

pub fn list_plugin_registry(
    params: &PluginRegistryListParams,
) -> Result<Vec<PluginRegistryEntry>, String> {
    let global_root = global_plugins_root(&params.global_config_dir)?;
    let mut by_id = BTreeMap::<String, PluginRegistryEntry>::new();

    for entry in scan_root("global", &global_root) {
        by_id.insert(entry.id.clone(), entry);
    }

    if let Some(workspace_root) = workspace_plugins_root(&params.workspace_root) {
        for mut entry in scan_root("workspace", &workspace_root) {
            if by_id.contains_key(&entry.id) {
                entry.warnings.push(
                    "Workspace plugin overrides a global plugin with the same id".to_string(),
                );
            }
            by_id.insert(entry.id.clone(), entry);
        }
    }

    Ok(by_id.into_values().collect())
}

pub fn find_plugin_entry(
    global_config_dir: &str,
    workspace_root: &str,
    plugin_id: &str,
) -> Result<PluginRegistryEntry, String> {
    let normalized = normalize_plugin_id(plugin_id);
    list_plugin_registry(&PluginRegistryListParams {
        global_config_dir: global_config_dir.to_string(),
        workspace_root: workspace_root.to_string(),
    })?
    .into_iter()
    .find(|entry| entry.id == normalized)
    .ok_or_else(|| format!("Plugin not found: {plugin_id}"))
}

#[tauri::command]
pub async fn plugin_registry_list(
    params: PluginRegistryListParams,
) -> Result<Vec<PluginRegistryEntry>, String> {
    list_plugin_registry(&params)
}

#[cfg(test)]
mod tests {
    use super::{list_plugin_registry, PluginRegistryListParams};
    use std::fs;

    fn write_manifest(dir: &std::path::Path, id: &str, command: &str) {
        fs::create_dir_all(dir).expect("create plugin dir");
        fs::write(
            dir.join("plugin.json"),
            serde_json::json!({
                "schemaVersion": 1,
                "id": id,
                "name": id,
                "version": "1.0.0",
                "capabilities": ["pdf.translate"],
                "runtime": { "type": "cli", "command": command },
                "permissions": {
                    "readWorkspaceFiles": true,
                    "writeArtifacts": true,
                    "spawnProcess": true,
                    "network": "none"
                }
            })
            .to_string(),
        )
        .expect("write manifest");
    }

    #[test]
    fn registry_discovers_global_and_workspace_plugins() {
        let root = std::env::temp_dir().join(format!(
            "scribeflow-plugin-registry-{}",
            uuid::Uuid::new_v4()
        ));
        let global = root.join("global");
        let workspace = root.join("workspace");
        write_manifest(
            &global.join("plugins").join("global-plugin"),
            "global-plugin",
            "missing-command",
        );
        write_manifest(
            &workspace
                .join(".scribeflow")
                .join("plugins")
                .join("workspace-plugin"),
            "workspace-plugin",
            "missing-command",
        );

        let entries = list_plugin_registry(&PluginRegistryListParams {
            global_config_dir: global.to_string_lossy().to_string(),
            workspace_root: workspace.to_string_lossy().to_string(),
        })
        .expect("list registry");

        assert_eq!(entries.len(), 2);
        assert!(entries.iter().any(|entry| entry.scope == "global"));
        assert!(entries.iter().any(|entry| entry.scope == "workspace"));
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn workspace_plugin_overrides_global_plugin() {
        let root = std::env::temp_dir().join(format!(
            "scribeflow-plugin-registry-override-{}",
            uuid::Uuid::new_v4()
        ));
        let global = root.join("global");
        let workspace = root.join("workspace");
        write_manifest(
            &global.join("plugins").join("pdfmathtranslate"),
            "pdfmathtranslate",
            "missing-command",
        );
        write_manifest(
            &workspace
                .join(".scribeflow")
                .join("plugins")
                .join("pdfmathtranslate"),
            "pdfmathtranslate",
            "missing-command",
        );

        let entries = list_plugin_registry(&PluginRegistryListParams {
            global_config_dir: global.to_string_lossy().to_string(),
            workspace_root: workspace.to_string_lossy().to_string(),
        })
        .expect("list registry");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].scope, "workspace");
        assert!(entries[0]
            .warnings
            .contains(&"Workspace plugin overrides a global plugin with the same id".to_string()));
        fs::remove_dir_all(root).ok();
    }
}
