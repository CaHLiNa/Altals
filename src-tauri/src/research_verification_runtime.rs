use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;
use uuid::Uuid;

use crate::research_task_protocol::ResearchTaskUpdateParams;
use crate::research_task_runtime::research_task_update;
use crate::research_verification_protocol::{
    ResearchVerificationListParams, ResearchVerificationListResponse, ResearchVerificationRecord,
    ResearchVerificationRunParams, ResearchVerificationRunResponse,
};
use crate::research_verification_storage::{
    load_workspace_verifications, persist_workspace_verifications,
};

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

fn trim(value: &str) -> String {
    value.trim().to_string()
}

fn string_field(value: &Value, keys: &[&str]) -> String {
    for key in keys {
        if let Some(entry) = value.get(*key).and_then(Value::as_str) {
            let normalized = trim(entry);
            if !normalized.is_empty() {
                return normalized;
            }
        }
    }
    String::new()
}

fn status_and_summary(passed: bool, kind: &str) -> (String, String, bool) {
    if passed {
        (
            "verified".to_string(),
            format!("{kind} verification passed."),
            false,
        )
    } else {
        (
            "failed".to_string(),
            format!("{kind} verification failed."),
            true,
        )
    }
}

fn verify_doc_patch(artifact: &Value, content: &str) -> (bool, Vec<String>) {
    let replacement = string_field(artifact, &["replacementText"]);
    if replacement.is_empty() {
        return (
            false,
            vec!["Missing replacementText in artifact.".to_string()],
        );
    }
    if content.contains(&replacement) {
        (
            true,
            vec!["Replacement text is present in the saved document.".to_string()],
        )
    } else {
        (
            false,
            vec!["Replacement text is not present in the saved document.".to_string()],
        )
    }
}

fn verify_citation_insert(
    artifact: &Value,
    content: &str,
    citation_text: &str,
) -> (bool, Vec<String>) {
    let mut details = Vec::new();
    let normalized_citation_text = trim(citation_text);
    if normalized_citation_text.is_empty() {
        details.push("Citation text is missing.".to_string());
        return (false, details);
    }
    if content.contains(&normalized_citation_text) {
        details.push("Citation text is present in the saved document.".to_string());
    } else {
        details.push("Citation text is not present in the saved document.".to_string());
        return (false, details);
    }

    let citation_key = string_field(artifact, &["citationKey"]);
    if citation_key.is_empty() {
        details.push("Artifact has no citation key.".to_string());
        return (false, details);
    }
    details.push(format!("Citation key resolved: {citation_key}"));
    (true, details)
}

fn verify_reference_patch(artifact: &Value, reference: &Value) -> (bool, Vec<String>) {
    let updates = artifact.get("updates").cloned().unwrap_or(Value::Null);
    let Some(object) = updates.as_object() else {
        return (false, vec!["Reference patch has no updates.".to_string()]);
    };
    if !reference.is_object() {
        return (
            false,
            vec!["Reference snapshot is unavailable for verification.".to_string()],
        );
    }

    let mut details = Vec::new();
    for (key, expected) in object {
        let expected_text = expected
            .as_str()
            .map(trim)
            .unwrap_or_else(|| expected.to_string());
        let current_text = reference
            .get(key)
            .and_then(Value::as_str)
            .map(trim)
            .unwrap_or_else(|| reference.get(key).map(Value::to_string).unwrap_or_default());
        if expected_text != current_text {
            details.push(format!(
                "Field mismatch for {key}: expected `{expected_text}`, got `{current_text}`."
            ));
            return (false, details);
        }
        details.push(format!("Verified field {key}."));
    }
    (true, details)
}

fn verify_note_draft(created_path: &str) -> (bool, Vec<String>) {
    let normalized_path = trim(created_path);
    if normalized_path.is_empty() {
        return (false, vec!["Draft path is missing.".to_string()]);
    }
    if Path::new(&normalized_path).exists() {
        (true, vec!["Draft file exists on disk.".to_string()])
    } else {
        (
            false,
            vec!["Draft file does not exist on disk.".to_string()],
        )
    }
}

fn build_verification_record(params: &ResearchVerificationRunParams) -> ResearchVerificationRecord {
    let kind = string_field(&params.artifact, &["type"]);
    let (passed, details) = match kind.as_str() {
        "doc_patch" => verify_doc_patch(&params.artifact, &params.content),
        "citation_insert" => {
            verify_citation_insert(&params.artifact, &params.content, &params.citation_text)
        }
        "reference_patch" => verify_reference_patch(&params.artifact, &params.reference),
        "note_draft" => verify_note_draft(&params.created_path),
        _ => (
            false,
            vec!["Unsupported artifact type for verification.".to_string()],
        ),
    };
    let (status, summary, blocking) = status_and_summary(passed, &kind);
    let now = now_ms();
    ResearchVerificationRecord {
        id: format!("verification:{}", Uuid::new_v4()),
        task_id: trim(&params.task_id),
        artifact_id: trim(&params.artifact_id),
        kind,
        status,
        summary,
        details,
        blocking,
        created_at: now,
        updated_at: now,
    }
}

pub(crate) fn list_research_verifications_for_task(
    workspace_path: &str,
    task_id: &str,
) -> Result<Vec<ResearchVerificationRecord>, String> {
    let normalized_workspace_path = trim(workspace_path);
    let normalized_task_id = trim(task_id);
    if normalized_workspace_path.is_empty() || normalized_task_id.is_empty() {
        return Ok(Vec::new());
    }
    let mut verifications = load_workspace_verifications(&normalized_workspace_path)?
        .into_iter()
        .filter(|entry| entry.task_id == normalized_task_id)
        .collect::<Vec<_>>();
    verifications.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(verifications)
}

#[tauri::command]
pub async fn research_verification_run(
    params: ResearchVerificationRunParams,
) -> Result<ResearchVerificationRunResponse, String> {
    let normalized_workspace_path = trim(&params.workspace_path);
    if normalized_workspace_path.is_empty() {
        return Err("Workspace path is required for research verification.".to_string());
    }
    let mut verifications = load_workspace_verifications(&normalized_workspace_path)?;
    let verification = build_verification_record(&params);
    verifications.push(verification.clone());
    verifications.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    persist_workspace_verifications(&normalized_workspace_path, &verifications)?;

    if !trim(&params.task_id).is_empty() {
        let _ = research_task_update(ResearchTaskUpdateParams {
            workspace_path: normalized_workspace_path.clone(),
            task_id: trim(&params.task_id),
            title: None,
            goal: None,
            kind: None,
            status: Some(if verification.blocking {
                "blocked".to_string()
            } else {
                "active".to_string()
            }),
            phase: Some("verification".to_string()),
            success_criteria: None,
            active_document_paths: None,
            reference_ids: None,
            evidence_ids: None,
            artifact_ids: None,
            verification_summary: Some(verification.summary.clone()),
            blocked_reason: Some(if verification.blocking {
                verification.summary.clone()
            } else {
                String::new()
            }),
            resume_hint: Some(if verification.blocking {
                "修复验证失败项后重新运行 artifact application。".to_string()
            } else {
                String::new()
            }),
        })
        .await;
    }

    Ok(ResearchVerificationRunResponse { verification })
}

#[tauri::command]
pub async fn research_verification_list(
    params: ResearchVerificationListParams,
) -> Result<ResearchVerificationListResponse, String> {
    Ok(ResearchVerificationListResponse {
        verifications: if trim(&params.task_id).is_empty() {
            let mut verifications = load_workspace_verifications(&params.workspace_path)?;
            verifications.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
            verifications
        } else {
            list_research_verifications_for_task(&params.workspace_path, &params.task_id)?
        },
    })
}
