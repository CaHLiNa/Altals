use crate::fs_commands;
use crate::process_utils::background_command;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionArtifact {
    pub id: String,
    pub extension_id: String,
    pub task_id: String,
    pub capability: String,
    pub kind: String,
    pub media_type: String,
    pub path: String,
    pub source_path: String,
    pub source_hash: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionArtifactActionParams {
    #[serde(default)]
    pub path: String,
}

fn open_path(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Artifact path does not exist: {}", path.display()));
    }

    #[cfg(target_os = "macos")]
    let status = background_command("open").arg(path).status();

    #[cfg(target_os = "windows")]
    let status = background_command("cmd")
        .args(["/C", "start", "", &path.to_string_lossy()])
        .status();

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = background_command("xdg-open").arg(path).status();

    status
        .map_err(|error| error.to_string())
        .and_then(|status| {
            if status.success() {
                Ok(())
            } else {
                Err(format!("Open artifact failed: {status}"))
            }
        })
}

#[tauri::command]
pub async fn extension_artifact_open(params: ExtensionArtifactActionParams) -> Result<(), String> {
    open_path(Path::new(&params.path))
}

#[tauri::command]
pub async fn extension_artifact_reveal(
    params: ExtensionArtifactActionParams,
) -> Result<(), String> {
    fs_commands::reveal_in_file_manager_blocking(Path::new(&params.path))
}
