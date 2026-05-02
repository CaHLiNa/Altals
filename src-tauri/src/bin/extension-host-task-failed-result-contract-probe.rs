use scribeflow_lib::{
    extension_command_record_result_for_probe, extension_host_activate_by_id_for_probe,
    extension_task_create_command_for_probe, ExtensionArtifact, ExtensionCapabilityOutput,
    ExtensionHostCapabilityResult, ExtensionHostState, ExtensionTaskRuntimeState,
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
        std::env::temp_dir().join(format!("scribeflow-extension-host-task-failed-contract-{now}"));
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create probe temp root {}: {error}", root.display()))?;
    Ok(root)
}

fn write_file(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create parent directory {}: {error}",
                parent.display()
            )
        })?;
    }
    fs::write(path, content)
        .map_err(|error| format!("Failed to write file {}: {error}", path.display()))
}

fn build_probe_extension(workspace_root: &Path) -> Result<PathBuf, String> {
    let extension_root = workspace_root
        .join(".scribeflow")
        .join("extensions")
        .join("example-task-failed-contract-extension");
    let manifest_path = extension_root.join("package.json");
    let entry_path = extension_root.join("dist").join("extension.js");
    let manifest = json!({
        "name": "example-task-failed-contract-extension",
        "displayName": "Example Task Failed Result Contract Extension",
        "version": "0.1.0",
        "type": "module",
        "main": "./dist/extension.js",
        "activationEvents": [
            "onCommand:exampleTaskFailedContractExtension.inspect"
        ],
        "contributes": {
            "commands": [
                {
                    "command": "exampleTaskFailedContractExtension.inspect",
                    "title": "Inspect Task Failed Result Contract"
                }
            ]
        },
        "permissions": {
            "readWorkspaceFiles": true
        }
    });
    let source = r#"
export async function activate(context) {
  context.commands.registerCommand('exampleTaskFailedContractExtension.inspect', async () => {
    return {
      message: 'worker exited with code 7',
      progressLabel: 'Worker failed',
      taskState: 'failed',
      artifacts: [
        {
          id: 'failure-log',
          kind: 'log',
          mediaType: 'text/plain',
          path: `${context.workspace.rootPath}/failure.log`,
        },
      ],
      outputs: [
        {
          id: 'failure-summary',
          type: 'inlineText',
          mediaType: 'text/plain',
          title: 'Failure Summary',
          text: 'worker stderr: boom',
        },
      ],
    }
  })
}
"#;

    write_file(
        &manifest_path,
        &serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("Failed to serialize task failed probe manifest: {error}"))?,
    )?;
    write_file(&entry_path, source)?;
    Ok(manifest_path)
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
    let task = parsed
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
        })
        .or(None);
    Ok(task)
}

fn remove_task_records(home_root: &Path, task_id: &str) -> Result<(), String> {
    let path = tasks_file_path(home_root);
    if !path.exists() {
        return Ok(());
    }
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read extension tasks file {}: {error}", path.display()))?;
    let mut parsed = serde_json::from_str::<Value>(&content)
        .map_err(|error| format!("Failed to parse extension tasks file {}: {error}", path.display()))?;
    let Some(tasks) = parsed.get_mut("tasks").and_then(Value::as_array_mut) else {
        return Ok(());
    };
    tasks.retain(|entry| {
        entry.get("id")
            .and_then(Value::as_str)
            .map(|id| id != task_id)
            .unwrap_or(true)
    });
    fs::write(
        &path,
        serde_json::to_string_pretty(&parsed)
            .map_err(|error| format!("Failed to serialize cleaned tasks file {}: {error}", path.display()))?,
    )
    .map_err(|error| format!("Failed to write cleaned tasks file {}: {error}", path.display()))
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
    let result = run_probe(&probe_root, &home_root);
    reset_home_dir(original_home);
    result
}

fn run_probe(probe_root: &Path, home_root: &Path) -> Result<(), String> {
    let workspace_root = probe_root.join("workspace");
    let global_config_dir = probe_root.join("global-config");
    fs::create_dir_all(&workspace_root)
        .map_err(|error| format!("Failed to create failed probe workspace dir: {error}"))?;
    fs::create_dir_all(&global_config_dir)
        .map_err(|error| format!("Failed to create failed probe global config dir: {error}"))?;

    let _manifest_path = build_probe_extension(&workspace_root)?;
    let workspace_root_text = workspace_root.to_string_lossy().to_string();
    let global_config_dir_text = global_config_dir.to_string_lossy().to_string();

    let state = ExtensionHostState::default();
    let runtime_state = ExtensionTaskRuntimeState::default();
    let activate = extension_host_activate_by_id_for_probe(
        &state,
        &global_config_dir_text,
        &workspace_root_text,
        "example-task-failed-contract-extension",
        "onCommand:exampleTaskFailedContractExtension.inspect",
    )?;
    if !activate.activated {
        return Err(format!(
            "Task failed contract extension did not activate: {}",
            activate.reason
        ));
    }

    let task = extension_task_create_command_for_probe(
        "example-task-failed-contract-extension",
        "exampleTaskFailedContractExtension.inspect",
        "workspace",
        &workspace_root.to_string_lossy(),
    )?;
    let task_id = task.id.clone();

    let result = extension_command_record_result_for_probe(
        &task,
        ExtensionHostCapabilityResult {
            accepted: true,
            message: "worker exited with code 7".to_string(),
            progress_label: "Worker failed".to_string(),
            task_state: "failed".to_string(),
            changed_views: Vec::new(),
            result_entries: Vec::new(),
            artifacts: vec![ExtensionArtifact {
                id: "failure-log".to_string(),
                extension_id: "example-task-failed-contract-extension".to_string(),
                task_id: task_id.clone(),
                capability: "exampleTaskFailedContractExtension.inspect".to_string(),
                kind: "log".to_string(),
                media_type: "text/plain".to_string(),
                path: workspace_root.join("failure.log").to_string_lossy().to_string(),
                source_path: workspace_root.to_string_lossy().to_string(),
                source_hash: String::new(),
                created_at: "2026-05-02T00:00:00Z".to_string(),
            }],
            outputs: vec![ExtensionCapabilityOutput {
                id: "failure-summary".to_string(),
                output_type: "inlineText".to_string(),
                media_type: "text/plain".to_string(),
                title: "Failure Summary".to_string(),
                description: workspace_root.to_string_lossy().to_string(),
                text: "worker stderr: boom".to_string(),
                html: String::new(),
            }],
        },
        &runtime_state,
        &state,
    )?;

    let persisted_task = task_entry(home_root, &task_id)?
        .ok_or_else(|| format!("Expected persisted task record for failed probe task {task_id}"))?;
    if result.task.outputs.first().map(|entry| entry.text.as_str()) != Some("worker stderr: boom") {
        return Err(format!(
            "Task failed result lost failure output summary: {:?}",
            result.task.outputs
        ));
    }
    if persisted_task
        .get("state")
        .and_then(Value::as_str)
        .unwrap_or("")
        != "failed"
    {
        return Err(format!(
            "Expected persisted failed task state, got {persisted_task}"
        ));
    }
    if persisted_task
        .get("progress")
        .and_then(Value::as_object)
        .and_then(|progress| progress.get("label"))
        .and_then(Value::as_str)
        .unwrap_or("")
        != "Worker failed"
    {
        return Err(format!(
            "Expected failed task progress label to preserve host label, got {persisted_task}"
        ));
    }
    if persisted_task
        .get("artifacts")
        .and_then(Value::as_array)
        .map(|entries| entries.len())
        .unwrap_or(0)
        != 1
    {
        return Err(format!(
            "Expected failed task to keep one artifact, got {persisted_task}"
        ));
    }
    if persisted_task
        .get("outputs")
        .and_then(Value::as_array)
        .map(|entries| entries.len())
        .unwrap_or(0)
        != 1
    {
        return Err(format!(
            "Expected failed task to keep one output, got {persisted_task}"
        ));
    }
    if persisted_task
        .get("outputs")
        .and_then(Value::as_array)
        .and_then(|entries| entries.first())
        .and_then(|entry| entry.get("title"))
        .and_then(Value::as_str)
        .unwrap_or("")
        != "Failure Summary"
    {
        return Err(format!(
            "Expected failed task output title to survive persistence, got {persisted_task}"
        ));
    }
    if persisted_task
        .get("error")
        .and_then(Value::as_str)
        .unwrap_or("")
        != "worker exited with code 7"
    {
        return Err(format!(
            "Expected failed task error to stay aligned with message, got {persisted_task}"
        ));
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "ok": true,
            "summary": {
                "taskId": task_id,
                "persistedState": persisted_task.get("state").and_then(Value::as_str).unwrap_or(""),
                "progressLabel": persisted_task
                    .get("progress")
                    .and_then(Value::as_object)
                    .and_then(|progress| progress.get("label"))
                    .and_then(Value::as_str)
                    .unwrap_or(""),
                "artifactIds": persisted_task
                    .get("artifacts")
                    .and_then(Value::as_array)
                    .map(|entries| {
                        entries
                            .iter()
                            .filter_map(|entry| entry.get("id").and_then(Value::as_str))
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default(),
                "outputIds": persisted_task
                    .get("outputs")
                    .and_then(Value::as_array)
                    .map(|entries| {
                        entries
                            .iter()
                            .filter_map(|entry| entry.get("id").and_then(Value::as_str))
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default(),
            }
        }))
        .map_err(|error| format!("Failed to serialize task failed contract summary: {error}"))?
    );

    remove_task_records(home_root, &task_id).ok();
    Ok(())
}
