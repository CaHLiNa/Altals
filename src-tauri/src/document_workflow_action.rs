use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentWorkflowActionResolveParams {
    #[serde(default)]
    pub file_path: String,
    #[serde(default)]
    pub intent: String,
    #[serde(default)]
    pub preview_delivery: String,
    #[serde(default)]
    pub ui_state: Value,
    #[serde(default)]
    pub preview_state: Value,
    #[serde(default)]
    pub artifact_path: String,
}

fn normalize_mode(preview_kind: &str) -> Option<&'static str> {
    match preview_kind {
        "html" => Some("markdown"),
        "pdf" => Some("pdf-artifact"),
        _ => None,
    }
}

fn uses_legacy_preview(preview_delivery: &str) -> bool {
    preview_delivery == "legacy-pane"
}

fn resolve_ui_kind(ui_state: &Value) -> String {
    ui_state
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn resolve_ui_preview_kind(ui_state: &Value) -> String {
    ui_state
        .get("previewKind")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn preview_visible(preview_state: &Value) -> bool {
    preview_state
        .get("previewVisible")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn preview_mode(preview_state: &Value) -> String {
    preview_state
        .get("previewMode")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn build_legacy_toggle(preview_kind: &str, jump: bool) -> Value {
    json!({
        "actionType": "legacy-toggle-preview",
        "previewKind": preview_kind,
        "jump": jump,
    })
}

fn build_workspace_show(preview_kind: &str, persist_preference: bool) -> Value {
    json!({
        "actionType": "show-workspace-preview",
        "previewKind": preview_kind,
        "persistPreference": persist_preference,
    })
}

fn build_workspace_hide() -> Value {
    json!({
        "actionType": "hide-workspace-preview",
    })
}

fn build_external_output(artifact_path: &str) -> Value {
    json!({
        "actionType": "open-external-output",
        "artifactPath": artifact_path,
    })
}

fn build_run_build() -> Value {
    json!({
        "actionType": "run-build",
    })
}

fn build_noop() -> Value {
    json!({
        "actionType": "noop",
    })
}

fn resolve_markdown_action(intent: &str, preview_delivery: &str, preview_state: &Value) -> Value {
    let current_visible = preview_visible(preview_state);
    let current_mode = preview_mode(preview_state);
    let current_is_markdown = current_visible && current_mode == "markdown";

    match intent {
        "primary-action" | "reveal-preview" | "toggle-markdown-preview" => {
            if uses_legacy_preview(preview_delivery) {
                return build_legacy_toggle("html", intent == "reveal-preview");
            }
            if current_is_markdown {
                return build_workspace_hide();
            }
            build_workspace_show("html", true)
        }
        _ => build_noop(),
    }
}

fn resolve_latex_action(
    intent: &str,
    preview_delivery: &str,
    ui_state: &Value,
    preview_state: &Value,
    artifact_path: &str,
) -> Value {
    let requested_preview_kind = resolve_ui_preview_kind(ui_state);
    let current_visible = preview_visible(preview_state);
    let current_mode = preview_mode(preview_state);
    let expected_mode = normalize_mode(&requested_preview_kind).unwrap_or_default();
    let artifact_ready = !artifact_path.trim().is_empty();

    match intent {
        "primary-action" => build_run_build(),
        "open-output" => {
            if artifact_ready {
                build_external_output(artifact_path)
            } else {
                build_noop()
            }
        }
        "toggle-pdf-preview" | "reveal-pdf" => {
            if current_visible && current_mode == "pdf-artifact" {
                return build_workspace_hide();
            }
            if artifact_ready {
                return build_workspace_show("pdf", false);
            }
            build_external_output(artifact_path)
        }
        "reveal-preview" => {
            if requested_preview_kind.is_empty() {
                return build_noop();
            }
            if uses_legacy_preview(preview_delivery) {
                return build_legacy_toggle(&requested_preview_kind, true);
            }
            if current_visible && current_mode == expected_mode {
                return build_workspace_hide();
            }
            if requested_preview_kind == "pdf" && !artifact_ready {
                return build_external_output(artifact_path);
            }
            build_workspace_show(&requested_preview_kind, requested_preview_kind != "pdf")
        }
        _ => build_noop(),
    }
}

#[tauri::command]
pub async fn document_workflow_action_resolve(
    params: DocumentWorkflowActionResolveParams,
) -> Result<Value, String> {
    if params.file_path.trim().is_empty() {
        return Ok(build_noop());
    }

    let ui_kind = resolve_ui_kind(&params.ui_state);
    if ui_kind.is_empty() || ui_kind == "text" {
        return Ok(build_noop());
    }

    let plan = match ui_kind.as_str() {
        "markdown" => resolve_markdown_action(
            &params.intent,
            &params.preview_delivery,
            &params.preview_state,
        ),
        "latex" => resolve_latex_action(
            &params.intent,
            &params.preview_delivery,
            &params.ui_state,
            &params.preview_state,
            &params.artifact_path,
        ),
        _ => build_noop(),
    };

    Ok(plan)
}
