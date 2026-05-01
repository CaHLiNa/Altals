use crate::extension_artifacts::ExtensionArtifact;
use crate::extension_host::{
    activate_extension, build_extension_invocation_envelope, invoke_extension_host,
    ExtensionHostActivationResult, ExtensionHostRequest, ExtensionHostResponse,
};
use crate::extension_manifest::ExtensionManifest;
use crate::extension_permissions::validate_manifest_permissions;
use crate::extension_registry::find_extension_entry;
use crate::extension_tasks::{
    create_command_task, get_task, mark_task_failed, mark_task_queued, mark_task_running,
    mark_task_running_with_progress, mark_task_succeeded, ExtensionTask, ExtensionTaskTarget,
};
use crate::security::WorkspaceScopeState;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionCommandExecuteParams {
    #[serde(default)]
    pub global_config_dir: String,
    #[serde(default)]
    pub workspace_root: String,
    #[serde(default)]
    pub extension_id: String,
    #[serde(default)]
    pub command_id: String,
    #[serde(default)]
    pub target: ExtensionTaskTarget,
    #[serde(default)]
    pub settings: Value,
    #[serde(default)]
    pub item_id: String,
    #[serde(default)]
    pub item_handle: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionCommandExecutionResult {
    pub task: ExtensionTask,
    #[serde(default)]
    pub changed_views: Vec<String>,
}

fn extension_dir_from_manifest_path(path: &str) -> String {
    Path::new(path)
        .parent()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default()
}

fn write_task_log(task: &ExtensionTask, message: &str) {
    let _ = fs::write(&task.log_path, message);
}

fn manifest_declares_command(manifest: &ExtensionManifest, command_id: &str) -> bool {
    let normalized_command_id = command_id.trim();
    if normalized_command_id.is_empty() {
        return false;
    }
    manifest
        .contributes
        .commands
        .iter()
        .any(|command| command.command.trim() == normalized_command_id)
}

fn activation_result_registers_command(
    activation_result: &ExtensionHostActivationResult,
    command_id: &str,
) -> bool {
    let normalized_command_id = command_id.trim();
    if normalized_command_id.is_empty() {
        return false;
    }
    activation_result
        .registered_commands
        .iter()
        .any(|command| command.trim() == normalized_command_id)
        || activation_result
            .registered_command_details
            .iter()
            .any(|command| command.command_id.trim() == normalized_command_id)
}

fn command_is_available_for_execution(
    manifest: &ExtensionManifest,
    activation_result: &ExtensionHostActivationResult,
    command_id: &str,
) -> bool {
    let runtime_declared_any_commands = !activation_result.registered_commands.is_empty()
        || !activation_result.registered_command_details.is_empty();

    if runtime_declared_any_commands {
        activation_result_registers_command(activation_result, command_id)
    } else {
        manifest_declares_command(manifest, command_id)
    }
}

fn normalize_artifacts(artifacts: Vec<ExtensionArtifact>) -> Vec<ExtensionArtifact> {
    artifacts
        .into_iter()
        .filter(|artifact| !artifact.path.trim().is_empty())
        .collect()
}

fn normalize_task_state(value: &str) -> &str {
    match value.trim().to_ascii_lowercase().as_str() {
        "queued" => "queued",
        "running" => "running",
        "cancelled" => "cancelled",
        "failed" => "failed",
        _ => "succeeded",
    }
}

#[tauri::command]
pub async fn extension_command_execute(
    params: ExtensionCommandExecuteParams,
    _scope_state: tauri::State<'_, WorkspaceScopeState>,
    task_runtime_state: tauri::State<'_, crate::extension_tasks::ExtensionTaskRuntimeState>,
    extension_host_state: tauri::State<'_, crate::extension_host::ExtensionHostState>,
) -> Result<ExtensionCommandExecutionResult, String> {
    let command_id = params.command_id.trim().to_string();
    if command_id.is_empty() {
        return Err("Extension command id is required".to_string());
    }

    let entry = find_extension_entry(
        &params.global_config_dir,
        &params.workspace_root,
        &params.extension_id,
    )?;
    let Some(manifest) = entry.manifest.as_ref() else {
        return Err(format!(
            "Extension manifest is invalid: {}",
            params.extension_id
        ));
    };
    if entry.status == "invalid" || entry.status == "blocked" {
        return Err(format!("Extension is not runnable: {}", entry.status));
    }
    validate_manifest_permissions(manifest)?;
    if manifest.runtime.runtime_type != "extensionHost" {
        return Err(format!(
            "Only extensionHost runtime is supported: {}",
            manifest.runtime.runtime_type
        ));
    }
    let activation_event = format!("onCommand:{command_id}");
    let task = create_command_task(
        &entry.id,
        &command_id,
        params.target.clone(),
        params.settings.clone(),
    )?;
    task_runtime_state.emit_task_changed(&task);
    let running = mark_task_running(&task.id)?;
    task_runtime_state.emit_task_changed(&running);
    let activated = activate_extension(
        extension_host_state.inner(),
        &params.global_config_dir,
        &params.workspace_root,
        &entry,
        &activation_event,
    );
    let activated = match activated {
        Ok(activation_result) => activation_result,
        Err(error) => {
            let failed = mark_task_failed(&task.id, &error)?;
            task_runtime_state.emit_task_changed(&failed);
            write_task_log(&failed, &error);
            return Err(error);
        }
    };
    if !command_is_available_for_execution(manifest, &activated, &command_id) {
        let message = format!(
            "Extension {} does not register command {} at runtime",
            entry.id, command_id
        );
        let failed = mark_task_failed(&task.id, &message)?;
        task_runtime_state.emit_task_changed(&failed);
        write_task_log(&failed, &message);
        return Err(message);
    }

    let envelope = build_extension_invocation_envelope(
        &task.id,
        &entry.id,
        &params.workspace_root,
        &command_id,
        &params.item_id,
        &params.item_handle,
        &params.target.reference_id,
        "",
        &params.target.kind,
        &params.target.path,
        &params.settings,
    );
    let response = invoke_extension_host(
        extension_host_state.inner(),
        Some(task_runtime_state.inner()),
        ExtensionHostRequest::ExecuteCommand {
            activation_event,
            extension_path: extension_dir_from_manifest_path(&entry.path),
            manifest_path: entry.path.clone(),
            main_entry: manifest.main.clone(),
            command_id,
            envelope,
        },
    );

    match response {
        Ok(ExtensionHostResponse::ExecuteCommand(result)) => {
            let artifacts = normalize_artifacts(result.artifacts);
            let normalized_state = normalize_task_state(&result.task_state);
            let recorded = match normalized_state {
                "queued" => mark_task_queued(&task.id, &result.progress_label, artifacts.clone()),
                "running" => {
                    mark_task_running_with_progress(&task.id, &result.progress_label, artifacts.clone())
                }
                "cancelled" => crate::extension_tasks::mark_task_cancelled(&task.id),
                "failed" => crate::extension_tasks::mark_task_failed(
                    &task.id,
                    if result.message.trim().is_empty() {
                        "Extension command failed"
                    } else {
                        &result.message
                    },
                ),
                _ => mark_task_succeeded(&task.id, artifacts, &result.progress_label),
            }
            .map_err(|error| format!("Failed to record extension result: {error}"))?;
            let _ = task_runtime_state.clear_pid_if_terminal(&recorded);
            task_runtime_state.emit_task_changed(&recorded);
            write_task_log(&recorded, &result.message);
            let task = get_task(&task.id)?;
            Ok(ExtensionCommandExecutionResult {
                task,
                changed_views: result.changed_views,
            })
        }
        Ok(ExtensionHostResponse::Error { message }) => {
            let failed = mark_task_failed(&task.id, &message)?;
            let _ = task_runtime_state.clear_pid_if_terminal(&failed);
            task_runtime_state.emit_task_changed(&failed);
            write_task_log(&failed, &message);
            Err(message)
        }
        Ok(_) => {
            let message = "Unexpected extension host response for command execution".to_string();
            let failed = mark_task_failed(&task.id, &message)?;
            let _ = task_runtime_state.clear_pid_if_terminal(&failed);
            task_runtime_state.emit_task_changed(&failed);
            write_task_log(&failed, &message);
            Err(message)
        }
        Err(error) => {
            let failed = mark_task_failed(&task.id, &error)?;
            let _ = task_runtime_state.clear_pid_if_terminal(&failed);
            task_runtime_state.emit_task_changed(&failed);
            write_task_log(&failed, &error);
            Err(format!("Extension host command execution failed: {error}"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        activation_result_registers_command, command_is_available_for_execution,
        manifest_declares_command, normalize_artifacts,
    };
    use crate::extension_artifacts::ExtensionArtifact;
    use crate::extension_host::{
        ExtensionHostActivationResult, ExtensionHostRegisteredCommand,
    };
    use crate::extension_manifest::{
        parse_extension_manifest_str, ExtensionManifest, CANONICAL_EXTENSION_MANIFEST_FILENAME,
    };

    fn manifest_from_json(value: serde_json::Value) -> ExtensionManifest {
        parse_extension_manifest_str(
            &value.to_string(),
            CANONICAL_EXTENSION_MANIFEST_FILENAME,
        )
        .expect("manifest parse")
        .manifest
    }

    fn activation_result_with_commands(commands: &[&str]) -> ExtensionHostActivationResult {
        ExtensionHostActivationResult {
            extension_id: "example-pdf-extension".to_string(),
            activated: true,
            reason: "Activated by host".to_string(),
            registered_commands: commands.iter().map(|command| command.to_string()).collect(),
            registered_capabilities: Vec::new(),
            registered_views: Vec::new(),
            registered_command_details: commands
                .iter()
                .map(|command| ExtensionHostRegisteredCommand {
                    command_id: command.to_string(),
                    title: command.to_string(),
                    category: String::new(),
                    when: String::new(),
                })
                .collect(),
            registered_menu_actions: Vec::new(),
            registered_view_details: Vec::new(),
        }
    }

    #[test]
    fn manifest_command_lookup_respects_declared_bootstrap_commands() {
        let manifest = manifest_from_json(serde_json::json!({
            "name": "Example PDF Extension",
            "displayName": "Example PDF Extension",
            "version": "0.1.0",
            "main": "./dist/extension.js",
            "contributes": {
                "commands": [{
                    "command": "scribeflow.pdf.translate",
                    "title": "Translate"
                }]
            }
        }));
        assert!(manifest_declares_command(
            &manifest,
            "scribeflow.pdf.translate"
        ));
        assert!(!manifest_declares_command(
            &manifest,
            "examplePdfExtension.captureContext"
        ));
    }

    #[test]
    fn runtime_registered_commands_enable_runtime_only_execution() {
        let manifest = manifest_from_json(serde_json::json!({
            "name": "Example PDF Extension",
            "displayName": "Example PDF Extension",
            "version": "0.1.0",
            "main": "./dist/extension.js",
            "contributes": {
                "commands": [{
                    "command": "scribeflow.pdf.translate",
                    "title": "Translate"
                }]
            }
        }));
        let activation = activation_result_with_commands(&[
            "scribeflow.pdf.translate",
            "examplePdfExtension.captureContext",
        ]);

        assert!(activation_result_registers_command(
            &activation,
            "examplePdfExtension.captureContext"
        ));
        assert!(command_is_available_for_execution(
            &manifest,
            &activation,
            "examplePdfExtension.captureContext"
        ));
    }

    #[test]
    fn runtime_registry_outweighs_stale_manifest_command_lists() {
        let manifest = manifest_from_json(serde_json::json!({
            "name": "Example PDF Extension",
            "displayName": "Example PDF Extension",
            "version": "0.1.0",
            "main": "./dist/extension.js",
            "contributes": {
                "commands": [{
                    "command": "stale.manifest.command",
                    "title": "Stale"
                }]
            }
        }));
        let activation = activation_result_with_commands(&["scribeflow.pdf.translate"]);

        assert!(!command_is_available_for_execution(
            &manifest,
            &activation,
            "stale.manifest.command"
        ));
        assert!(command_is_available_for_execution(
            &manifest,
            &activation,
            "scribeflow.pdf.translate"
        ));
    }

    #[test]
    fn artifact_normalization_drops_entries_without_paths() {
        let artifacts = normalize_artifacts(vec![
            ExtensionArtifact {
                id: "artifact-1".to_string(),
                extension_id: "example-pdf-extension".to_string(),
                task_id: "task-1".to_string(),
                capability: "scribeflow.pdf.translate".to_string(),
                kind: "pdf".to_string(),
                media_type: "application/pdf".to_string(),
                path: "/tmp/translated.pdf".to_string(),
                source_path: "/tmp/paper.pdf".to_string(),
                source_hash: String::new(),
                created_at: "2026-05-01T00:00:00Z".to_string(),
            },
            ExtensionArtifact {
                id: "artifact-2".to_string(),
                extension_id: "example-pdf-extension".to_string(),
                task_id: "task-1".to_string(),
                capability: "scribeflow.pdf.translate".to_string(),
                kind: "pdf".to_string(),
                media_type: "application/pdf".to_string(),
                path: String::new(),
                source_path: "/tmp/paper.pdf".to_string(),
                source_hash: String::new(),
                created_at: "2026-05-01T00:00:00Z".to_string(),
            },
        ]);

        assert_eq!(artifacts.len(), 1);
        assert_eq!(artifacts[0].path, "/tmp/translated.pdf");
    }
}
