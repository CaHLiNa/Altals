use crate::extension_manifest::ExtensionManifest;
use crate::extension_registry::{find_extension_entry, ExtensionRegistryEntry};
use crate::extension_settings::load_extension_runtime_state_snapshot;
use crate::extension_settings::load_extension_settings;
use crate::extension_settings::save_extension_runtime_state_snapshot;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
#[cfg(not(test))]
use std::process::{Child, ChildStdin, ChildStdout};
use std::sync::{Arc, Mutex};
#[cfg(not(test))]
use std::time::{Duration, Instant};
#[cfg(not(test))]
use tauri::Emitter;

#[cfg(not(test))]
use crate::app_dirs;
#[cfg(not(test))]
use crate::process_utils::background_command;
#[cfg(not(test))]
use std::process::Stdio;

const EXTENSION_HOST_ARG: &str = "--extension-host";
#[cfg(not(test))]
pub const EXTENSION_VIEW_CHANGED_EVENT: &str = "extension-view-changed";
#[cfg(not(test))]
pub const EXTENSION_VIEW_STATE_CHANGED_EVENT: &str = "extension-view-state-changed";
#[cfg(not(test))]
pub const EXTENSION_VIEW_REVEAL_REQUESTED_EVENT: &str = "extension-view-reveal-requested";
#[cfg(not(test))]
pub const EXTENSION_WINDOW_MESSAGE_EVENT: &str = "extension-window-message";
#[cfg(not(test))]
const BUILTIN_NODE_HOST_RELATIVE_PATH: &str =
    "src-tauri/resources/extension-host/extension-host.mjs";

#[cfg(not(test))]
#[derive(Default)]
struct ExtensionHostProcess {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    stdout: Option<BufReader<ChildStdout>>,
}

#[derive(Clone)]
pub struct ExtensionHostState {
    activated_extensions: Arc<Mutex<HashSet<String>>>,
    ui_requests: Arc<Mutex<HashMap<String, ExtensionHostUiRequestStatus>>>,
    activation_context: Arc<Mutex<HashMap<String, (String, String)>>>,
    #[cfg(not(test))]
    process: Arc<Mutex<ExtensionHostProcess>>,
    #[cfg(not(test))]
    app_handle: Arc<Mutex<Option<tauri::AppHandle>>>,
}

impl Default for ExtensionHostState {
    fn default() -> Self {
        Self {
            activated_extensions: Arc::new(Mutex::new(HashSet::new())),
            ui_requests: Arc::new(Mutex::new(HashMap::new())),
            activation_context: Arc::new(Mutex::new(HashMap::new())),
            #[cfg(not(test))]
            process: Arc::new(Mutex::new(ExtensionHostProcess::default())),
            #[cfg(not(test))]
            app_handle: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
enum ExtensionHostUiRequestStatus {
    #[cfg_attr(test, allow(dead_code))]
    Pending,
    Completed { cancelled: bool, result: Value },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostSummary {
    pub available: bool,
    pub runtime: String,
    pub activated_extensions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostActivationResult {
    pub extension_id: String,
    pub activated: bool,
    pub reason: String,
    pub registered_commands: Vec<String>,
    pub registered_capabilities: Vec<String>,
    pub registered_views: Vec<String>,
    #[serde(default)]
    pub registered_command_details: Vec<ExtensionHostRegisteredCommand>,
    #[serde(default)]
    pub registered_view_details: Vec<ExtensionHostRegisteredView>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostRegisteredCommand {
    pub command_id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub when: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostRegisteredView {
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub when: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostActivateParams {
    #[serde(default)]
    pub global_config_dir: String,
    #[serde(default)]
    pub workspace_root: String,
    #[serde(default)]
    pub extension_id: String,
    #[serde(default)]
    pub activation_event: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostActivationState {
    #[serde(default)]
    pub settings: Value,
    #[serde(default)]
    pub global_state: Value,
    #[serde(default)]
    pub workspace_state: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostInvocationEnvelope {
    pub task_id: String,
    pub extension_id: String,
    #[serde(default)]
    pub workspace_root: String,
    #[serde(default)]
    pub command_id: String,
    #[serde(default)]
    pub item_id: String,
    #[serde(default)]
    pub item_handle: String,
    pub capability: String,
    pub target_kind: String,
    pub target_path: String,
    pub settings_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", tag = "method", content = "params")]
pub enum ExtensionHostRequest {
    Activate {
        extension_id: String,
        activation_event: String,
        extension_path: String,
        manifest_path: String,
        main_entry: String,
        #[serde(default)]
        activation_state: ExtensionHostActivationState,
    },
    InvokeCapability {
        activation_event: String,
        extension_path: String,
        manifest_path: String,
        main_entry: String,
        envelope: ExtensionHostInvocationEnvelope,
    },
    ExecuteCommand {
        activation_event: String,
        extension_path: String,
        manifest_path: String,
        main_entry: String,
        command_id: String,
        envelope: ExtensionHostInvocationEnvelope,
    },
    ResolveView {
        activation_event: String,
        extension_path: String,
        manifest_path: String,
        main_entry: String,
        view_id: String,
        #[serde(default)]
        parent_item_id: String,
        envelope: ExtensionHostInvocationEnvelope,
    },
    RespondUiRequest {
        request_id: String,
        #[serde(default)]
        cancelled: bool,
        #[serde(default)]
        result: Value,
    },
    NotifyViewSelection {
        extension_id: String,
        view_id: String,
        #[serde(default)]
        item_handle: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostCapabilityResult {
    pub accepted: bool,
    pub message: String,
    pub progress_label: String,
    #[serde(default)]
    pub changed_views: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostViewItem {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub handle: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tooltip: String,
    #[serde(default)]
    pub context_value: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub command_id: String,
    #[serde(default)]
    pub command_arguments: Vec<Value>,
    #[serde(default)]
    pub collapsible_state: String,
    #[serde(default)]
    pub children: Vec<ExtensionHostViewItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostViewResolveResult {
    pub view_id: String,
    #[serde(default)]
    pub parent_item_id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub badge_value: Option<u32>,
    #[serde(default)]
    pub badge_tooltip: String,
    #[serde(default)]
    pub items: Vec<ExtensionHostViewItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostViewChangedEvent {
    pub extension_id: String,
    #[serde(default)]
    pub workspace_root: String,
    #[serde(default)]
    pub view_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostViewStateChangedEvent {
    pub extension_id: String,
    #[serde(default)]
    pub workspace_root: String,
    pub view_id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub badge_value: Option<u32>,
    #[serde(default)]
    pub badge_tooltip: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostViewRevealRequestedEvent {
    pub extension_id: String,
    #[serde(default)]
    pub workspace_root: String,
    pub view_id: String,
    pub item_handle: String,
    #[serde(default)]
    pub parent_handles: Vec<String>,
    #[serde(default)]
    pub focus: bool,
    #[serde(default)]
    pub select: bool,
    #[serde(default)]
    pub expand: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostQuickPickItem {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub detail: String,
    #[serde(default)]
    pub picked: bool,
    #[serde(default)]
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostWindowInputRequestedEvent {
    pub request_id: String,
    pub extension_id: String,
    #[serde(default)]
    pub workspace_root: String,
    pub kind: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub prompt: String,
    #[serde(default)]
    pub placeholder: String,
    #[serde(default)]
    pub value: String,
    #[serde(default)]
    pub password: bool,
    #[serde(default)]
    pub can_pick_many: bool,
    #[serde(default)]
    pub items: Vec<ExtensionHostQuickPickItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostUiRequestAcknowledgement {
    pub request_id: String,
    pub accepted: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostRespondUiRequestParams {
    #[serde(default)]
    pub request_id: String,
    #[serde(default)]
    pub cancelled: bool,
    #[serde(default)]
    pub result: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostRespondUiRequestResult {
    pub request_id: String,
    pub accepted: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostNotifyViewSelectionParams {
    #[serde(default)]
    pub extension_id: String,
    #[serde(default)]
    pub view_id: String,
    #[serde(default)]
    pub item_handle: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostViewSelectionAcknowledgement {
    pub extension_id: String,
    pub view_id: String,
    pub accepted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostWindowMessageEvent {
    pub extension_id: String,
    #[serde(default)]
    pub workspace_root: String,
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionHostStateChangedEvent {
    pub extension_id: String,
    #[serde(default)]
    pub workspace_root: String,
    #[serde(default)]
    pub global_state: Value,
    #[serde(default)]
    pub workspace_state: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", tag = "kind", content = "payload")]
pub enum ExtensionHostResponse {
    Activate(ExtensionHostActivationResult),
    InvokeCapability(ExtensionHostCapabilityResult),
    ExecuteCommand(ExtensionHostCapabilityResult),
    ResolveView(ExtensionHostViewResolveResult),
    ViewChanged(ExtensionHostViewChangedEvent),
    ViewStateChanged(ExtensionHostViewStateChangedEvent),
    ViewRevealRequested(ExtensionHostViewRevealRequestedEvent),
    WindowInputRequested(ExtensionHostWindowInputRequestedEvent),
    AcknowledgeUiRequest(ExtensionHostUiRequestAcknowledgement),
    AcknowledgeViewSelection(ExtensionHostViewSelectionAcknowledgement),
    StateChanged(ExtensionHostStateChangedEvent),
    WindowMessage(ExtensionHostWindowMessageEvent),
    Error { message: String },
}

fn resolve_extension_path(entry: &ExtensionRegistryEntry) -> Result<PathBuf, String> {
    Path::new(&entry.path)
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Extension manifest has no parent directory".to_string())
}

#[cfg(not(test))]
fn resolve_builtin_node_host_script() -> Result<PathBuf, String> {
    let cwd_candidate = std::env::current_dir()
        .map_err(|error| format!("Failed to read current directory: {error}"))?
        .join(BUILTIN_NODE_HOST_RELATIVE_PATH);
    if cwd_candidate.exists() {
        return Ok(cwd_candidate);
    }

    let data_root_candidate = app_dirs::data_root_dir()?
        .join("resources")
        .join("extension-host")
        .join("extension-host.mjs");
    if data_root_candidate.exists() {
        return Ok(data_root_candidate);
    }

    Err(format!(
        "Built-in extension host script not found: {}",
        BUILTIN_NODE_HOST_RELATIVE_PATH
    ))
}

pub fn extension_host_summary(state: &ExtensionHostState) -> Result<ExtensionHostSummary, String> {
    let activated = state
        .activated_extensions
        .lock()
        .map_err(|_| "Failed to access extension host state".to_string())?;
    Ok(ExtensionHostSummary {
        available: true,
        runtime: "node-extension-host-persistent".to_string(),
        activated_extensions: activated.iter().cloned().collect(),
    })
}

pub fn activate_extension(
    state: &ExtensionHostState,
    global_config_dir: &str,
    workspace_root: &str,
    entry: &ExtensionRegistryEntry,
    activation_event: &str,
) -> Result<ExtensionHostActivationResult, String> {
    let Some(manifest) = entry.manifest.as_ref() else {
        return Err(format!("Extension manifest is invalid: {}", entry.id));
    };
    if manifest.runtime.runtime_type != "extensionHost" {
        return Err(format!(
            "Extension {} does not use extensionHost runtime",
            entry.id
        ));
    }

    let extension_path = resolve_extension_path(entry)?;
    let extension_settings = load_extension_settings(global_config_dir)?
        .extension_config
        .get(&entry.id)
        .cloned()
        .unwrap_or_else(|| Value::Object(Default::default()));
    let runtime_state =
        load_extension_runtime_state_snapshot(global_config_dir, workspace_root, &entry.id)?;
    let request = ExtensionHostRequest::Activate {
        extension_id: entry.id.clone(),
        activation_event: activation_event.trim().to_string(),
        extension_path: extension_path.to_string_lossy().to_string(),
        manifest_path: entry.path.clone(),
        main_entry: manifest.main.clone(),
        activation_state: ExtensionHostActivationState {
            settings: extension_settings,
            global_state: runtime_state.global_state,
            workspace_state: runtime_state.workspace_state,
        },
    };
    let response = invoke_extension_host(state, request)?;
    let ExtensionHostResponse::Activate(result) = response else {
        return Err("Unexpected extension host activation response".to_string());
    };

    let mut activated = state
        .activated_extensions
        .lock()
        .map_err(|_| "Failed to access extension host state".to_string())?;
    if result.activated {
        activated.insert(entry.id.clone());
    }
    if let Ok(mut contexts) = state.activation_context.lock() {
        contexts.insert(
            entry.id.clone(),
            (global_config_dir.to_string(), workspace_root.to_string()),
        );
    }

    Ok(result)
}

pub fn should_activate_for_event(manifest: &ExtensionManifest, activation_event: &str) -> bool {
    let target = activation_event.trim();
    if target.is_empty() {
        return true;
    }
    if manifest
        .activation_events
        .iter()
        .any(|event| event.trim() == "*" || event.trim() == target)
    {
        return true;
    }
    if let Some(command) = target.strip_prefix("onCommand:") {
        return manifest
            .contributes
            .commands
            .iter()
            .any(|contribution| contribution.command.trim() == command);
    }
    if let Some(capability) = target.strip_prefix("onCapability:") {
        return manifest
            .contributes
            .capabilities
            .iter()
            .any(|contribution| contribution.id.trim() == capability);
    }
    false
}

pub fn build_extension_invocation_envelope(
    task_id: &str,
    extension_id: &str,
    workspace_root: &str,
    command_id: &str,
    item_id: &str,
    item_handle: &str,
    capability: &str,
    target_kind: &str,
    target_path: &str,
    settings: &Value,
) -> ExtensionHostInvocationEnvelope {
    ExtensionHostInvocationEnvelope {
        task_id: task_id.to_string(),
        extension_id: extension_id.to_string(),
        workspace_root: workspace_root.to_string(),
        command_id: command_id.to_string(),
        item_id: item_id.to_string(),
        item_handle: item_handle.to_string(),
        capability: capability.to_string(),
        target_kind: target_kind.to_string(),
        target_path: target_path.to_string(),
        settings_json: settings.to_string(),
    }
}

#[cfg(not(test))]
fn ensure_extension_host_process(
    state: &ExtensionHostState,
) -> Result<std::sync::MutexGuard<'_, ExtensionHostProcess>, String> {
    let mut process = state
        .process
        .lock()
        .map_err(|_| "Failed to access extension host process state".to_string())?;

    if process.child.is_none() {
        let node_host_script = resolve_builtin_node_host_script()?;
        let mut command = background_command("node");
        command.arg(node_host_script);
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to start extension host process: {error}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Extension host stdin is unavailable".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Extension host stdout is unavailable".to_string())?;
        process.stdin = Some(stdin);
        process.stdout = Some(BufReader::new(stdout));
        process.child = Some(child);
    }

    Ok(process)
}

#[cfg(not(test))]
pub fn bind_extension_host_app_handle(state: &ExtensionHostState, app: tauri::AppHandle) {
    if let Ok(mut handle) = state.app_handle.lock() {
        *handle = Some(app);
    }
}

#[cfg(test)]
pub fn bind_extension_host_app_handle(_state: &ExtensionHostState, _app: tauri::AppHandle) {}

#[cfg(not(test))]
fn emit_extension_host_view_changed(
    state: &ExtensionHostState,
    event: &ExtensionHostViewChangedEvent,
) -> Result<(), String> {
    let handle = state
        .app_handle
        .lock()
        .map_err(|_| "Failed to access extension host app handle".to_string())?;
    if let Some(app) = handle.as_ref() {
        app.emit(EXTENSION_VIEW_CHANGED_EVENT, event.clone())
            .map_err(|error| format!("Failed to emit extension view change event: {error}"))?;
    }
    Ok(())
}

#[cfg(not(test))]
fn emit_extension_host_view_state_changed(
    state: &ExtensionHostState,
    event: &ExtensionHostViewStateChangedEvent,
) -> Result<(), String> {
    let handle = state
        .app_handle
        .lock()
        .map_err(|_| "Failed to access extension host app handle".to_string())?;
    if let Some(app) = handle.as_ref() {
        app.emit(EXTENSION_VIEW_STATE_CHANGED_EVENT, event.clone())
            .map_err(|error| format!("Failed to emit extension view state change event: {error}"))?;
    }
    Ok(())
}

#[cfg(not(test))]
fn emit_extension_host_view_reveal_requested(
    state: &ExtensionHostState,
    event: &ExtensionHostViewRevealRequestedEvent,
) -> Result<(), String> {
    let handle = state
        .app_handle
        .lock()
        .map_err(|_| "Failed to access extension host app handle".to_string())?;
    if let Some(app) = handle.as_ref() {
        app.emit(EXTENSION_VIEW_REVEAL_REQUESTED_EVENT, event.clone())
            .map_err(|error| format!("Failed to emit extension view reveal request event: {error}"))?;
    }
    Ok(())
}

#[cfg(not(test))]
fn emit_extension_host_window_input_requested(
    state: &ExtensionHostState,
    event: &ExtensionHostWindowInputRequestedEvent,
) -> Result<(), String> {
    let handle = state
        .app_handle
        .lock()
        .map_err(|_| "Failed to access extension host app handle".to_string())?;
    if let Some(app) = handle.as_ref() {
        app.emit("extension-window-input-requested", event.clone())
            .map_err(|error| format!("Failed to emit extension window input request event: {error}"))?;
    }
    Ok(())
}

#[cfg(not(test))]
fn emit_extension_host_window_message(
    state: &ExtensionHostState,
    event: &ExtensionHostWindowMessageEvent,
) -> Result<(), String> {
    let handle = state
        .app_handle
        .lock()
        .map_err(|_| "Failed to access extension host app handle".to_string())?;
    if let Some(app) = handle.as_ref() {
        app.emit(EXTENSION_WINDOW_MESSAGE_EVENT, event.clone())
            .map_err(|error| format!("Failed to emit extension window message event: {error}"))?;
    }
    Ok(())
}

#[cfg(not(test))]
fn mark_ui_request_pending(state: &ExtensionHostState, request_id: &str) -> Result<(), String> {
    let mut ui_requests = state
        .ui_requests
        .lock()
        .map_err(|_| "Failed to access extension host UI request state".to_string())?;
    ui_requests.insert(request_id.to_string(), ExtensionHostUiRequestStatus::Pending);
    Ok(())
}

#[cfg(not(test))]
fn wait_for_ui_request_completion(
    state: &ExtensionHostState,
    request_id: &str,
) -> Result<ExtensionHostRespondUiRequestParams, String> {
    let started = Instant::now();
    let timeout = Duration::from_secs(300);
    loop {
        {
            let mut ui_requests = state
                .ui_requests
                .lock()
                .map_err(|_| "Failed to access extension host UI request state".to_string())?;
            if let Some(ExtensionHostUiRequestStatus::Completed { cancelled, result }) =
                ui_requests.get(request_id).cloned()
            {
                ui_requests.remove(request_id);
                return Ok(ExtensionHostRespondUiRequestParams {
                    request_id: request_id.to_string(),
                    cancelled,
                    result,
                });
            }
        }
        if started.elapsed() >= timeout {
            let mut ui_requests = state
                .ui_requests
                .lock()
                .map_err(|_| "Failed to access extension host UI request state".to_string())?;
            ui_requests.remove(request_id);
            return Err(format!("Extension UI request timed out: {request_id}"));
        }
        std::thread::sleep(Duration::from_millis(16));
    }
}

pub fn respond_extension_host_ui_request(
    state: &ExtensionHostState,
    params: ExtensionHostRespondUiRequestParams,
) -> Result<ExtensionHostRespondUiRequestResult, String> {
    let request_id = params.request_id.trim().to_string();
    if request_id.is_empty() {
        return Err("Extension UI request id is required".to_string());
    }
    let mut ui_requests = state
        .ui_requests
        .lock()
        .map_err(|_| "Failed to access extension host UI request state".to_string())?;
    let Some(status) = ui_requests.get_mut(&request_id) else {
        return Err(format!("Pending extension UI request not found: {request_id}"));
    };
    *status = ExtensionHostUiRequestStatus::Completed {
        cancelled: params.cancelled,
        result: params.result,
    };
    Ok(ExtensionHostRespondUiRequestResult {
        request_id,
        accepted: true,
    })
}

#[cfg_attr(test, allow(dead_code))]
fn persist_extension_host_state_changed_event(
    state: &ExtensionHostState,
    event: &ExtensionHostStateChangedEvent,
) -> Result<(), String> {
    let global_config_dir = state
        .activation_context
        .lock()
        .map_err(|_| "Failed to access extension host activation context".to_string())?
        .get(&event.extension_id)
        .map(|(global_config_dir, _)| global_config_dir.clone())
        .unwrap_or_default();
    let snapshot = crate::extension_settings::ExtensionRuntimeStateSnapshot {
        global_state: event.global_state.clone(),
        workspace_state: event.workspace_state.clone(),
    };
    save_extension_runtime_state_snapshot(
        &global_config_dir,
        &event.workspace_root,
        &event.extension_id,
        snapshot,
    )?;
    Ok(())
}

pub fn invoke_extension_host(
    state: &ExtensionHostState,
    request: ExtensionHostRequest,
) -> Result<ExtensionHostResponse, String> {
    #[cfg(test)]
    let _ = state;

    #[cfg(test)]
    {
        let response = handle_extension_host_request(request);
        return match &response {
            ExtensionHostResponse::Error { message } => Err(message.clone()),
            _ => Ok(response),
        };
    }

    #[cfg(not(test))]
    {
        let serialized_request = serde_json::to_string(&request)
            .map_err(|error| format!("Failed to serialize extension host request: {error}"))?;

        let mut process = ensure_extension_host_process(state)?;
        let stdin = process
            .stdin
            .as_mut()
            .ok_or_else(|| "Extension host stdin is unavailable".to_string())?;
        stdin
            .write_all(serialized_request.as_bytes())
            .map_err(|error| format!("Failed to write extension host request: {error}"))?;
        stdin
            .write_all(b"\n")
            .map_err(|error| format!("Failed to finalize extension host request: {error}"))?;
        stdin
            .flush()
            .map_err(|error| format!("Failed to flush extension host request: {error}"))?;

        let stdout = process
            .stdout
            .as_mut()
            .ok_or_else(|| "Extension host stdout is unavailable".to_string())?;
        loop {
            let mut response_line = String::new();
            stdout
                .read_line(&mut response_line)
                .map_err(|error| format!("Failed to read extension host response: {error}"))?;
            if response_line.trim().is_empty() {
                continue;
            }

            let response = serde_json::from_str::<ExtensionHostResponse>(response_line.trim())
                .map_err(|error| format!("Failed to parse extension host response: {error}"))?;
            match &response {
                ExtensionHostResponse::ViewChanged(event) => {
                    emit_extension_host_view_changed(state, event)?;
                    continue;
                }
                ExtensionHostResponse::ViewStateChanged(event) => {
                    emit_extension_host_view_state_changed(state, event)?;
                    continue;
                }
                ExtensionHostResponse::ViewRevealRequested(event) => {
                    emit_extension_host_view_reveal_requested(state, event)?;
                    continue;
                }
                ExtensionHostResponse::WindowInputRequested(event) => {
                    mark_ui_request_pending(state, &event.request_id)?;
                    emit_extension_host_window_input_requested(state, event)?;
                    let request_id = event.request_id.clone();
                    drop(process);
                    let response = wait_for_ui_request_completion(state, &request_id)?;
                    return invoke_extension_host(
                        state,
                        ExtensionHostRequest::RespondUiRequest {
                            request_id: response.request_id,
                            cancelled: response.cancelled,
                            result: response.result,
                        },
                    );
                }
                ExtensionHostResponse::StateChanged(event) => {
                    persist_extension_host_state_changed_event(state, event)?;
                    continue;
                }
                ExtensionHostResponse::WindowMessage(event) => {
                    emit_extension_host_window_message(state, event)?;
                    continue;
                }
                ExtensionHostResponse::Error { message } => return Err(message.clone()),
                _ => return Ok(response),
            }
        }
    }
}

pub fn run_extension_host_stdio_loop() -> Result<(), String> {
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    let mut reader = BufReader::new(stdin.lock());
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .map_err(|error| format!("Failed to read extension host input: {error}"))?;
    let request = serde_json::from_str::<ExtensionHostRequest>(line.trim())
        .map_err(|error| format!("Failed to parse extension host request: {error}"))?;
    let response = handle_extension_host_request(request);
    let serialized = serde_json::to_string(&response)
        .map_err(|error| format!("Failed to serialize extension host response: {error}"))?;
    let mut handle = stdout.lock();
    handle
        .write_all(serialized.as_bytes())
        .map_err(|error| format!("Failed to write extension host response: {error}"))?;
    handle
        .write_all(b"\n")
        .map_err(|error| format!("Failed to finalize extension host response: {error}"))?;
    handle
        .flush()
        .map_err(|error| format!("Failed to flush extension host response: {error}"))?;
    Ok(())
}

pub fn is_extension_host_mode() -> bool {
    std::env::args().any(|arg| arg == EXTENSION_HOST_ARG)
}

fn handle_extension_host_request(request: ExtensionHostRequest) -> ExtensionHostResponse {
    match request {
        ExtensionHostRequest::Activate {
            extension_id,
            activation_event,
            ..
        } => ExtensionHostResponse::Activate(ExtensionHostActivationResult {
            extension_id: extension_id,
            activated: true,
            reason: if activation_event.trim().is_empty() {
                "Activated by host".to_string()
            } else {
                format!("Activated by {}", activation_event.trim())
            },
            registered_commands: Vec::new(),
            registered_capabilities: Vec::new(),
            registered_views: Vec::new(),
            registered_command_details: Vec::new(),
            registered_view_details: Vec::new(),
        }),
        ExtensionHostRequest::InvokeCapability { envelope, .. } => {
            ExtensionHostResponse::InvokeCapability(ExtensionHostCapabilityResult {
                accepted: true,
                message: format!(
                    "Extension host accepted {} for {}",
                    envelope.capability, envelope.extension_id
                ),
                progress_label: "Accepted by extension host".to_string(),
                changed_views: Vec::new(),
            })
        }
        ExtensionHostRequest::ExecuteCommand {
            command_id,
            envelope,
            ..
        } => ExtensionHostResponse::ExecuteCommand(ExtensionHostCapabilityResult {
            accepted: true,
            message: format!(
                "Extension host executed {} for {}",
                command_id, envelope.extension_id
            ),
            progress_label: "Accepted by extension host".to_string(),
            changed_views: Vec::new(),
        }),
        ExtensionHostRequest::ResolveView {
            view_id,
            parent_item_id,
            envelope,
            ..
        } => ExtensionHostResponse::ResolveView(ExtensionHostViewResolveResult {
            view_id,
            parent_item_id,
            title: envelope.extension_id.clone(),
            description: String::new(),
            message: String::new(),
            badge_value: None,
            badge_tooltip: String::new(),
            items: Vec::new(),
        }),
        ExtensionHostRequest::RespondUiRequest { request_id, .. } => {
            ExtensionHostResponse::AcknowledgeUiRequest(ExtensionHostUiRequestAcknowledgement {
                request_id,
                accepted: true,
            })
        }
        ExtensionHostRequest::NotifyViewSelection {
            extension_id,
            view_id,
            ..
        } => ExtensionHostResponse::AcknowledgeViewSelection(
            ExtensionHostViewSelectionAcknowledgement {
                extension_id,
                view_id,
                accepted: true,
            },
        ),
    }
}

#[tauri::command]
pub async fn extension_host_status(
    state: tauri::State<'_, ExtensionHostState>,
) -> Result<ExtensionHostSummary, String> {
    extension_host_summary(state.inner())
}

#[tauri::command]
pub async fn extension_host_activate(
    params: ExtensionHostActivateParams,
    state: tauri::State<'_, ExtensionHostState>,
) -> Result<ExtensionHostActivationResult, String> {
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
    if !should_activate_for_event(manifest, &params.activation_event) {
        return Err(format!(
            "Extension {} does not activate on {}",
            entry.id, params.activation_event
        ));
    }
    activate_extension(
        state.inner(),
        &params.global_config_dir,
        &params.workspace_root,
        &entry,
        &params.activation_event,
    )
}

#[tauri::command]
pub async fn extension_host_respond_ui_request(
    params: ExtensionHostRespondUiRequestParams,
    state: tauri::State<'_, ExtensionHostState>,
) -> Result<ExtensionHostRespondUiRequestResult, String> {
    respond_extension_host_ui_request(state.inner(), params)
}

#[tauri::command]
pub async fn extension_host_notify_view_selection(
    params: ExtensionHostNotifyViewSelectionParams,
    state: tauri::State<'_, ExtensionHostState>,
) -> Result<ExtensionHostViewSelectionAcknowledgement, String> {
    let extension_id = params.extension_id.trim().to_string();
    let view_id = params.view_id.trim().to_string();
    if extension_id.is_empty() || view_id.is_empty() {
        return Err("Extension id and view id are required".to_string());
    }
    match invoke_extension_host(
        state.inner(),
        ExtensionHostRequest::NotifyViewSelection {
            extension_id: extension_id.clone(),
            view_id: view_id.clone(),
            item_handle: params.item_handle.trim().to_string(),
        },
    )? {
        ExtensionHostResponse::AcknowledgeViewSelection(result) => Ok(result),
        _ => Err("Unexpected extension host response for view selection".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        activate_extension, build_extension_invocation_envelope, handle_extension_host_request,
        should_activate_for_event, ExtensionHostRequest, ExtensionHostResponse, ExtensionHostState,
    };
    use crate::extension_manifest::{
        parse_extension_manifest_str, CANONICAL_EXTENSION_MANIFEST_FILENAME,
    };
    use crate::extension_registry::ExtensionRegistryEntry;

    fn canonical_entry() -> ExtensionRegistryEntry {
        let manifest = parse_extension_manifest_str(
            &serde_json::json!({
                "name": "scribeflow-pdf2zh",
                "displayName": "PDF Translator",
                "version": "0.1.0",
                "description": "Translate PDFs through a extension-local toolchain.",
                "engines": {
                    "scribeflow": "^1.1.0"
                },
                "main": "./dist/extension.js",
                "extensionKind": ["workspace"],
                "activationEvents": ["onCommand:scribeflow.pdf.translate"],
                "contributes": {
                    "commands": [{
                        "command": "scribeflow.pdf.translate",
                        "title": "Translate"
                    }],
                    "capabilities": [{
                        "id": "pdf.translate"
                    }]
                },
                "permissions": {
                    "readWorkspaceFiles": true,
                    "writeArtifacts": true,
                    "spawnProcess": true,
                    "network": "optional"
                }
            })
            .to_string(),
            CANONICAL_EXTENSION_MANIFEST_FILENAME,
        )
        .expect("canonical parse")
        .manifest;

        ExtensionRegistryEntry {
            id: manifest.id.clone(),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            description: manifest.description.clone(),
            capabilities: manifest.capabilities.clone(),
            runtime: manifest.runtime.clone(),
            permissions: manifest.permissions.clone(),
            scope: "global".to_string(),
            path: "/tmp/package.json".to_string(),
            status: "available".to_string(),
            warnings: Vec::new(),
            errors: Vec::new(),
            manifest: Some(manifest),
            manifest_format: "package.json".to_string(),
        }
    }

    #[test]
    fn activates_extension_host_entry() {
        let state = ExtensionHostState::default();
        let entry = canonical_entry();
        let activated = activate_extension(
            &state,
            "",
            "",
            &entry,
            "onCommand:scribeflow.pdf.translate",
        )
        .expect("activate");
        assert!(activated.activated);
        assert_eq!(activated.extension_id, entry.id);
    }

    #[test]
    fn activation_event_matches_explicit_and_contributed_events() {
        let entry = canonical_entry();
        let mut manifest = entry.manifest.expect("manifest");
        assert!(should_activate_for_event(
            &manifest,
            "onCommand:scribeflow.pdf.translate"
        ));
        assert!(!should_activate_for_event(
            &manifest,
            "onSurface:pdf.preview.actions"
        ));
        manifest.activation_events.clear();
        assert!(should_activate_for_event(
            &manifest,
            "onCommand:scribeflow.pdf.translate"
        ));
        assert!(should_activate_for_event(
            &manifest,
            "onCapability:pdf.translate"
        ));
    }

    #[test]
    fn builds_invocation_envelope() {
        let envelope = build_extension_invocation_envelope(
            "task-1",
            "extension-1",
            "/tmp/workspace",
            "scribeflow.pdf.translate",
            "",
            "",
            "pdf.translate",
            "referencePdf",
            "/tmp/paper.pdf",
            &serde_json::json!({"targetLang": "zh-CN"}),
        );
        assert_eq!(envelope.task_id, "task-1");
        assert_eq!(envelope.extension_id, "extension-1");
        assert_eq!(envelope.workspace_root, "/tmp/workspace");
        assert!(envelope.settings_json.contains("targetLang"));
    }

    #[test]
    fn sidecar_request_handler_accepts_capability_invocation() {
        let response = handle_extension_host_request(ExtensionHostRequest::InvokeCapability {
            activation_event: "onCapability:pdf.translate".to_string(),
            extension_path: "/tmp/ext".to_string(),
            manifest_path: "/tmp/ext/package.json".to_string(),
            main_entry: "./dist/extension.js".to_string(),
            envelope: build_extension_invocation_envelope(
                "task-1",
                "extension-1",
                "/tmp/workspace",
                "scribeflow.pdf.translate",
                "",
                "",
                "pdf.translate",
                "referencePdf",
                "/tmp/paper.pdf",
                &serde_json::json!({"targetLang": "zh-CN"}),
            ),
        });
        match response {
            ExtensionHostResponse::InvokeCapability(result) => {
                assert!(result.accepted);
                assert!(result.message.contains("pdf.translate"));
            }
            _ => panic!("unexpected response"),
        }
    }

    #[test]
    fn sidecar_request_handler_accepts_command_execution() {
        let response = handle_extension_host_request(ExtensionHostRequest::ExecuteCommand {
            activation_event: "onCommand:scribeflow.pdf.translate".to_string(),
            extension_path: "/tmp/ext".to_string(),
            manifest_path: "/tmp/ext/package.json".to_string(),
            main_entry: "./dist/extension.js".to_string(),
            command_id: "scribeflow.pdf.translate".to_string(),
            envelope: build_extension_invocation_envelope(
                "task-1",
                "extension-1",
                "/tmp/workspace",
                "scribeflow.pdf.translate",
                "",
                "",
                "",
                "referencePdf",
                "/tmp/paper.pdf",
                &serde_json::json!({"targetLang": "zh-CN"}),
            ),
        });
        match response {
            ExtensionHostResponse::ExecuteCommand(result) => {
                assert!(result.accepted);
                assert!(result.message.contains("scribeflow.pdf.translate"));
            }
            _ => panic!("unexpected response"),
        }
    }

    #[test]
    fn sidecar_request_handler_accepts_view_resolution() {
        let response = handle_extension_host_request(ExtensionHostRequest::ResolveView {
            activation_event: "onView:examplePdfExtension.translateView".to_string(),
            extension_path: "/tmp/ext".to_string(),
            manifest_path: "/tmp/ext/package.json".to_string(),
            main_entry: "./dist/extension.js".to_string(),
            view_id: "examplePdfExtension.translateView".to_string(),
            parent_item_id: "".to_string(),
            envelope: build_extension_invocation_envelope(
                "",
                "extension-1",
                "/tmp/workspace",
                "",
                "",
                "",
                "",
                "referencePdf",
                "/tmp/paper.pdf",
                &serde_json::json!({"targetLang": "zh-CN"}),
            ),
        });
        match response {
            ExtensionHostResponse::ResolveView(result) => {
                assert_eq!(result.view_id, "examplePdfExtension.translateView");
            }
            _ => panic!("unexpected response"),
        }
    }
}
