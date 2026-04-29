use crate::plugin_artifacts::{collect_pdf_artifacts, plugin_artifact_job_dir};
use crate::plugin_jobs::{
    create_job, mark_job_failed, mark_job_running, mark_job_succeeded, PluginJob,
    PluginJobRuntimeState, PluginJobTarget,
};
use crate::plugin_permissions::{validate_manifest_permissions, validate_plugin_input_file_path};
use crate::plugin_registry::{command_exists, find_plugin_entry};
use crate::process_utils::background_tokio_command;
use crate::security::WorkspaceScopeState;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::process::Stdio;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginRuntimeDetectParams {
    #[serde(default)]
    pub global_config_dir: String,
    #[serde(default)]
    pub workspace_root: String,
    #[serde(default)]
    pub plugin_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginRuntimeDetectResult {
    pub plugin_id: String,
    pub runtime_type: String,
    pub command: String,
    pub available: bool,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginJobStartParams {
    #[serde(default)]
    pub global_config_dir: String,
    #[serde(default)]
    pub workspace_root: String,
    #[serde(default)]
    pub plugin_id: String,
    #[serde(default)]
    pub capability: String,
    #[serde(default)]
    pub target: PluginJobTarget,
    #[serde(default)]
    pub settings: Value,
}

fn setting_string(settings: &Value, key: &str, fallback: &str) -> String {
    settings
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn build_pdf_translate_args(
    input_pdf: &str,
    target_language: &str,
    output_dir: &Path,
) -> Vec<String> {
    vec![
        input_pdf.to_string(),
        "-lo".to_string(),
        target_language.to_string(),
        "-o".to_string(),
        output_dir.to_string_lossy().to_string(),
    ]
}

#[tauri::command]
pub async fn plugin_runtime_detect(
    params: PluginRuntimeDetectParams,
) -> Result<PluginRuntimeDetectResult, String> {
    let entry = find_plugin_entry(
        &params.global_config_dir,
        &params.workspace_root,
        &params.plugin_id,
    )?;
    let Some(manifest) = entry.manifest else {
        return Err(format!("Plugin manifest is invalid: {}", params.plugin_id));
    };
    let available =
        manifest.runtime.runtime_type == "cli" && command_exists(&manifest.runtime.command);
    Ok(PluginRuntimeDetectResult {
        plugin_id: entry.id,
        runtime_type: manifest.runtime.runtime_type.clone(),
        command: manifest.runtime.command.clone(),
        available,
        message: if available {
            "Runtime available".to_string()
        } else {
            "Runtime command not found".to_string()
        },
    })
}

#[tauri::command]
pub async fn plugin_job_start(
    params: PluginJobStartParams,
    scope_state: tauri::State<'_, WorkspaceScopeState>,
    runtime_state: tauri::State<'_, PluginJobRuntimeState>,
) -> Result<PluginJob, String> {
    let entry = find_plugin_entry(
        &params.global_config_dir,
        &params.workspace_root,
        &params.plugin_id,
    )?;
    let Some(manifest) = entry.manifest else {
        return Err(format!("Plugin manifest is invalid: {}", params.plugin_id));
    };
    if entry.status == "invalid" || entry.status == "blocked" {
        return Err(format!("Plugin is not runnable: {}", entry.status));
    }
    if manifest.runtime.runtime_type != "cli" {
        return Err(format!(
            "Unsupported runtime for job start: {}",
            manifest.runtime.runtime_type
        ));
    }
    validate_manifest_permissions(&manifest)?;
    if !manifest
        .capabilities
        .iter()
        .any(|capability| capability == &params.capability)
    {
        return Err(format!(
            "Plugin {} does not provide capability {}",
            params.plugin_id, params.capability
        ));
    }
    if !command_exists(&manifest.runtime.command) {
        return Err(format!(
            "Runtime command not found: {}",
            manifest.runtime.command
        ));
    }
    if params.capability != "pdf.translate" {
        return Err(format!(
            "Unsupported capability invocation: {}",
            params.capability
        ));
    }

    let input_path =
        validate_plugin_input_file_path(Some(scope_state.inner()), Path::new(&params.target.path))?;
    let job = create_job(
        &entry.id,
        &params.capability,
        params.target.clone(),
        params.settings.clone(),
    )?;
    let output_dir = plugin_artifact_job_dir(
        &params.global_config_dir,
        &params.workspace_root,
        &input_path.to_string_lossy(),
        &entry.id,
        &job.id,
    )?;
    let target_language = setting_string(&params.settings, "targetLanguage", "zh");
    let args =
        build_pdf_translate_args(&input_path.to_string_lossy(), &target_language, &output_dir);
    let log_path = job.log_path.clone();
    let job_id = job.id.clone();
    let plugin_id = entry.id.clone();
    let capability = params.capability.clone();
    let source_path = input_path.to_string_lossy().to_string();
    let command = manifest.runtime.command.clone();

    mark_job_running(&job.id)?;
    let mut command_handle = background_tokio_command(&command);
    command_handle.args(&args);
    command_handle.stdout(Stdio::piped());
    command_handle.stderr(Stdio::piped());
    let child = match command_handle.spawn() {
        Ok(child) => child,
        Err(error) => {
            let message = format!("Failed to start plugin command: {error}");
            let _ = mark_job_failed(&job_id, &message);
            return Err(message);
        }
    };
    if let Some(pid) = child.id() {
        runtime_state.register_pid(&job_id, pid)?;
    }
    let runtime_state_handle = runtime_state.inner().clone();

    tauri::async_runtime::spawn(async move {
        let output = child.wait_with_output().await;
        let _ = runtime_state_handle.unregister_pid(&job_id);

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                let log = format!(
                    "$ {} {}\n\n[stdout]\n{}\n\n[stderr]\n{}",
                    command,
                    args.join(" "),
                    stdout,
                    stderr
                );
                if let Some(parent) = Path::new(&log_path).parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let _ = fs::write(&log_path, log);
                if output.status.success() {
                    match collect_pdf_artifacts(
                        &output_dir,
                        &plugin_id,
                        &job_id,
                        &capability,
                        &source_path,
                    ) {
                        Ok(artifacts) => {
                            let _ = mark_job_succeeded(&job_id, artifacts);
                        }
                        Err(error) => {
                            let _ = mark_job_failed(&job_id, &error);
                        }
                    }
                } else {
                    let detail = if !stderr.trim().is_empty() {
                        stderr.trim().to_string()
                    } else if !stdout.trim().is_empty() {
                        stdout.trim().to_string()
                    } else {
                        output.status.to_string()
                    };
                    let _ = mark_job_failed(&job_id, &detail);
                }
            }
            Err(error) => {
                let _ = mark_job_failed(&job_id, &error.to_string());
            }
        }
    });

    crate::plugin_jobs::get_job(&job.id)
}

#[cfg(test)]
mod tests {
    use super::build_pdf_translate_args;
    use std::path::Path;

    #[test]
    fn builds_pdf_translate_args_without_shell() {
        let args = build_pdf_translate_args("/tmp/a.pdf", "zh", Path::new("/tmp/out"));
        assert_eq!(
            args,
            vec![
                "/tmp/a.pdf".to_string(),
                "-lo".to_string(),
                "zh".to_string(),
                "-o".to_string(),
                "/tmp/out".to_string()
            ]
        );
    }
}
