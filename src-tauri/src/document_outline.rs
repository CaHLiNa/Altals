use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

use crate::latex_project_graph::{resolve_graph_value, LatexProjectGraphParams};
use crate::markdown_runtime::extract_markdown_headings;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentOutlineResolveParams {
    #[serde(default)]
    pub file_path: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub flat_files: Vec<String>,
    #[serde(default)]
    pub content_overrides: HashMap<String, String>,
}

fn normalize_path(path: &str) -> String {
    path.trim().replace('\\', "/")
}

fn lower_path(path: &str) -> String {
    normalize_path(path).to_ascii_lowercase()
}

fn is_markdown_path(path: &str) -> bool {
    let path = lower_path(path);
    path.ends_with(".md") || path.ends_with(".markdown")
}

fn is_latex_path(path: &str) -> bool {
    let path = lower_path(path);
    path.ends_with(".tex") || path.ends_with(".latex")
}

fn resolve_primary_content(params: &DocumentOutlineResolveParams, normalized_path: &str) -> String {
    if let Some(content) = params.content_overrides.get(normalized_path) {
        return content.clone();
    }
    params.content.clone()
}

#[tauri::command]
pub async fn document_outline_resolve(
    params: DocumentOutlineResolveParams,
) -> Result<Vec<Value>, String> {
    let normalized_path = normalize_path(&params.file_path);
    if normalized_path.is_empty() {
        return Ok(Vec::new());
    }

    if is_markdown_path(&normalized_path) {
        let content = resolve_primary_content(&params, &normalized_path);
        let items = extract_markdown_headings(&content)?;
        return items
            .into_iter()
            .map(|item| serde_json::to_value(item).map_err(|error| error.to_string()))
            .collect();
    }

    if is_latex_path(&normalized_path) {
        let mut content_overrides = params.content_overrides.clone();
        if !params.content.is_empty() && !content_overrides.contains_key(&normalized_path) {
            content_overrides.insert(normalized_path.clone(), params.content.clone());
        }

        let graph = resolve_graph_value(&LatexProjectGraphParams {
            source_path: normalized_path,
            flat_files: params.flat_files,
            content_overrides,
        })
        .unwrap_or(Value::Null);

        let items = graph
            .get("outlineItems")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        return Ok(items);
    }

    Ok(Vec::new())
}
