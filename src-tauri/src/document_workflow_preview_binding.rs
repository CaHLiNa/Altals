use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocumentWorkflowPreviewBinding {
    #[serde(default)]
    pub preview_path: String,
    #[serde(default)]
    pub source_path: String,
    #[serde(default)]
    pub preview_kind: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub pane_id: String,
    #[serde(default = "default_detach_on_close")]
    pub detach_on_close: bool,
}

fn default_detach_on_close() -> bool {
    true
}

pub(crate) fn normalize_path(value: &str) -> String {
    value.trim().to_string()
}

pub(crate) fn normalize_workflow_kind(value: &str) -> String {
    match value.trim() {
        "markdown" => "markdown".to_string(),
        "latex" => "latex".to_string(),
        "python" => "python".to_string(),
        _ => String::new(),
    }
}

pub(crate) fn normalize_preview_kind(value: &str) -> String {
    match value.trim() {
        "html" => "html".to_string(),
        "pdf" => "pdf".to_string(),
        "terminal" => "terminal".to_string(),
        _ => String::new(),
    }
}

pub fn normalize_preview_binding(
    binding: DocumentWorkflowPreviewBinding,
) -> Option<DocumentWorkflowPreviewBinding> {
    let preview_path = normalize_path(&binding.preview_path);
    let source_path = normalize_path(&binding.source_path);
    if preview_path.is_empty() || source_path.is_empty() {
        return None;
    }

    Some(DocumentWorkflowPreviewBinding {
        preview_path,
        source_path,
        preview_kind: normalize_preview_kind(&binding.preview_kind),
        kind: normalize_workflow_kind(&binding.kind),
        pane_id: normalize_path(&binding.pane_id),
        detach_on_close: binding.detach_on_close,
    })
}

pub fn normalize_preview_binding_set(
    bindings: Vec<DocumentWorkflowPreviewBinding>,
) -> Vec<DocumentWorkflowPreviewBinding> {
    let mut seen_paths = HashSet::new();
    let mut normalized = Vec::new();

    for binding in bindings {
        let Some(next_binding) = normalize_preview_binding(binding) else {
            continue;
        };
        if seen_paths.insert(next_binding.preview_path.clone()) {
            normalized.push(next_binding);
        }
    }

    normalized
}

pub fn normalize_preview_binding_values(bindings: Vec<Value>) -> Vec<Value> {
    normalize_preview_binding_set(
        bindings
            .into_iter()
            .filter_map(|binding| {
                serde_json::from_value::<DocumentWorkflowPreviewBinding>(binding).ok()
            })
            .collect(),
    )
    .into_iter()
    .filter_map(|binding| serde_json::to_value(binding).ok())
    .collect()
}

pub fn find_preview_binding_value(bindings: &[Value], preview_path: &str) -> Option<Value> {
    let normalized_preview_path = normalize_path(preview_path);
    normalize_preview_binding_values(bindings.to_vec())
        .into_iter()
        .find(|binding| {
            binding.get("previewPath").and_then(Value::as_str)
                == Some(normalized_preview_path.as_str())
        })
}

pub fn find_open_preview_path_value(
    bindings: &[Value],
    source_path: &str,
    preview_kind: &str,
) -> Option<String> {
    let normalized_source_path = normalize_path(source_path);
    let normalized_preview_kind = normalize_preview_kind(preview_kind);

    normalize_preview_binding_values(bindings.to_vec())
        .into_iter()
        .find(|binding| {
            binding.get("sourcePath").and_then(Value::as_str)
                == Some(normalized_source_path.as_str())
                && (normalized_preview_kind.is_empty()
                    || binding.get("previewKind").and_then(Value::as_str)
                        == Some(normalized_preview_kind.as_str()))
        })
        .and_then(|binding| {
            binding
                .get("previewPath")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
}

#[cfg(test)]
mod tests {
    use super::{normalize_preview_binding_set, DocumentWorkflowPreviewBinding};

    #[test]
    fn normalizes_and_dedupes_preview_bindings() {
        let normalized = normalize_preview_binding_set(vec![
            DocumentWorkflowPreviewBinding {
                preview_path: " preview:/tmp/demo.md ".to_string(),
                source_path: " /tmp/demo.md ".to_string(),
                preview_kind: "html".to_string(),
                kind: "markdown".to_string(),
                pane_id: " pane-1 ".to_string(),
                detach_on_close: true,
            },
            DocumentWorkflowPreviewBinding {
                preview_path: "preview:/tmp/demo.md".to_string(),
                source_path: "/tmp/other.md".to_string(),
                preview_kind: "weird".to_string(),
                kind: "weird".to_string(),
                pane_id: "pane-2".to_string(),
                detach_on_close: true,
            },
        ]);

        assert_eq!(normalized.len(), 1);
        assert_eq!(normalized[0].preview_path, "preview:/tmp/demo.md");
        assert_eq!(normalized[0].source_path, "/tmp/demo.md");
        assert_eq!(normalized[0].preview_kind, "html");
        assert_eq!(normalized[0].kind, "markdown");
        assert_eq!(normalized[0].pane_id, "pane-1");
    }
}
