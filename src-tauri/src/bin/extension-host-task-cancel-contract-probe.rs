use scribeflow_lib::{
    extension_host_activate_by_id_for_probe, extension_host_invoke_request,
    extension_host_spawned_process_count_for_probe, extension_task_cancel_for_probe,
    extension_task_create_command_for_probe, ExtensionHostRequest, ExtensionHostResponse,
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
    let root = std::env::temp_dir().join(format!(
        "scribeflow-extension-host-task-cancel-contract-{now}"
    ));
    fs::create_dir_all(&root).map_err(|error| {
        format!(
            "Failed to create probe temp root {}: {error}",
            root.display()
        )
    })?;
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
        .join("example-task-cancel-contract-extension");
    let manifest_path = extension_root.join("package.json");
    let entry_path = extension_root.join("dist").join("extension.js");
    let manifest = json!({
        "name": "example-task-cancel-contract-extension",
        "displayName": "Example Task Cancel Contract Extension",
        "version": "0.1.0",
        "type": "module",
        "main": "./dist/extension.js",
        "activationEvents": [
            "onCommand:exampleTaskCancelContractExtension.inspect"
        ],
        "contributes": {
            "commands": [
                {
                    "command": "exampleTaskCancelContractExtension.inspect",
                    "title": "Inspect Task Cancel Contract"
                }
            ]
        },
        "permissions": {
            "readWorkspaceFiles": true,
            "spawnProcess": true
        }
    });
    let source = r#"
export async function activate(context) {
  context.commands.registerCommand('exampleTaskCancelContractExtension.inspect', async () => {
    const worker = await context.process.spawn('node', {
      args: ['-e', 'setTimeout(() => process.exit(0), 3000)'],
      cwd: context.workspace.rootPath,
    })

    const runningTask = await context.tasks.update({
      state: 'running',
      progressLabel: 'Worker running for cancel contract',
      outputs: [
        {
          id: 'cancel-running-output',
          type: 'inlineText',
          mediaType: 'text/plain',
          title: 'Cancel Running Output',
          text: 'still-running',
        },
      ],
    })

    return {
      message: 'task cancel contract running',
      progressLabel: 'Task cancel contract running',
      taskState: 'running',
      outputs: [
        {
          id: 'task-cancel-contract-summary',
          type: 'inlineText',
          mediaType: 'application/json',
          title: 'Task Cancel Contract Summary',
          text: JSON.stringify({
            workerPid: worker?.pid ?? null,
            runningTaskState: runningTask?.state || '',
            runningTaskOutputText: Array.isArray(runningTask?.outputs)
              ? String(runningTask.outputs.find((entry) => entry.id === 'cancel-running-output')?.text || '')
              : '',
          }),
        },
      ],
    }
  })
}
"#;

    write_file(
        &manifest_path,
        &serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("Failed to serialize task cancel probe manifest: {error}"))?,
    )?;
    write_file(&entry_path, source)?;
    Ok(manifest_path)
}

fn output_text(response: &ExtensionHostResponse, output_id: &str) -> Option<String> {
    match response {
        ExtensionHostResponse::ExecuteCommand(result) => result
            .outputs
            .iter()
            .find(|entry| entry.id == output_id)
            .map(|entry| entry.text.clone()),
        _ => None,
    }
}

fn require_text(value: Option<String>, label: &str) -> Result<String, String> {
    value.ok_or_else(|| format!("Missing output text for {label}"))
}

fn tasks_file_path(home_root: &Path) -> PathBuf {
    home_root
        .join(".scribeflow")
        .join("extension-tasks")
        .join("tasks.json")
}

fn task_entry(home_root: &Path, task_id: &str) -> Result<Option<Value>, String> {
    let path = tasks_file_path(home_root);
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path).map_err(|error| {
        format!(
            "Failed to read extension tasks file {}: {error}",
            path.display()
        )
    })?;
    let parsed = serde_json::from_str::<Value>(&content).map_err(|error| {
        format!(
            "Failed to parse extension tasks file {}: {error}",
            path.display()
        )
    })?;
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
    let content = fs::read_to_string(&path).map_err(|error| {
        format!(
            "Failed to read extension tasks file {}: {error}",
            path.display()
        )
    })?;
    let mut parsed = serde_json::from_str::<Value>(&content).map_err(|error| {
        format!(
            "Failed to parse extension tasks file {}: {error}",
            path.display()
        )
    })?;
    let Some(tasks) = parsed.get_mut("tasks").and_then(Value::as_array_mut) else {
        return Ok(());
    };
    tasks.retain(|entry| {
        entry
            .get("id")
            .and_then(Value::as_str)
            .map(|id| id != task_id)
            .unwrap_or(true)
    });
    fs::write(
        &path,
        serde_json::to_string_pretty(&parsed).map_err(|error| {
            format!(
                "Failed to serialize cleaned tasks file {}: {error}",
                path.display()
            )
        })?,
    )
    .map_err(|error| {
        format!(
            "Failed to write cleaned tasks file {}: {error}",
            path.display()
        )
    })
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
        .map_err(|error| format!("Failed to create cancel probe workspace dir: {error}"))?;
    fs::create_dir_all(&global_config_dir)
        .map_err(|error| format!("Failed to create cancel probe global config dir: {error}"))?;

    let manifest_path = build_probe_extension(&workspace_root)?;
    let workspace_root_text = workspace_root.to_string_lossy().to_string();
    let global_config_dir_text = global_config_dir.to_string_lossy().to_string();

    let state = ExtensionHostState::default();
    let runtime_state = ExtensionTaskRuntimeState::default();

    let activate = extension_host_activate_by_id_for_probe(
        &state,
        &global_config_dir_text,
        &workspace_root_text,
        "example-task-cancel-contract-extension",
        "onCommand:exampleTaskCancelContractExtension.inspect",
    )?;
    if !activate.activated {
        return Err(format!(
            "Task cancel contract extension did not activate: {}",
            activate.reason
        ));
    }

    let task = extension_task_create_command_for_probe(
        "example-task-cancel-contract-extension",
        "exampleTaskCancelContractExtension.inspect",
        "workspace",
        &workspace_root.to_string_lossy(),
    )?;
    let task_id = task.id.clone();

    let response = extension_host_invoke_request(
        &state,
        Some(&runtime_state),
        ExtensionHostRequest::ExecuteCommand {
            activation_event: "onCommand:exampleTaskCancelContractExtension.inspect".to_string(),
            extension_path: Path::new(&manifest_path)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default(),
            manifest_path: manifest_path.to_string_lossy().to_string(),
            main_entry: "./dist/extension.js".to_string(),
            command_id: "exampleTaskCancelContractExtension.inspect".to_string(),
            envelope: serde_json::from_value(json!({
                "taskId": task_id,
                "extensionId": "example-task-cancel-contract-extension",
                "workspaceRoot": workspace_root_text,
                "commandId": "exampleTaskCancelContractExtension.inspect",
                "itemId": "",
                "itemHandle": "",
                "referenceId": "",
                "capability": "",
                "targetKind": "workspace",
                "targetPath": workspace_root.to_string_lossy().to_string(),
                "settingsJson": "{}"
            }))
            .map_err(|error| format!("Failed to build task cancel probe envelope: {error}"))?,
        },
    )?;

    let summary_text = require_text(
        output_text(&response, "task-cancel-contract-summary"),
        "task-cancel-contract-summary",
    )?;
    let summary = serde_json::from_str::<Value>(&summary_text)
        .map_err(|error| format!("Failed to parse task cancel contract summary: {error}"))?;
    match &response {
        ExtensionHostResponse::ExecuteCommand(result) => {
            let output = result
                .outputs
                .iter()
                .find(|entry| entry.id == "task-cancel-contract-summary");
            if output.is_none() {
                return Err("Task cancel contract response lost summary output".to_string());
            }
        }
        other => {
            return Err(format!(
                "Task cancel contract returned unexpected response kind: {other:?}"
            ))
        }
    };

    let process_count_before_cancel = extension_host_spawned_process_count_for_probe(&state)?;
    if process_count_before_cancel == 0 {
        return Err("Task cancel contract did not register a spawned process".to_string());
    }

    let registered_pid = summary
        .get("workerPid")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Task cancel contract missing workerPid".to_string())?;

    let cancelled = extension_task_cancel_for_probe(&task_id, &runtime_state, &state)?;
    let persisted = task_entry(home_root, &task_id)?
        .ok_or_else(|| "Task cancel contract persisted task entry is missing".to_string())?;
    let process_count_after_cancel = extension_host_spawned_process_count_for_probe(&state)?;

    if cancelled.state != "cancelled" {
        return Err(format!(
            "Cancelled task state drifted: expected cancelled, got {}",
            cancelled.state
        ));
    }
    if cancelled.progress.label != "Cancelled" {
        return Err(format!(
            "Cancelled task progress label drifted: expected Cancelled, got {}",
            cancelled.progress.label
        ));
    }
    if process_count_after_cancel != 0 {
        return Err(format!(
            "Cancel contract did not clear spawned process ownership: {process_count_after_cancel}"
        ));
    }
    if persisted.get("state").and_then(Value::as_str).unwrap_or("") != "cancelled" {
        return Err(format!(
            "Persisted cancelled task state drifted: {}",
            persisted.get("state").unwrap_or(&Value::Null)
        ));
    }
    if persisted
        .get("outputs")
        .and_then(Value::as_array)
        .and_then(|outputs| outputs.first())
        .and_then(|entry| entry.get("text"))
        .and_then(Value::as_str)
        .unwrap_or("")
        != "still-running"
    {
        return Err(format!(
            "Persisted cancelled task lost running outputs: {}",
            persisted.get("outputs").cloned().unwrap_or(Value::Null)
        ));
    }
    if summary
        .get("runningTaskState")
        .and_then(Value::as_str)
        .unwrap_or("")
        != "running"
    {
        return Err(format!(
            "Task cancel contract running summary drifted: {}",
            summary
        ));
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "ok": true,
            "summary": {
                "taskId": task_id,
                "workerPid": registered_pid,
                "runningTaskState": summary.get("runningTaskState").and_then(Value::as_str).unwrap_or(""),
                "cancelledTaskState": cancelled.state,
                "cancelledProgressLabel": cancelled.progress.label,
                "persistedTaskState": persisted.get("state").and_then(Value::as_str).unwrap_or(""),
                "processCountBeforeCancel": process_count_before_cancel,
                "processCountAfterCancel": process_count_after_cancel,
            }
        }))
        .map_err(|error| format!("Failed to serialize task cancel contract summary: {error}"))?
    );

    remove_task_records(home_root, &task_id).ok();
    Ok(())
}
