use crate::extension_host::{
    activate_extension, build_extension_invocation_envelope, invoke_extension_host,
    should_activate_for_event, ExtensionHostRequest, ExtensionHostResponse,
};
use crate::extension_permissions::validate_manifest_permissions;
use crate::extension_registry::find_extension_entry;
use crate::extension_tasks::{
    create_task, mark_task_running, mark_task_succeeded, ExtensionTask, ExtensionTaskRuntimeState,
    ExtensionTaskTarget,
};
use crate::security::WorkspaceScopeState;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionRuntimeDetectParams {
    #[serde(default)]
    pub global_config_dir: String,
    #[serde(default)]
    pub workspace_root: String,
    #[serde(default)]
    pub extension_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionRuntimeDetectResult {
    pub extension_id: String,
    pub runtime_type: String,
    pub command: String,
    pub resolved_path: String,
    pub available: bool,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionTaskStartParams {
    #[serde(default)]
    pub global_config_dir: String,
    #[serde(default)]
    pub workspace_root: String,
    #[serde(default)]
    pub extension_id: String,
    #[serde(default)]
    pub capability: String,
    #[serde(default)]
    pub target: ExtensionTaskTarget,
    #[serde(default)]
    pub settings: Value,
}

#[tauri::command]
pub async fn extension_runtime_detect(
    params: ExtensionRuntimeDetectParams,
) -> Result<ExtensionRuntimeDetectResult, String> {
    let entry = find_extension_entry(
        &params.global_config_dir,
        &params.workspace_root,
        &params.extension_id,
    )?;
    let Some(ref manifest) = entry.manifest else {
        return Err(format!(
            "Extension manifest is invalid: {}",
            params.extension_id
        ));
    };
    Ok(ExtensionRuntimeDetectResult {
        extension_id: entry.id,
        runtime_type: manifest.runtime.runtime_type.clone(),
        command: manifest.main.clone(),
        resolved_path: entry.path.clone(),
        available: manifest.runtime.runtime_type == "extensionHost",
        message: "Extension host runtime available".to_string(),
    })
}

#[tauri::command]
pub async fn extension_task_start(
    params: ExtensionTaskStartParams,
    _scope_state: tauri::State<'_, WorkspaceScopeState>,
    _runtime_state: tauri::State<'_, ExtensionTaskRuntimeState>,
    extension_host_state: tauri::State<'_, crate::extension_host::ExtensionHostState>,
) -> Result<ExtensionTask, String> {
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
        .capabilities
        .iter()
        .any(|capability| capability == &params.capability)
    {
        return Err(format!(
            "Extension {} does not provide capability {}",
            params.extension_id, params.capability
        ));
    }
    if !should_activate_for_event(manifest, &format!("onCapability:{}", params.capability)) {
        return Err(format!(
            "Extension {} does not declare activation for capability {}",
            entry.id, params.capability
        ));
    }

    let task = create_task(
        &entry.id,
        &params.capability,
        params.target.clone(),
        params.settings.clone(),
    )?;

    let _activation = activate_extension(
        extension_host_state.inner(),
        &entry,
        &format!("onCapability:{}", params.capability),
    )?;
    let envelope = build_extension_invocation_envelope(
        &task.id,
        &entry.id,
        &params.capability,
        &params.target.kind,
        &params.target.path,
        &params.settings,
    );
    let response = invoke_extension_host(
        extension_host_state.inner(),
        ExtensionHostRequest::InvokeCapability {
            activation_event: format!("onCapability:{}", params.capability),
            extension_path: std::path::Path::new(&entry.path)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default(),
            manifest_path: entry.path.clone(),
            main_entry: manifest.main.clone(),
            envelope,
        },
    )
    .map_err(|error| format!("Extension host invocation failed: {error}"))?;

    mark_task_running(&task.id)?;
    let completed = mark_task_succeeded(&task.id, Vec::new())
        .map_err(|error| format!("Failed to record extension result: {error}"))?;
    let message = match response {
        ExtensionHostResponse::InvokeCapability(result) => result.message,
        ExtensionHostResponse::Activate(_) => {
            "Unexpected activation response for capability invocation".to_string()
        }
        ExtensionHostResponse::Error { message } => message,
    };
    let _ = fs::write(&completed.log_path, message);
    crate::extension_tasks::get_task(&task.id)
}
