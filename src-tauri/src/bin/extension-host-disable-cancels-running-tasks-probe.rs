use scribeflow_lib::{
    extension_task_cancel_extension_for_probe, extension_task_create_command_for_probe,
    ExtensionHostState, ExtensionTaskRuntimeState,
};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

fn unique_temp_dir() -> Result<PathBuf, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Failed to read current time: {error}"))?
        .as_millis();
    let root =
        std::env::temp_dir().join(format!("scribeflow-extension-disable-cancel-contract-{now}"));
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create probe temp root {}: {error}", root.display()))?;
    Ok(root)
}

fn tasks_file_path(home_root: &Path) -> PathBuf {
    home_root.join(".scribeflow").join("extension-tasks").join("tasks.json")
}

fn task_entry(home_root: &Path, task_id: &str) -> Result<Option<Value>, String> {
    let path = tasks_file_path(home_root);
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read extension tasks file {}: {error}", path.display()))?;
    let parsed = serde_json::from_str::<Value>(&content)
        .map_err(|error| format!("Failed to parse extension tasks file {}: {error}", path.display()))?;
    Ok(parsed
        .get("tasks")
        .and_then(Value::as_array)
        .and_then(|tasks| {
            tasks.iter().find_map(|entry| {
                let id = entry.get("id").and_then(Value::as_str).unwrap_or("");
                if id == task_id {
                    Some(entry.clone())
                } else {
                    None
                }
            })
        }))
}

#[cfg(unix)]
fn set_home_dir(path: &Path) {
    unsafe {
        std::env::set_var("HOME", path);
    }
}

#[cfg(not(unix))]
fn set_home_dir(path: &Path) {
    unsafe {
        std::env::set_var("HOME", path);
    }
}

fn reset_home_dir(original_home: Option<std::ffi::OsString>) {
    match original_home {
        Some(value) => unsafe {
            std::env::set_var("HOME", value);
        },
        None => unsafe {
            std::env::remove_var("HOME");
        },
    }
}

fn main() -> Result<(), String> {
    let probe_root = unique_temp_dir()?;
    let home_root = probe_root.join("home");
    fs::create_dir_all(&home_root)
        .map_err(|error| format!("Failed to create probe home dir: {error}"))?;
    let original_home = std::env::var_os("HOME");
    set_home_dir(&home_root);
    let result = run_probe(&home_root);
    reset_home_dir(original_home);
    result
}

fn run_probe(home_root: &Path) -> Result<(), String> {
    let runtime = ExtensionTaskRuntimeState::default();
    let host_state = ExtensionHostState::default();

    let running = extension_task_create_command_for_probe(
        "example-pdf-extension",
        "scribeflow.pdf.translate",
        "pdf",
        "/tmp/paper-a.pdf",
    )?;
    let queued = extension_task_create_command_for_probe(
        "example-pdf-extension",
        "scribeflow.pdf.summarize",
        "pdf",
        "/tmp/paper-b.pdf",
    )?;
    let other = extension_task_create_command_for_probe(
        "other-extension",
        "scribeflow.pdf.translate",
        "pdf",
        "/tmp/paper-c.pdf",
    )?;

    runtime.register_pid(&running.id, 4242)?;
    runtime.register_pid(&queued.id, 4243)?;
    runtime.register_pid(&other.id, 4244)?;

    let tasks_path = tasks_file_path(home_root);
    let content = fs::read_to_string(&tasks_path)
        .map_err(|error| format!("Failed to read seeded extension tasks file {}: {error}", tasks_path.display()))?;
    let mut parsed = serde_json::from_str::<Value>(&content)
        .map_err(|error| format!("Failed to parse seeded extension tasks file {}: {error}", tasks_path.display()))?;
    let tasks = parsed
        .get_mut("tasks")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| "Seeded tasks payload is missing tasks array".to_string())?;
    for task in tasks {
        let id = task
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        if id == running.id {
            task["state"] = Value::String("running".to_string());
            task["startedAt"] = Value::String("2026-05-02T10:00:00Z".to_string());
            task["outputs"] = json!([
                {
                    "id": "running-summary",
                    "type": "inlineText",
                    "mediaType": "text/plain",
                    "title": "Running Summary",
                    "text": "worker active"
                }
            ]);
        }
        if id == other.id {
            task["state"] = Value::String("running".to_string());
            task["startedAt"] = Value::String("2026-05-02T11:00:00Z".to_string());
        }
    }
    fs::write(
        &tasks_path,
        serde_json::to_string_pretty(&parsed)
            .map_err(|error| format!("Failed to serialize seeded tasks file {}: {error}", tasks_path.display()))?,
    )
    .map_err(|error| format!("Failed to write seeded tasks file {}: {error}", tasks_path.display()))?;

    let cancelled = extension_task_cancel_extension_for_probe(
        "example-pdf-extension",
        &runtime,
        &host_state,
    )?;

    if cancelled.len() != 2 {
        return Err(format!(
            "Expected exactly 2 cancelled tasks for disabled extension, got {}",
            cancelled.len()
        ));
    }
    if !cancelled.iter().all(|task| task.state == "cancelled") {
        return Err(format!(
            "Cancelled task state drifted: {:?}",
            cancelled.iter().map(|task| task.state.clone()).collect::<Vec<_>>()
        ));
    }
    if runtime.unregister_pid(&running.id)?.is_some() {
        return Err("Running task pid ownership was not cleared on extension disable".to_string());
    }
    if runtime.unregister_pid(&queued.id)?.is_some() {
        return Err("Queued task pid ownership was not cleared on extension disable".to_string());
    }
    if runtime.unregister_pid(&other.id)? != Some(4244) {
        return Err("Other extension pid ownership should remain intact".to_string());
    }

    let persisted_running = task_entry(home_root, &running.id)?
        .ok_or_else(|| "Persisted running task record missing after extension disable".to_string())?;
    let persisted_queued = task_entry(home_root, &queued.id)?
        .ok_or_else(|| "Persisted queued task record missing after extension disable".to_string())?;
    let persisted_other = task_entry(home_root, &other.id)?
        .ok_or_else(|| "Persisted other extension task record missing after extension disable".to_string())?;

    if persisted_running.get("state").and_then(Value::as_str).unwrap_or("") != "cancelled" {
        return Err(format!(
            "Running task did not persist cancelled state after extension disable: {persisted_running}"
        ));
    }
    if persisted_queued.get("state").and_then(Value::as_str).unwrap_or("") != "cancelled" {
        return Err(format!(
            "Queued task did not persist cancelled state after extension disable: {persisted_queued}"
        ));
    }
    if persisted_other.get("state").and_then(Value::as_str).unwrap_or("") != "running" {
        return Err(format!(
            "Other extension task state drifted during disable cancellation: {persisted_other}"
        ));
    }
    if persisted_running
        .get("outputs")
        .and_then(Value::as_array)
        .and_then(|entries| entries.first())
        .and_then(|entry| entry.get("text"))
        .and_then(Value::as_str)
        != Some("worker active")
    {
        return Err(format!(
            "Cancelled running task lost its last output snapshot on extension disable: {persisted_running}"
        ));
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "ok": true,
            "summary": {
                "cancelledTaskIds": cancelled.iter().map(|task| task.id.clone()).collect::<Vec<_>>(),
                "runningTaskState": persisted_running.get("state").and_then(Value::as_str).unwrap_or(""),
                "queuedTaskState": persisted_queued.get("state").and_then(Value::as_str).unwrap_or(""),
                "otherTaskState": persisted_other.get("state").and_then(Value::as_str).unwrap_or(""),
                "preservedRunningOutputText": persisted_running
                    .get("outputs")
                    .and_then(Value::as_array)
                    .and_then(|entries| entries.first())
                    .and_then(|entry| entry.get("text"))
                    .and_then(Value::as_str)
                    .unwrap_or("")
            }
        }))
        .map_err(|error| format!("Failed to serialize extension disable cancel summary: {error}"))?
    );

    Ok(())
}
