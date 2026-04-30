use crate::app_dirs;
use crate::extension_manifest::{
    normalize_extension_id, parse_extension_manifest_str, validate_extension_manifest,
    ExtensionManifest, ExtensionPermissions, ExtensionRuntime,
    CANONICAL_EXTENSION_MANIFEST_FILENAME,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionRegistryListParams {
    #[serde(default)]
    pub global_config_dir: String,
    #[serde(default)]
    pub workspace_root: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionRegistryEntry {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub capabilities: Vec<String>,
    pub runtime: ExtensionRuntime,
    pub permissions: ExtensionPermissions,
    pub scope: String,
    pub path: String,
    pub status: String,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub manifest: Option<ExtensionManifest>,
    pub manifest_format: String,
}

fn normalize_root(path: &str) -> String {
    path.trim().trim_end_matches('/').to_string()
}

pub fn global_extensions_root(global_config_dir: &str) -> Result<PathBuf, String> {
    let normalized = normalize_root(global_config_dir);
    if normalized.is_empty() {
        return app_dirs::extensions_dir();
    }
    let dir = Path::new(&normalized).join("extensions");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    }
    Ok(dir)
}

pub fn workspace_extensions_root(workspace_root: &str) -> Option<PathBuf> {
    let normalized = normalize_root(workspace_root);
    if normalized.is_empty() {
        return None;
    }
    Some(
        Path::new(&normalized)
            .join(".scribeflow")
            .join("extensions"),
    )
}

fn invalid_entry(
    scope: &str,
    manifest_path: &Path,
    id_hint: &str,
    error: String,
) -> ExtensionRegistryEntry {
    ExtensionRegistryEntry {
        id: normalize_extension_id(id_hint),
        name: id_hint.to_string(),
        version: String::new(),
        description: String::new(),
        capabilities: Vec::new(),
        runtime: ExtensionRuntime::default(),
        permissions: ExtensionPermissions::default(),
        scope: scope.to_string(),
        path: manifest_path.to_string_lossy().to_string(),
        status: "invalid".to_string(),
        warnings: Vec::new(),
        errors: vec![error],
        manifest: None,
        manifest_format: CANONICAL_EXTENSION_MANIFEST_FILENAME.to_string(),
    }
}

fn status_for_manifest(_manifest: &ExtensionManifest, errors: &[String]) -> String {
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
    "available".to_string()
}

fn load_entry(scope: &str, extension_dir: &Path) -> Option<ExtensionRegistryEntry> {
    let manifest_path = extension_dir.join(CANONICAL_EXTENSION_MANIFEST_FILENAME);
    if !manifest_path.exists() {
        return None;
    }

    let id_hint = extension_dir
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("extension");

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

    let parsed = match parse_extension_manifest_str(&content, CANONICAL_EXTENSION_MANIFEST_FILENAME)
    {
        Ok(parsed) => parsed,
        Err(error) => return Some(invalid_entry(scope, &manifest_path, id_hint, error)),
    };

    let manifest = parsed.manifest;
    let validation = validate_extension_manifest(&manifest);
    let status = status_for_manifest(&manifest, &validation.errors);
    let id = if manifest.id.trim().is_empty() {
        normalize_extension_id(id_hint)
    } else {
        normalize_extension_id(&manifest.id)
    };

    Some(ExtensionRegistryEntry {
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
        manifest_format: parsed.manifest_format,
    })
}

fn scan_root(scope: &str, root: &Path) -> Vec<ExtensionRegistryEntry> {
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

pub fn list_extension_registry(
    params: &ExtensionRegistryListParams,
) -> Result<Vec<ExtensionRegistryEntry>, String> {
    let global_root = global_extensions_root(&params.global_config_dir)?;
    let mut by_id = BTreeMap::<String, ExtensionRegistryEntry>::new();

    for entry in scan_root("global", &global_root) {
        by_id.insert(entry.id.clone(), entry);
    }

    if let Some(workspace_root) = workspace_extensions_root(&params.workspace_root) {
        for mut entry in scan_root("workspace", &workspace_root) {
            if by_id.contains_key(&entry.id) {
                entry.warnings.push(
                    "Workspace extension overrides a global extension with the same id".to_string(),
                );
            }
            by_id.insert(entry.id.clone(), entry);
        }
    }

    Ok(by_id.into_values().collect())
}

pub fn find_extension_entry(
    global_config_dir: &str,
    workspace_root: &str,
    extension_id: &str,
) -> Result<ExtensionRegistryEntry, String> {
    let normalized = normalize_extension_id(extension_id);
    list_extension_registry(&ExtensionRegistryListParams {
        global_config_dir: global_config_dir.to_string(),
        workspace_root: workspace_root.to_string(),
    })?
    .into_iter()
    .find(|entry| entry.id == normalized)
    .ok_or_else(|| format!("Extension not found: {extension_id}"))
}

#[tauri::command]
pub async fn extension_registry_list(
    params: ExtensionRegistryListParams,
) -> Result<Vec<ExtensionRegistryEntry>, String> {
    list_extension_registry(&params)
}

#[cfg(test)]
mod tests {
    use super::{list_extension_registry, ExtensionRegistryListParams};
    use crate::extension_manifest::CANONICAL_EXTENSION_MANIFEST_FILENAME;
    use std::fs;

    fn write_canonical_manifest(dir: &std::path::Path, id: &str, main: &str) {
        fs::create_dir_all(dir).expect("create extension dir");
        fs::write(
            dir.join(CANONICAL_EXTENSION_MANIFEST_FILENAME),
            serde_json::json!({
                "name": id,
                "displayName": id,
                "version": "1.0.0",
                "description": "Example extension",
                "engines": {
                    "scribeflow": "^1.1.0"
                },
                "main": main,
                "extensionKind": ["workspace"],
                "activationEvents": ["onCommand:test.command"],
                "contributes": {
                    "commands": [{
                        "command": "test.command",
                        "title": "Test Command"
                    }],
                    "capabilities": [{
                        "id": "pdf.translate"
                    }]
                },
                "permissions": {
                    "readWorkspaceFiles": true,
                    "writeArtifacts": true,
                    "spawnProcess": false,
                    "network": "optional"
                }
            })
            .to_string(),
        )
        .expect("write manifest");
    }

    #[test]
    fn registry_discovers_global_and_workspace_extensions() {
        let root = std::env::temp_dir().join(format!(
            "scribeflow-extension-registry-{}",
            uuid::Uuid::new_v4()
        ));
        let global = root.join("global");
        let workspace = root.join("workspace");
        let global_extension = global.join("extensions").join("global-extension");
        let workspace_extension = workspace
            .join(".scribeflow")
            .join("extensions")
            .join("workspace-extension");
        write_canonical_manifest(&global_extension, "global-extension", "./dist/extension.js");
        write_canonical_manifest(
            &workspace_extension,
            "workspace-extension",
            "./dist/extension.js",
        );

        let entries = list_extension_registry(&ExtensionRegistryListParams {
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
    fn workspace_extension_overrides_global_extension() {
        let root = std::env::temp_dir().join(format!(
            "scribeflow-extension-registry-override-{}",
            uuid::Uuid::new_v4()
        ));
        let global = root.join("global");
        let workspace = root.join("workspace");
        let global_extension = global.join("extensions").join("example-extension");
        let workspace_extension = workspace
            .join(".scribeflow")
            .join("extensions")
            .join("example-extension");
        write_canonical_manifest(
            &global_extension,
            "example-extension",
            "./dist/extension.js",
        );
        write_canonical_manifest(
            &workspace_extension,
            "example-extension",
            "./dist/extension.js",
        );

        let entries = list_extension_registry(&ExtensionRegistryListParams {
            global_config_dir: global.to_string_lossy().to_string(),
            workspace_root: workspace.to_string_lossy().to_string(),
        })
        .expect("list registry");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].scope, "workspace");
        assert!(entries[0].warnings.contains(
            &"Workspace extension overrides a global extension with the same id".to_string()
        ));
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn registry_discovers_canonical_extension_manifest() {
        let root = std::env::temp_dir().join(format!(
            "scribeflow-extension-registry-canonical-{}",
            uuid::Uuid::new_v4()
        ));
        let global = root.join("global");
        let extension = global.join("extensions").join("canonical-extension");
        write_canonical_manifest(&extension, "canonical-extension", "./dist/extension.js");

        let entries = list_extension_registry(&ExtensionRegistryListParams {
            global_config_dir: global.to_string_lossy().to_string(),
            workspace_root: String::new(),
        })
        .expect("list registry");

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].manifest_format, "package.json");
        assert_eq!(entries[0].status, "available");
        assert_eq!(entries[0].runtime.runtime_type, "extensionHost");
        fs::remove_dir_all(root).ok();
    }
}
