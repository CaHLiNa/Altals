use crate::app_dirs;
use crate::fs_commands;
use crate::process_utils::background_command;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginArtifact {
    pub id: String,
    pub plugin_id: String,
    pub job_id: String,
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
pub struct PluginArtifactActionParams {
    #[serde(default)]
    pub path: String,
}

fn normalize_root(path: &str) -> String {
    path.trim().trim_end_matches('/').to_string()
}

pub fn source_file_hash(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    Ok(format!("sha256:{:x}", hasher.finalize()))
}

pub fn plugin_artifact_job_dir(
    global_config_dir: &str,
    workspace_root: &str,
    source_path: &str,
    plugin_id: &str,
    job_id: &str,
) -> Result<PathBuf, String> {
    let workspace = normalize_root(workspace_root);
    let source = normalize_root(source_path);
    let base = if !workspace.is_empty() && source.starts_with(&workspace) {
        Path::new(&workspace)
            .join(".scribeflow")
            .join("artifacts")
            .join("plugins")
    } else if !global_config_dir.trim().is_empty() {
        Path::new(&normalize_root(global_config_dir))
            .join("artifacts")
            .join("plugins")
    } else {
        app_dirs::plugin_artifacts_dir()?
    };

    let dir = base.join(plugin_id).join(job_id);
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn classify_pdf_artifact(path: &Path, total_pdf_count: usize) -> String {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if name.contains("dual") || name.contains("bilingual") {
        "bilingualPdf".to_string()
    } else if name.contains("trans") || name.contains("translated") || total_pdf_count == 1 {
        "translatedPdf".to_string()
    } else {
        "pdf".to_string()
    }
}

pub fn collect_pdf_artifacts(
    output_dir: &Path,
    plugin_id: &str,
    job_id: &str,
    capability: &str,
    source_path: &str,
) -> Result<Vec<PluginArtifact>, String> {
    let source_hash = source_file_hash(Path::new(source_path)).unwrap_or_default();
    let mut pdf_paths = Vec::new();
    if output_dir.exists() {
        for entry in fs::read_dir(output_dir).map_err(|error| error.to_string())? {
            let path = entry.map_err(|error| error.to_string())?.path();
            if path.extension().and_then(|value| value.to_str()) == Some("pdf") {
                pdf_paths.push(path);
            }
        }
    }
    pdf_paths.sort();
    let total_pdf_count = pdf_paths.len();

    Ok(pdf_paths
        .into_iter()
        .map(|path| PluginArtifact {
            id: uuid::Uuid::new_v4().to_string(),
            plugin_id: plugin_id.to_string(),
            job_id: job_id.to_string(),
            capability: capability.to_string(),
            kind: classify_pdf_artifact(&path, total_pdf_count),
            media_type: "application/pdf".to_string(),
            path: path.to_string_lossy().to_string(),
            source_path: source_path.to_string(),
            source_hash: source_hash.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
        })
        .collect())
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
pub async fn plugin_artifact_open(params: PluginArtifactActionParams) -> Result<(), String> {
    open_path(Path::new(&params.path))
}

#[tauri::command]
pub async fn plugin_artifact_reveal(params: PluginArtifactActionParams) -> Result<(), String> {
    fs_commands::reveal_in_file_manager_blocking(Path::new(&params.path))
}

#[cfg(test)]
mod tests {
    use super::{collect_pdf_artifacts, plugin_artifact_job_dir};
    use std::fs;

    #[test]
    fn artifact_root_prefers_workspace_when_source_is_inside_workspace() {
        let root = std::env::temp_dir().join(format!(
            "scribeflow-plugin-artifact-{}",
            uuid::Uuid::new_v4()
        ));
        let workspace = root.join("workspace");
        let global = root.join("global");
        fs::create_dir_all(&workspace).expect("workspace");
        fs::create_dir_all(&global).expect("global");
        let source = workspace.join("paper.pdf");
        fs::write(&source, b"pdf").expect("source");
        let dir = plugin_artifact_job_dir(
            &global.to_string_lossy(),
            &workspace.to_string_lossy(),
            &source.to_string_lossy(),
            "pdfmathtranslate",
            "job-1",
        )
        .expect("artifact dir");
        assert!(dir.starts_with(workspace.join(".scribeflow")));
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn artifact_collection_classifies_bilingual_pdf() {
        let root = std::env::temp_dir().join(format!(
            "scribeflow-plugin-artifact-classify-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("root");
        let source = root.join("source.pdf");
        fs::write(&source, b"source").expect("source");
        fs::write(root.join("paper-dual.pdf"), b"pdf").expect("dual");
        let artifacts = collect_pdf_artifacts(
            &root,
            "pdfmathtranslate",
            "job-1",
            "pdf.translate",
            &source.to_string_lossy(),
        )
        .expect("artifacts");
        assert_eq!(artifacts[0].kind, "bilingualPdf");
        fs::remove_dir_all(root).ok();
    }
}
