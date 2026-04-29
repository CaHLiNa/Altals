use crate::app_dirs;
use crate::plugin_manifest::{
    normalize_plugin_id, validate_plugin_manifest, PluginManifest, PluginPermissions, PluginRuntime,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
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

#[derive(Debug, Clone)]
pub struct PluginCommandTarget {
    pub executable: PathBuf,
    pub working_dir: PathBuf,
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

fn is_executable_file(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        return fs::metadata(path)
            .map(|metadata| metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false);
    }

    #[cfg(not(unix))]
    {
        true
    }
}

fn plugin_dir_for_manifest_path(manifest_path: &Path) -> Result<PathBuf, String> {
    manifest_path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Plugin manifest has no parent directory".to_string())
}

fn is_within_root(path: &Path, root: &Path) -> bool {
    path == root || path.starts_with(root)
}

pub fn resolve_plugin_command_target(
    manifest_path: &str,
    command: &str,
) -> Result<PluginCommandTarget, String> {
    if !crate::plugin_manifest::is_safe_cli_command_name(command) {
        return Err("Unsafe plugin runtime command".to_string());
    }

    let plugin_dir = plugin_dir_for_manifest_path(Path::new(manifest_path))?;
    let canonical_plugin_dir = fs::canonicalize(&plugin_dir).map_err(|error| error.to_string())?;
    let command_path = canonical_plugin_dir.join(command);
    let canonical_command_path = fs::canonicalize(&command_path).map_err(|error| {
        format!(
            "Plugin runtime command not found in plugin directory: {} ({error})",
            command_path.display()
        )
    })?;

    if !is_within_root(&canonical_command_path, &canonical_plugin_dir) {
        return Err("Plugin runtime command must stay inside the plugin directory".to_string());
    }
    if !is_executable_file(&canonical_command_path) {
        return Err(format!(
            "Plugin runtime command is not executable: {}",
            canonical_command_path.display()
        ));
    }

    Ok(PluginCommandTarget {
        executable: canonical_command_path,
        working_dir: canonical_plugin_dir,
    })
}

pub fn command_exists(manifest_path: &str, command: &str) -> bool {
    resolve_plugin_command_target(manifest_path, command).is_ok()
}

fn status_for_manifest(
    manifest_path: &Path,
    manifest: &PluginManifest,
    errors: &[String],
) -> String {
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

    if manifest.runtime.runtime_type == "cli"
        && !command_exists(&manifest_path.to_string_lossy(), &manifest.runtime.command)
    {
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
    let status = status_for_manifest(&manifest_path, &manifest, &validation.errors);
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

    fn write_runner(dir: &std::path::Path, command: &str) {
        let runner = dir.join(command);
        fs::create_dir_all(runner.parent().expect("runner parent")).expect("runner parent");
        fs::write(&runner, "#!/usr/bin/env sh\nexit 0\n").expect("runner");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(&runner).expect("metadata").permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&runner, permissions).expect("chmod");
        }
    }

    #[test]
    fn registry_discovers_global_and_workspace_plugins() {
        let root = std::env::temp_dir().join(format!(
            "scribeflow-plugin-registry-{}",
            uuid::Uuid::new_v4()
        ));
        let global = root.join("global");
        let workspace = root.join("workspace");
        let global_plugin = global.join("plugins").join("global-plugin");
        let workspace_plugin = workspace
            .join(".scribeflow")
            .join("plugins")
            .join("workspace-plugin");
        write_manifest(&global_plugin, "global-plugin", "bin/runner");
        write_manifest(&workspace_plugin, "workspace-plugin", "bin/runner");
        write_runner(&global_plugin, "bin/runner");
        write_runner(&workspace_plugin, "bin/runner");

        let entries = list_plugin_registry(&PluginRegistryListParams {
            global_config_dir: global.to_string_lossy().to_string(),
            workspace_root: workspace.to_string_lossy().to_string(),
        })
        .expect("list registry");

        assert_eq!(entries.len(), 2);
        assert!(entries
            .iter()
            .any(|entry| entry.scope == "global" && entry.status == "available"));
        assert!(entries
            .iter()
            .any(|entry| entry.scope == "workspace" && entry.status == "available"));
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
        let global_plugin = global.join("plugins").join("pdfmathtranslate");
        let workspace_plugin = workspace
            .join(".scribeflow")
            .join("plugins")
            .join("pdfmathtranslate");
        write_manifest(&global_plugin, "pdfmathtranslate", "bin/runner");
        write_manifest(&workspace_plugin, "pdfmathtranslate", "bin/runner");
        write_runner(&global_plugin, "bin/runner");
        write_runner(&workspace_plugin, "bin/runner");

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

    #[test]
    fn plugin_runner_must_live_inside_plugin_directory() {
        let root = std::env::temp_dir().join(format!(
            "scribeflow-plugin-registry-runner-{}",
            uuid::Uuid::new_v4()
        ));
        let global = root.join("global");
        let plugin = global.join("plugins").join("local-plugin");
        write_manifest(&plugin, "local-plugin", "bin/missing-runner");

        let entries = list_plugin_registry(&PluginRegistryListParams {
            global_config_dir: global.to_string_lossy().to_string(),
            workspace_root: String::new(),
        })
        .expect("list registry");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].status, "missingRuntime");
        fs::remove_dir_all(root).ok();
    }
}
