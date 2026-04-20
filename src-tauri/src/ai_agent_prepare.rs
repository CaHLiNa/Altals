use serde::Deserialize;
use serde_json::{json, Value};

use crate::ai_config::ai_config_load_internal;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAgentPrepareCurrentConfigParams {
    pub active_session: Value,
    #[serde(default)]
    pub workspace_path: String,
    #[serde(default)]
    pub context_bundle: Value,
}

fn string_field(value: &Value, keys: &[&str]) -> String {
    for key in keys {
        if let Some(entry) = value.get(*key).and_then(Value::as_str) {
            let normalized = entry.trim();
            if !normalized.is_empty() {
                return normalized.to_string();
            }
        }
    }
    String::new()
}

fn nested_string_field(value: &Value, path: &[&str]) -> String {
    let mut current = value;
    for key in path {
        current = match current.get(*key) {
            Some(next) => next,
            None => return String::new(),
        };
    }
    current
        .as_str()
        .map(|entry| entry.trim().to_string())
        .unwrap_or_default()
}

fn nested_bool_field(value: &Value, path: &[&str]) -> bool {
    let mut current = value;
    for key in path {
        current = match current.get(*key) {
            Some(next) => next,
            None => return false,
        };
    }
    current.as_bool().unwrap_or(false)
}

fn nested_i64_field(value: &Value, path: &[&str]) -> Option<i64> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_i64()
}

fn truncate_text(value: &str, max_chars: usize) -> String {
    let normalized = value.trim();
    if normalized.is_empty() {
        return String::new();
    }

    let truncated = normalized.chars().take(max_chars).collect::<String>();
    if normalized.chars().count() <= max_chars {
        truncated
    } else {
        format!("{}…", truncated.trim_end())
    }
}

fn push_context_line(lines: &mut Vec<String>, label: &str, value: &str) {
    let normalized = value.trim();
    if normalized.is_empty() {
        return;
    }
    lines.push(format!("- {label}: {normalized}"));
}

fn contains_any(value: &str, patterns: &[&str]) -> bool {
    patterns.iter().any(|pattern| value.contains(pattern))
}

fn looks_like_trivial_prompt(prompt: &str) -> bool {
    let normalized = prompt.trim().to_lowercase();
    if normalized.is_empty() {
        return true;
    }
    if normalized.chars().count() > 14 {
        return false;
    }
    contains_any(
        &normalized,
        &[
            "测试", "test", "ping", "hello", "hi", "你好", "在吗", "在么", "ok", "好的", "收到",
            "1",
        ],
    )
}

fn should_include_selection_context(prompt: &str) -> bool {
    contains_any(
        prompt,
        &[
            "这段",
            "这句话",
            "这一句",
            "选区",
            "selection",
            "selected",
            "paragraph",
            "sentence",
            "excerpt",
            "quote",
            "改写",
            "润色",
            "翻译",
            "解释",
            "补充",
            "expand",
            "shorten",
        ],
    )
}

fn should_include_reference_context(prompt: &str) -> bool {
    contains_any(
        prompt,
        &[
            "引用",
            "文献",
            "参考文献",
            "citation",
            "reference",
            "cite",
            "bib",
            "bibtex",
            "论文",
            "paper",
            "related work",
        ],
    )
}

fn should_include_document_context(prompt: &str) -> bool {
    should_include_selection_context(prompt)
        || should_include_reference_context(prompt)
        || contains_any(
            prompt,
            &[
                "当前文档",
                "这个文档",
                "本文",
                "稿子",
                "章节",
                "section",
                "document",
                "draft",
                "文章",
                "文件",
                "file",
                "intro",
                "abstract",
                "结论",
                "继续写",
                "summarize",
                "总结",
            ],
        )
}

fn should_include_workspace_context(prompt: &str) -> bool {
    should_include_document_context(prompt)
        || contains_any(
            prompt,
            &[
                "工作区",
                "workspace",
                "项目",
                "repo",
                "repository",
                "路径",
                "目录",
                "folder",
                "结构",
            ],
        )
}

fn build_context_sections(
    prompt_draft: &str,
    context_bundle: &Value,
    workspace_path: &str,
) -> (Vec<String>, Vec<String>) {
    let mut sections = Vec::new();
    let mut context_chips = Vec::new();
    let normalized_prompt = prompt_draft.trim().to_lowercase();

    if looks_like_trivial_prompt(&normalized_prompt) {
        return (sections, context_chips);
    }

    let workspace_value = nested_string_field(context_bundle, &["workspace", "path"]);
    let workspace_value = if workspace_value.is_empty() {
        workspace_path.trim().to_string()
    } else {
        workspace_value
    };
    if !workspace_value.is_empty() && should_include_workspace_context(&normalized_prompt) {
        sections.push(format!("workspace root: {}", workspace_value));
        context_chips.push("workspace".to_string());
    }

    let document_available = nested_bool_field(context_bundle, &["document", "available"]);
    let document_path = nested_string_field(context_bundle, &["document", "filePath"]);
    if (document_available || !document_path.is_empty())
        && should_include_document_context(&normalized_prompt)
    {
        let document_kind = if nested_bool_field(context_bundle, &["document", "isLatex"]) {
            "LaTeX"
        } else if nested_bool_field(context_bundle, &["document", "isMarkdown"]) {
            "Markdown"
        } else {
            ""
        };
        let document_line = if document_kind.is_empty() {
            format!("active document: {}", document_path)
        } else {
            format!("active document: {} ({})", document_path, document_kind)
        };
        sections.push(document_line);
        context_chips.push("document".to_string());
    }

    let selection_available = nested_bool_field(context_bundle, &["selection", "available"]);
    let selection_text = truncate_text(
        &nested_string_field(context_bundle, &["selection", "text"]),
        2400,
    );
    if (selection_available || !selection_text.is_empty())
        && should_include_selection_context(&normalized_prompt)
    {
        let mut lines = Vec::new();
        let selection_file = nested_string_field(context_bundle, &["selection", "filePath"]);
        push_context_line(&mut lines, "file", &selection_file);
        let selection_from = nested_i64_field(context_bundle, &["selection", "from"]);
        let selection_to = nested_i64_field(context_bundle, &["selection", "to"]);
        if let (Some(from), Some(to)) = (selection_from, selection_to) {
            lines.push(format!("- range: {from}-{to}"));
        }
        push_context_line(
            &mut lines,
            "preview",
            &truncate_text(
                &nested_string_field(context_bundle, &["selection", "preview"]),
                280,
            ),
        );
        if !selection_text.is_empty() {
            lines.push("- selected text excerpt:".to_string());
            lines.push("```text".to_string());
            lines.push(selection_text);
            lines.push("```".to_string());
        }

        if !lines.is_empty() {
            sections.push(format!("selection context:\n{}", lines.join("\n")));
            context_chips.push("selection".to_string());
        }
    }

    let reference_available = nested_bool_field(context_bundle, &["reference", "available"]);
    let reference_title = nested_string_field(context_bundle, &["reference", "title"]);
    if (reference_available || !reference_title.is_empty())
        && should_include_reference_context(&normalized_prompt)
    {
        let citation_key = nested_string_field(context_bundle, &["reference", "citationKey"]);
        let authors = nested_string_field(context_bundle, &["reference", "authorLine"]);
        let year = nested_string_field(context_bundle, &["reference", "year"]);
        let mut reference_bits = vec![reference_title];
        if !citation_key.is_empty() {
            reference_bits.push(format!("[{}]", citation_key));
        }
        let mut trailing = Vec::new();
        if !authors.is_empty() {
            trailing.push(authors);
        }
        if !year.is_empty() {
            trailing.push(year);
        }
        if !trailing.is_empty() {
            reference_bits.push(trailing.join(", "));
        }
        sections.push(format!("active reference: {}", reference_bits.join(" — ")));
        context_chips.push("reference".to_string());
    }

    (sections, context_chips)
}

fn build_dispatch_prompt(
    prompt_draft: &str,
    context_bundle: &Value,
    workspace_path: &str,
) -> (String, Value) {
    let normalized_prompt = prompt_draft.trim().to_string();
    let (context_sections, context_chips) =
        build_context_sections(prompt_draft, context_bundle, workspace_path);
    let summary = if context_sections.is_empty() {
        Value::Null
    } else {
        Value::Array(
            context_sections
                .iter()
                .cloned()
                .map(Value::String)
                .collect::<Vec<_>>(),
        )
    };
    let context_summary = json!({
        "summary": summary,
        "chips": context_chips,
    });

    if context_sections.is_empty() {
        return (normalized_prompt, context_summary);
    }

    let mut blocks = Vec::new();
    blocks.push(
        "内部任务上下文如下，仅供参考使用。不要逐项复述这些上下文，也不要把它们当作回答开场；直接完成用户请求，必要时再引用其中与答案直接相关的部分。"
            .to_string(),
    );
    blocks.push(context_sections.join("\n"));
    if !normalized_prompt.is_empty() {
        blocks.push(format!("用户请求：\n{}", normalized_prompt));
    }

    (blocks.join("\n\n"), context_summary)
}

fn build_codex_acp_runtime_state(config: &Value) -> Value {
    json!({
        "providerId": "codex-acp",
        "label": "Codex ACP",
        "ready": true,
        "model": string_field(config, &["model"]),
        "runtimeBackend": "codex-acp",
    })
}

fn build_minimal_codex_acp_prepared_run(
    session: Value,
    workspace_path: &str,
    context_bundle: &Value,
    provider_config: Value,
    provider_state: Value,
) -> Value {
    let prompt_draft = string_field(&session, &["promptDraft", "prompt_draft"]);
    let (dispatch_prompt, context_summary) =
        build_dispatch_prompt(&prompt_draft, context_bundle, workspace_path);

    json!({
        "ok": true,
        "session": session.clone(),
        "sessionMode": "agent",
        "isAgentSession": true,
        "promptDraft": prompt_draft.clone(),
        "userInstruction": prompt_draft,
        "dispatchPrompt": dispatch_prompt,
        "contextSummary": context_summary,
        "providerState": provider_state,
        "providerId": "codex-acp",
        "config": provider_config,
        "effectivePermissionMode": "accept-edits",
        "runtimeIntent": "agent",
        "attachments": session
            .get("attachments")
            .cloned()
            .unwrap_or_else(|| Value::Array(Vec::new())),
        "workspacePath": workspace_path.trim(),
        "runtimeTransport": "codex-acp",
    })
}

#[tauri::command]
pub async fn ai_agent_prepare_current_config(
    params: AiAgentPrepareCurrentConfigParams,
) -> Result<Value, String> {
    let config = ai_config_load_internal().await?;
    let provider_config = config.get("codexCli").cloned().unwrap_or(Value::Null);
    let provider_state = build_codex_acp_runtime_state(&provider_config);

    Ok(build_minimal_codex_acp_prepared_run(
        params.active_session,
        &params.workspace_path,
        &params.context_bundle,
        provider_config,
        provider_state,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dispatch_prompt_keeps_raw_prompt_when_no_context_exists() {
        let (dispatch_prompt, context_summary) =
            build_dispatch_prompt("整理这一段论证", &Value::Null, "");

        assert_eq!(dispatch_prompt, "整理这一段论证");
        assert!(context_summary.get("summary").is_some_and(Value::is_null));
        assert_eq!(
            context_summary
                .get("chips")
                .and_then(Value::as_array)
                .map(Vec::len),
            Some(0)
        );
    }

    #[test]
    fn dispatch_prompt_includes_research_context_sections() {
        let context_bundle = json!({
            "workspace": { "path": "/tmp/project", "available": true },
            "document": {
                "filePath": "/tmp/project/paper.tex",
                "isLatex": true,
                "available": true
            },
            "selection": {
                "filePath": "/tmp/project/paper.tex",
                "from": 12,
                "to": 30,
                "preview": "This is the selected preview",
                "text": "This is the selected text.",
                "available": true
            },
            "reference": {
                "id": "ref-1",
                "title": "Attention Is All You Need",
                "citationKey": "vaswani2017attention",
                "authorLine": "Vaswani et al.",
                "year": "2017",
                "available": true
            }
        });

        let (dispatch_prompt, context_summary) =
            build_dispatch_prompt("把这段改得更学术一些", &context_bundle, "/tmp/project");

        assert!(dispatch_prompt.contains("workspace root: /tmp/project"));
        assert!(dispatch_prompt.contains("active document: /tmp/project/paper.tex (LaTeX)"));
        assert!(dispatch_prompt.contains("selection context:"));
        assert!(dispatch_prompt.contains("active reference: Attention Is All You Need"));
        assert!(dispatch_prompt.contains("用户请求：\n把这段改得更学术一些"));
        assert!(context_summary
            .get("summary")
            .and_then(Value::as_array)
            .is_some());
        assert_eq!(
            context_summary
                .get("chips")
                .and_then(Value::as_array)
                .map(Vec::len),
            Some(4)
        );
    }

    #[test]
    fn dispatch_prompt_skips_context_for_trivial_prompt() {
        let context_bundle = json!({
            "workspace": { "path": "/tmp/project", "available": true },
            "document": {
                "filePath": "/tmp/project/paper.tex",
                "isLatex": true,
                "available": true
            },
            "selection": {
                "filePath": "/tmp/project/paper.tex",
                "from": 12,
                "to": 30,
                "preview": "This is the selected preview",
                "text": "This is the selected text.",
                "available": true
            }
        });

        let (dispatch_prompt, context_summary) =
            build_dispatch_prompt("测试", &context_bundle, "/tmp/project");

        assert_eq!(dispatch_prompt, "测试");
        assert!(context_summary.get("summary").is_some_and(Value::is_null));
        assert_eq!(
            context_summary
                .get("chips")
                .and_then(Value::as_array)
                .map(Vec::len),
            Some(0)
        );
    }
}
