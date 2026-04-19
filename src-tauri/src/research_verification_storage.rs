use std::fs;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

use crate::app_dirs;
use crate::research_verification_protocol::ResearchVerificationRecord;

const RESEARCH_VERIFICATIONS_DIR: &str = "research-verifications";

fn verifications_dir() -> Result<PathBuf, String> {
    let dir = app_dirs::data_root_dir()?.join(RESEARCH_VERIFICATIONS_DIR);
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|error| format!("Failed to create research verifications dir: {error}"))?;
    }
    Ok(dir)
}

fn verifications_path_for_workspace(workspace_path: &str) -> Result<PathBuf, String> {
    let normalized = workspace_path.trim();
    if normalized.is_empty() {
        return Err("Workspace path is required for research verifications.".to_string());
    }
    let encoded = URL_SAFE_NO_PAD.encode(normalized.as_bytes());
    Ok(verifications_dir()?.join(format!("{encoded}.json")))
}

fn read_verifications_from_path(path: &Path) -> Result<Vec<ResearchVerificationRecord>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read research verifications: {error}"))?;
    serde_json::from_str::<Vec<ResearchVerificationRecord>>(&content)
        .map_err(|error| format!("Failed to parse research verifications: {error}"))
}

fn write_verifications_to_path(
    path: &Path,
    verifications: &[ResearchVerificationRecord],
) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Research verifications path has no parent directory.".to_string())?;
    if !parent.exists() {
        fs::create_dir_all(parent).map_err(|error| {
            format!("Failed to create research verifications parent dir: {error}")
        })?;
    }
    let temp_path = path.with_extension("json.tmp");
    let serialized = serde_json::to_string_pretty(verifications)
        .map_err(|error| format!("Failed to serialize research verifications: {error}"))?;
    fs::write(&temp_path, serialized)
        .map_err(|error| format!("Failed to write research verifications: {error}"))?;
    fs::rename(&temp_path, path)
        .map_err(|error| format!("Failed to finalize research verifications: {error}"))?;
    Ok(())
}

pub(crate) fn load_workspace_verifications(
    workspace_path: &str,
) -> Result<Vec<ResearchVerificationRecord>, String> {
    let path = verifications_path_for_workspace(workspace_path)?;
    read_verifications_from_path(&path)
}

pub(crate) fn persist_workspace_verifications(
    workspace_path: &str,
    verifications: &[ResearchVerificationRecord],
) -> Result<(), String> {
    let path = verifications_path_for_workspace(workspace_path)?;
    write_verifications_to_path(&path, verifications)
}
