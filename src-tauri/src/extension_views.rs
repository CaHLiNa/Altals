use crate::extension_host::{
    build_extension_invocation_envelope, invoke_extension_host, ExtensionHostRequest,
    ExtensionHostResponse, ExtensionHostState, ExtensionHostViewResolveResult,
};
use crate::extension_registry::find_extension_entry;
use crate::security::WorkspaceScopeState;
use serde::Deserialize;
use serde_json::Value;
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionViewResolveParams {
    #[serde(default)]
    pub global_config_dir: String,
    #[serde(default)]
    pub workspace_root: String,
    #[serde(default)]
    pub extension_id: String,
    #[serde(default)]
    pub view_id: String,
    #[serde(default)]
    pub parent_item_id: String,
    #[serde(default)]
    pub command_id: String,
    #[serde(default)]
    pub target_kind: String,
    #[serde(default)]
    pub reference_id: String,
    #[serde(default)]
    pub target_path: String,
    #[serde(default)]
    pub settings: Value,
}

fn extension_dir_from_manifest_path(path: &str) -> String {
    Path::new(path)
        .parent()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default()
}

fn locale_for_extension_call(global_config_dir: &str) -> String {
    crate::workspace_preferences::read_workspace_preferences(global_config_dir)
        .ok()
        .flatten()
        .map(|preferences| preferences.preferred_locale)
        .map(|preference| crate::i18n_runtime::resolve_effective_locale(&preference))
        .unwrap_or_else(|| crate::i18n_runtime::resolve_effective_locale("system"))
}

#[tauri::command]
pub async fn extension_view_resolve(
    params: ExtensionViewResolveParams,
    _scope_state: tauri::State<'_, WorkspaceScopeState>,
    state: tauri::State<'_, ExtensionHostState>,
) -> Result<ExtensionHostViewResolveResult, String> {
    let view_id = params.view_id.trim().to_string();
    if view_id.is_empty() {
        return Err("Extension view id is required".to_string());
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
    let declared = manifest
        .contributes
        .views
        .values()
        .flat_map(|views| views.iter())
        .any(|view| view.id.trim() == view_id);
    if !declared {
        return Err(format!("Extension view is not declared: {view_id}"));
    }

    let activation_event = format!("onView:{view_id}");
    crate::extension_host::activate_extension(
        state.inner(),
        &params.global_config_dir,
        &params.workspace_root,
        &entry,
        &activation_event,
    )?;

    let envelope = build_extension_invocation_envelope(
        "",
        &entry.id,
        &params.workspace_root,
        &params.command_id,
        "",
        "",
        &params.reference_id,
        "",
        &params.target_kind,
        &params.target_path,
        &params.settings,
        &locale_for_extension_call(&params.global_config_dir),
    );
    match invoke_extension_host(
        state.inner(),
        None,
        ExtensionHostRequest::ResolveView {
            activation_event,
            extension_path: extension_dir_from_manifest_path(&entry.path),
            manifest_path: entry.path.clone(),
            main_entry: manifest.main.clone(),
            view_id,
            parent_item_id: params.parent_item_id.trim().to_string(),
            envelope,
        },
    )? {
        ExtensionHostResponse::ResolveView(result) => Ok(result),
        _ => Err("Unexpected extension host response for view resolution".to_string()),
    }
}
