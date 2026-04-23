use serde::Deserialize;
use serde_json::{json, Value};

use crate::document_workflow::{
    create_workflow_preview_path, document_workflow_reconcile_value, get_document_workflow_kind,
    preferred_preview_kind, DocumentWorkflowReconcileParams,
};
use crate::document_workflow_preview_binding::{
    find_open_preview_path_value, find_preview_binding_value, normalize_preview_binding_values,
};

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocumentWorkflowControllerParams {
    #[serde(default)]
    pub operation: String,
    #[serde(default)]
    pub active_file: String,
    #[serde(default)]
    pub active_pane_id: String,
    #[serde(default)]
    pub pane_tree: Value,
    #[serde(default)]
    pub trigger: String,
    #[serde(default)]
    pub preview_prefs: Value,
    #[serde(default)]
    pub detached_sources: Value,
    #[serde(default)]
    pub preview_bindings: Vec<Value>,
    #[serde(default)]
    pub session: Value,
    #[serde(default)]
    pub force: bool,
    #[serde(default)]
    pub preview_kind_override: String,
    #[serde(default)]
    pub allow_legacy_pane_result: bool,
    #[serde(default)]
    pub source_path: String,
    #[serde(default)]
    pub preview_kind: String,
    #[serde(default)]
    pub source_pane_id: String,
    #[serde(default)]
    pub activate_preview: bool,
    #[serde(default = "default_reconcile_after_close")]
    pub reconcile_after_close: bool,
}

fn default_reconcile_after_close() -> bool {
    true
}

fn normalize_path(path: &str) -> String {
    path.trim().to_string()
}

fn null_if_empty(value: &str) -> Value {
    let normalized = value.trim();
    if normalized.is_empty() {
        Value::Null
    } else {
        Value::String(normalized.to_string())
    }
}

fn session_preview_pane_id(session: &Value) -> Option<String> {
    session
        .get("previewPaneId")
        .and_then(Value::as_str)
        .map(|value| value.to_string())
}

fn session_preview_source_path(session: &Value) -> String {
    session
        .get("previewSourcePath")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn session_preview_kind(session: &Value) -> String {
    session
        .get("previewKind")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn find_preview_binding(preview_bindings: &[Value], preview_path: &str) -> Option<Value> {
    find_preview_binding_value(preview_bindings, preview_path)
}

fn find_open_preview_path(
    source_path: &str,
    preview_kind: &str,
    preview_bindings: &[Value],
    session: &Value,
) -> Option<String> {
    if let Some(preview_path) =
        find_open_preview_path_value(preview_bindings, source_path, preview_kind)
    {
        return Some(preview_path);
    }

    if session_preview_source_path(session) == source_path
        && session_preview_pane_id(session).is_some()
        && (preview_kind.is_empty() || session_preview_kind(session) == preview_kind)
    {
        let kind = get_document_workflow_kind(source_path)?;
        return create_workflow_preview_path(source_path, kind, Some(preview_kind))
            .map(|value| value.to_string());
    }

    None
}

fn build_session_state(result: &Value, fallback_pane_id: &str) -> Option<Value> {
    let result_type = result
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    match result_type {
        "inactive" => Some(json!({
            "activeFile": Value::Null,
            "activeKind": Value::Null,
            "sourcePaneId": null_if_empty(fallback_pane_id),
            "previewPaneId": Value::Null,
            "previewKind": Value::Null,
            "previewSourcePath": Value::Null,
            "state": "inactive",
        })),
        "detached" => Some(json!({
            "activeFile": result.get("sourcePath").cloned().unwrap_or(Value::Null),
            "activeKind": result.get("kind").cloned().unwrap_or(Value::Null),
            "sourcePaneId": result.get("sourcePaneId").cloned().unwrap_or(Value::Null),
            "previewPaneId": Value::Null,
            "previewKind": result.get("previewKind").cloned().unwrap_or(Value::Null),
            "previewSourcePath": result.get("sourcePath").cloned().unwrap_or(Value::Null),
            "state": "detached-by-user",
        })),
        "source-only" => Some(json!({
            "activeFile": result.get("sourcePath").cloned().unwrap_or(Value::Null),
            "activeKind": result.get("kind").cloned().unwrap_or(Value::Null),
            "sourcePaneId": result.get("sourcePaneId").cloned().unwrap_or(Value::Null),
            "previewPaneId": Value::Null,
            "previewKind": result.get("previewKind").cloned().unwrap_or(Value::Null),
            "previewSourcePath": result.get("sourcePath").cloned().unwrap_or(Value::Null),
            "state": "source-only",
        })),
        "workspace-preview" => Some(json!({
            "activeFile": result.get("sourcePath").or_else(|| result.get("filePath")).cloned().unwrap_or(Value::Null),
            "activeKind": result.get("kind").cloned().unwrap_or(Value::Null),
            "sourcePaneId": result.get("sourcePaneId").cloned().unwrap_or(Value::Null),
            "previewPaneId": Value::Null,
            "previewKind": result.get("previewKind").cloned().unwrap_or(Value::Null),
            "previewSourcePath": result.get("sourcePath").or_else(|| result.get("filePath")).cloned().unwrap_or(Value::Null),
            "state": "workspace-preview",
        })),
        "ready-existing" => Some(json!({
            "activeFile": result.get("sourcePath").cloned().unwrap_or(Value::Null),
            "activeKind": result.get("kind").cloned().unwrap_or(Value::Null),
            "sourcePaneId": result.get("sourcePaneId").cloned().unwrap_or(Value::Null),
            "previewPaneId": result.get("previewPaneId").cloned().unwrap_or(Value::Null),
            "previewKind": result.get("previewKind").cloned().unwrap_or(Value::Null),
            "previewSourcePath": result.get("sourcePath").cloned().unwrap_or(Value::Null),
            "state": "ready",
        })),
        _ => None,
    }
}

fn build_bind_preview(result: &Value, detach_on_close: bool) -> Option<Value> {
    let result_type = result
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    match result_type {
        "workspace-preview"
            if result
                .get("preserveOpenLegacy")
                .and_then(Value::as_bool)
                .unwrap_or(false) =>
        {
            let preview_path = result
                .get("legacyPreviewPath")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if preview_path.is_empty() {
                return None;
            }
            Some(json!({
                "previewPath": preview_path,
                "sourcePath": result.get("sourcePath").or_else(|| result.get("filePath")).cloned().unwrap_or(Value::Null),
                "previewKind": result.get("previewKind").cloned().unwrap_or(Value::Null),
                "kind": result.get("kind").cloned().unwrap_or(Value::Null),
                "paneId": result.get("legacyPreviewPaneId").cloned().unwrap_or(Value::Null),
                "detachOnClose": false,
            }))
        }
        "ready-existing" => Some(json!({
            "previewPath": result.get("previewPath").cloned().unwrap_or(Value::Null),
            "sourcePath": result.get("sourcePath").cloned().unwrap_or(Value::Null),
            "previewKind": result.get("previewKind").cloned().unwrap_or(Value::Null),
            "kind": result.get("kind").cloned().unwrap_or(Value::Null),
            "paneId": result.get("previewPaneId").cloned().unwrap_or(Value::Null),
            "detachOnClose": detach_on_close,
        })),
        _ => None,
    }
}

fn build_reconcile_plan(
    result: Value,
    fallback_pane_id: &str,
    force: bool,
    preview_kind_override: &str,
) -> Value {
    let result_type = result
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let session_state = build_session_state(&result, fallback_pane_id);
    let bind_preview = build_bind_preview(&result, true);
    let pane_action = match result_type {
        "open-neighbor" => Some(json!({
            "type": "open-file-in-pane",
            "previewPath": result.get("previewPath").cloned().unwrap_or(Value::Null),
            "previewPaneId": result.get("previewPaneId").cloned().unwrap_or(Value::Null),
            "activatePane": false,
        })),
        "split-right" => Some(json!({
            "type": "split-pane-with-preview",
            "previewPath": result.get("previewPath").cloned().unwrap_or(Value::Null),
            "sourcePaneId": result.get("sourcePaneId").cloned().unwrap_or(Value::Null),
        })),
        "ready-existing" if force => Some(json!({
            "type": "open-file-in-pane",
            "previewPath": result.get("previewPath").cloned().unwrap_or(Value::Null),
            "previewPaneId": result.get("previewPaneId").cloned().unwrap_or(Value::Null),
            "activatePane": false,
        })),
        _ => None,
    };

    let needs_followup = matches!(result_type, "open-neighbor" | "split-right");
    let followup = if needs_followup {
        Some(json!({
            "operation": "reconcile",
            "activeFile": result.get("sourcePath").cloned().unwrap_or(Value::Null),
            "activePaneId": result.get("sourcePaneId").cloned().unwrap_or(Value::Null),
            "trigger": result.get("trigger").cloned().unwrap_or(Value::Null),
            "force": false,
            "previewKindOverride": if preview_kind_override.trim().is_empty() {
                result.get("previewKind").cloned().unwrap_or(Value::Null)
            } else {
                Value::String(preview_kind_override.trim().to_string())
            },
            "allowLegacyPaneResult": false,
        }))
    } else {
        None
    };

    json!({
        "result": result,
        "sessionState": session_state,
        "bindPreview": bind_preview,
        "paneAction": pane_action,
        "followupRequest": followup,
    })
}

fn execute_reconcile(params: &DocumentWorkflowControllerParams) -> Value {
    let reconcile = document_workflow_reconcile_value(DocumentWorkflowReconcileParams {
        active_file: params.active_file.clone(),
        active_pane_id: params.active_pane_id.clone(),
        pane_tree: params.pane_tree.clone(),
        trigger: params.trigger.clone(),
        preview_prefs: params.preview_prefs.clone(),
        detached_sources: params.detached_sources.clone(),
        preview_bindings: normalize_preview_binding_values(params.preview_bindings.clone()),
        force: params.force,
        preview_kind_override: params.preview_kind_override.clone(),
        allow_legacy_pane_result: params.allow_legacy_pane_result,
    });
    build_reconcile_plan(
        reconcile,
        &params.active_pane_id,
        params.force,
        &params.preview_kind_override,
    )
}

fn execute_close(params: &DocumentWorkflowControllerParams) -> Value {
    let source_path = normalize_path(&params.source_path);
    if source_path.is_empty() {
        return Value::Null;
    }

    let kind = match get_document_workflow_kind(&source_path) {
        Some(kind) => kind,
        None => return Value::Null,
    };
    let preview_kind = if !params.preview_kind.trim().is_empty() {
        params.preview_kind.trim().to_string()
    } else {
        preferred_preview_kind(kind, &params.preview_prefs)
            .unwrap_or_default()
            .to_string()
    };

    let Some(preview_path) = find_open_preview_path(
        &source_path,
        &preview_kind,
        &params.preview_bindings,
        &params.session,
    ) else {
        return Value::Null;
    };

    let binding = find_preview_binding(&params.preview_bindings, &preview_path);
    let mark_detached = binding
        .as_ref()
        .and_then(|value| value.get("detachOnClose"))
        .and_then(Value::as_bool)
        .unwrap_or(false);

    json!({
        "result": {
            "type": "closed-preview",
            "kind": kind,
            "sourcePath": source_path,
            "previewKind": preview_kind,
            "previewPath": preview_path,
        },
        "closePreviewPath": preview_path,
        "unbindPreviewPath": preview_path,
        "markDetachedSourcePath": if mark_detached { Value::String(source_path.clone()) } else { Value::Null },
        "followupRequest": if params.reconcile_after_close {
            json!({
                "operation": "reconcile",
                "trigger": if params.trigger.trim().is_empty() { "close-preview" } else { params.trigger.trim() },
                "force": false,
                "previewKindOverride": preview_kind,
                "allowLegacyPaneResult": false,
            })
        } else {
            Value::Null
        },
    })
}

fn execute_ensure_or_reveal(params: &DocumentWorkflowControllerParams) -> Value {
    let source_path = normalize_path(&params.source_path);
    if source_path.is_empty() {
        return Value::Null;
    }

    let kind = match get_document_workflow_kind(&source_path) {
        Some(kind) => kind,
        None => return Value::Null,
    };
    let preview_kind = if !params.preview_kind.trim().is_empty() {
        params.preview_kind.trim().to_string()
    } else {
        preferred_preview_kind(kind, &params.preview_prefs)
            .unwrap_or_default()
            .to_string()
    };

    let active_pane_id = if !params.source_pane_id.trim().is_empty() {
        params.source_pane_id.clone()
    } else {
        params.active_pane_id.clone()
    };
    let trigger = if params.trigger.trim().is_empty() {
        if params.activate_preview {
            "reveal-preview".to_string()
        } else {
            "manual-open-preview".to_string()
        }
    } else {
        params.trigger.trim().to_string()
    };

    let reconcile = document_workflow_reconcile_value(DocumentWorkflowReconcileParams {
        active_file: source_path.clone(),
        active_pane_id: active_pane_id.clone(),
        pane_tree: params.pane_tree.clone(),
        trigger,
        preview_prefs: params.preview_prefs.clone(),
        detached_sources: params.detached_sources.clone(),
        preview_bindings: normalize_preview_binding_values(params.preview_bindings.clone()),
        force: true,
        preview_kind_override: preview_kind.clone(),
        allow_legacy_pane_result: false,
    });

    let mut plan = build_reconcile_plan(reconcile, &active_pane_id, true, &preview_kind);
    if let Some(obj) = plan.as_object_mut() {
        obj.insert(
            "clearDetachedSourcePath".to_string(),
            Value::String(source_path),
        );
        obj.insert(
            "restorePreviousSelection".to_string(),
            Value::Bool(!params.activate_preview),
        );
        obj.insert(
            "activateResolvedPreview".to_string(),
            Value::Bool(params.activate_preview),
        );
    }
    plan
}

#[tauri::command]
pub async fn document_workflow_controller_execute(
    params: DocumentWorkflowControllerParams,
) -> Result<Value, String> {
    let operation = params.operation.trim();
    let result = match operation {
        "reconcile" => execute_reconcile(&params),
        "close-preview" => execute_close(&params),
        "ensure-preview" | "reveal-preview" => execute_ensure_or_reveal(&params),
        _ => Value::Null,
    };
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::{document_workflow_controller_execute, DocumentWorkflowControllerParams};
    use serde_json::{json, Value};

    #[tokio::test]
    async fn preview_close_marks_detached_when_binding_requires_it() {
        let plan = document_workflow_controller_execute(DocumentWorkflowControllerParams {
            operation: "close-preview".to_string(),
            source_path: "/tmp/demo.md".to_string(),
            preview_kind: "html".to_string(),
            preview_bindings: vec![json!({
                "previewPath": "preview:/tmp/demo.md",
                "sourcePath": "/tmp/demo.md",
                "previewKind": "html",
                "kind": "markdown",
                "paneId": "pane-2",
                "detachOnClose": true,
            })],
            reconcile_after_close: false,
            ..DocumentWorkflowControllerParams::default()
        })
        .await
        .expect("execute close preview");

        assert_eq!(
            plan.get("closePreviewPath").and_then(Value::as_str),
            Some("preview:/tmp/demo.md")
        );
        assert_eq!(
            plan.get("markDetachedSourcePath").and_then(Value::as_str),
            Some("/tmp/demo.md")
        );
    }

    #[tokio::test]
    async fn detached_preview_reopen_clears_detached_source() {
        let plan = document_workflow_controller_execute(DocumentWorkflowControllerParams {
            operation: "ensure-preview".to_string(),
            source_path: "/tmp/demo.md".to_string(),
            source_pane_id: "pane-1".to_string(),
            preview_kind: "html".to_string(),
            pane_tree: json!({
                "type": "leaf",
                "id": "pane-1",
                "tabs": ["/tmp/demo.md"],
                "activeTab": "/tmp/demo.md",
            }),
            ..DocumentWorkflowControllerParams::default()
        })
        .await
        .expect("execute ensure preview");

        assert_eq!(
            plan.get("clearDetachedSourcePath").and_then(Value::as_str),
            Some("/tmp/demo.md")
        );
    }
}
