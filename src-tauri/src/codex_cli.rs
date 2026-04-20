use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::OnceLock;
use tokio::process::Command;
use tokio::sync::Mutex;

static CODEX_EXEC_SEARCH_FLAG_SUPPORT: OnceLock<Mutex<HashMap<String, bool>>> = OnceLock::new();

fn search_flag_support_cache() -> &'static Mutex<HashMap<String, bool>> {
    CODEX_EXEC_SEARCH_FLAG_SUPPORT.get_or_init(|| Mutex::new(HashMap::new()))
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

fn bool_field(value: &Value, keys: &[&str]) -> bool {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_bool))
        .unwrap_or(false)
}

fn normalize_codex_cli_config(config: &Value) -> Value {
    let command_path = string_field(config, &["commandPath", "command"]);
    let sandbox_mode = match string_field(config, &["sandboxMode", "sandbox"]).as_str() {
        "read-only" => "read-only",
        "danger-full-access" => "danger-full-access",
        "workspace-write" => "workspace-write",
        _ => "workspace-write",
    };
    let resolved_command_path = if command_path.is_empty() {
        "codex".to_string()
    } else {
        command_path
    };
    json!({
        "commandPath": resolved_command_path,
        "model": string_field(config, &["model"]),
        "profile": string_field(config, &["profile"]),
        "sandboxMode": sandbox_mode,
        "webSearch": bool_field(config, &["webSearch"]),
        "useAsciiWorkspaceAlias": config
            .get("useAsciiWorkspaceAlias")
            .and_then(Value::as_bool)
            .unwrap_or(true),
    })
}

async fn resolve_command_state(command_path: &str) -> (bool, String, String) {
    let normalized = if command_path.trim().is_empty() {
        "codex"
    } else {
        command_path.trim()
    };
    match Command::new(normalized).arg("--version").output().await {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let version = if stdout.is_empty() { stderr.clone() } else { stdout };
            (output.status.success(), version, stderr)
        }
        Err(error) => (false, String::new(), error.to_string()),
    }
}

async fn codex_exec_supports_search_flag(command_path: &str) -> bool {
    let normalized = if command_path.trim().is_empty() {
        "codex".to_string()
    } else {
        command_path.trim().to_string()
    };

    if let Some(cached) = search_flag_support_cache()
        .lock()
        .await
        .get(&normalized)
        .copied()
    {
        return cached;
    }

    let supported = match Command::new(&normalized)
        .arg("exec")
        .arg("--help")
        .output()
        .await
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            stdout.contains("--search") || stderr.contains("--search")
        }
        Err(_) => false,
    };

    search_flag_support_cache()
        .lock()
        .await
        .insert(normalized, supported);
    supported
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexCliStateResolveParams {
    #[serde(default)]
    pub config: Value,
}

#[tauri::command]
pub async fn codex_cli_state_resolve(params: CodexCliStateResolveParams) -> Result<Value, String> {
    let normalized = normalize_codex_cli_config(&params.config);
    let command_path = string_field(&normalized, &["commandPath"]);
    let (installed, version, error) = resolve_command_state(&command_path).await;
    let supports_search_flag = if installed {
        codex_exec_supports_search_flag(&command_path).await
    } else {
        false
    };
    let model = string_field(&normalized, &["model"]);
    let profile = string_field(&normalized, &["profile"]);

    Ok(json!({
        "installed": installed,
        "ready": installed,
        "commandPath": command_path,
        "version": version,
        "error": if installed { String::new() } else { error },
        "model": model,
        "profile": profile,
        "sandboxMode": string_field(&normalized, &["sandboxMode"]),
        "webSearch": bool_field(&normalized, &["webSearch"]),
        "supportsSearchFlag": supports_search_flag,
        "useAsciiWorkspaceAlias": normalized
            .get("useAsciiWorkspaceAlias")
            .and_then(Value::as_bool)
            .unwrap_or(true),
        "displayModel": if !model.is_empty() {
            model
        } else if !profile.is_empty() {
            format!("profile:{profile}")
        } else {
            "Codex defaults".to_string()
        },
    }))
}
