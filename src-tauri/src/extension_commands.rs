use crate::extension_host::{
    activate_extension, build_extension_invocation_envelope, invoke_extension_host,
    should_activate_for_event, ExtensionHostRequest, ExtensionHostResponse,
};
use crate::extension_permissions::validate_manifest_permissions;
use crate::extension_registry::find_extension_entry;
use crate::extension_tasks::{
    create_command_task, get_task, mark_task_failed, mark_task_running, mark_task_succeeded,
    ExtensionTask, ExtensionTaskTarget,
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

#[tauri::command]
pub async fn extension_command_execute(
    params: ExtensionCommandExecuteParams,
    _scope_state: tauri::State<'_, WorkspaceScopeState>,
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
    if !manifest
        .contributes
        .commands
        .iter()
        .any(|command| command.command.trim() == command_id)
    {
        return Err(format!(
            "Extension {} does not contribute command {}",
            entry.id, command_id
        ));
    }

    let activation_event = format!("onCommand:{command_id}");
    if !should_activate_for_event(manifest, &activation_event) {
        return Err(format!(
            "Extension {} does not declare activation for command {}",
            entry.id, command_id
        ));
    }

    let task = create_command_task(
        &entry.id,
        &command_id,
        params.target.clone(),
        params.settings.clone(),
    )?;
    let _running = mark_task_running(&task.id)?;
    let activated = activate_extension(extension_host_state.inner(), &entry, &activation_event);
    if let Err(error) = activated {
        let failed = mark_task_failed(&task.id, &error)?;
        write_task_log(&failed, &error);
        return Err(error);
    }

    let envelope = build_extension_invocation_envelope(
        &task.id,
        &entry.id,
        &params.workspace_root,
        &command_id,
        &params.item_id,
        &params.item_handle,
        "",
        &params.target.kind,
        &params.target.path,
        &params.settings,
    );
    let response = invoke_extension_host(
        extension_host_state.inner(),
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
            let completed = mark_task_succeeded(&task.id, Vec::new())
                .map_err(|error| format!("Failed to record extension result: {error}"))?;
            write_task_log(&completed, &result.message);
            let task = get_task(&task.id)?;
            Ok(ExtensionCommandExecutionResult {
                task,
                changed_views: result.changed_views,
            })
        }
        Ok(ExtensionHostResponse::Error { message }) => {
            let failed = mark_task_failed(&task.id, &message)?;
            write_task_log(&failed, &message);
            Err(message)
        }
        Ok(_) => {
            let message = "Unexpected extension host response for command execution".to_string();
            let failed = mark_task_failed(&task.id, &message)?;
            write_task_log(&failed, &message);
            Err(message)
        }
        Err(error) => {
            let failed = mark_task_failed(&task.id, &error)?;
            write_task_log(&failed, &error);
            Err(format!("Extension host command execution failed: {error}"))
        }
    }
}
