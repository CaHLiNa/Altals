use scribeflow_lib::{
    extension_host_activate_by_id_for_probe,
    extension_host_invoke_probe_request_with_task_runtime,
    extension_host_spawned_process_count_for_probe, ExtensionHostRequest, ExtensionHostResponse,
    ExtensionHostState, extension_task_create_command_for_probe,
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
    let root = std::env::temp_dir().join(format!("scribeflow-extension-host-task-contract-{now}"));
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
        .join("example-task-contract-extension");
    let manifest_path = extension_root.join("package.json");
    let entry_path = extension_root.join("dist").join("extension.js");
    let manifest = json!({
        "name": "example-task-contract-extension",
        "displayName": "Example Task Contract Extension",
        "version": "0.1.0",
        "type": "module",
        "main": "./dist/extension.js",
        "activationEvents": [
            "onCommand:exampleTaskContractExtension.inspect"
        ],
        "contributes": {
            "commands": [
                {
                    "command": "exampleTaskContractExtension.inspect",
                    "title": "Inspect Task Contract"
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
  context.commands.registerCommand('exampleTaskContractExtension.inspect', async () => {
    const worker = await context.process.spawn('node', {
      args: ['-e', 'setTimeout(() => process.exit(0), 25)'],
      cwd: context.workspace.rootPath,
    })

    const runningTask = await context.tasks.update({
      state: 'running',
      progressLabel: 'Worker spawned',
      progressCurrent: 1,
      progressTotal: 2,
      outputs: [
        {
          id: 'summary:running',
          type: 'inlineText',
          mediaType: 'text/plain',
          title: 'Running Summary',
          text: 'worker active',
        },
      ],
    })

    const waited = await worker.wait()

    const completedTask = await context.tasks.update({
      state: 'succeeded',
      progressLabel: 'Worker finished',
      artifacts: [
        {
          id: 'task-log',
          kind: 'log',
          mediaType: 'text/plain',
          path: `${context.workspace.rootPath}/contract-output.log`,
        },
      ],
      outputs: [
        {
          id: 'summary:final',
          type: 'inlineText',
          mediaType: 'application/json',
          title: 'Final Summary',
          text: JSON.stringify({
            waited,
            afterRunningState: runningTask?.state || '',
            afterRunningOutputs: runningTask?.outputs || [],
          }),
        },
      ],
    })

    return {
      message: 'task contract inspected',
      progressLabel: 'Task contract inspected',
      taskState: 'succeeded',
      outputs: [
        {
          id: 'task-contract-summary',
          type: 'inlineText',
          mediaType: 'application/json',
          title: 'Task Contract Summary',
          text: JSON.stringify({
            waited,
            runningTask,
            completedTask,
            currentTask: context.tasks.current,
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
            .map_err(|error| format!("Failed to serialize task probe manifest: {error}"))?,
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
        .map_err(|error| format!("Failed to create probe workspace dir: {error}"))?;
    fs::create_dir_all(&global_config_dir)
        .map_err(|error| format!("Failed to create probe global config dir: {error}"))?;

    let manifest_path = build_probe_extension(&workspace_root)?;
    let workspace_root_text = workspace_root.to_string_lossy().to_string();
    let global_config_dir_text = global_config_dir.to_string_lossy().to_string();

    let state = ExtensionHostState::default();
    let initial_process_count = extension_host_spawned_process_count_for_probe(&state)?;
    if initial_process_count != 0 {
        return Err(format!(
            "Expected empty spawned-process registry before task probe, found {initial_process_count}"
        ));
    }
    let activate = extension_host_activate_by_id_for_probe(
        &state,
        &global_config_dir_text,
        &workspace_root_text,
        "example-task-contract-extension",
        "onCommand:exampleTaskContractExtension.inspect",
    )?;
    if !activate.activated {
        return Err(format!(
            "Task probe extension did not activate: {}",
            activate.reason
        ));
    }

    let task = extension_task_create_command_for_probe(
        "example-task-contract-extension",
        "exampleTaskContractExtension.inspect",
        "workspace",
        &workspace_root.to_string_lossy(),
    )?;
    let task_id = task.id.clone();
    let request = ExtensionHostRequest::ExecuteCommand {
        activation_event: "onCommand:exampleTaskContractExtension.inspect".to_string(),
        extension_path: manifest_path
            .parent()
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_default(),
        manifest_path: manifest_path.to_string_lossy().to_string(),
        main_entry: "./dist/extension.js".to_string(),
        command_id: "exampleTaskContractExtension.inspect".to_string(),
        envelope: serde_json::from_value(json!({
            "taskId": task_id,
            "extensionId": "example-task-contract-extension",
            "workspaceRoot": workspace_root_text,
            "commandId": "exampleTaskContractExtension.inspect",
            "itemId": "",
            "itemHandle": "",
            "referenceId": "",
            "capability": "",
            "targetKind": "workspace",
            "targetPath": workspace_root.to_string_lossy().to_string(),
            "settingsJson": "{}"
        }))
        .map_err(|error| format!("Failed to build task probe envelope: {error}"))?,
    };

    let response = extension_host_invoke_probe_request_with_task_runtime(&state, request)?;

    let summary_text = require_text(
        output_text(&response, "task-contract-summary"),
        "task-contract-summary",
    )?;
    let summary = serde_json::from_str::<Value>(&summary_text)
        .map_err(|error| format!("Failed to parse task contract summary: {error}"))?;

    let running_task = summary
        .get("runningTask")
        .cloned()
        .ok_or_else(|| "Task contract summary missing runningTask".to_string())?;
    let completed_task = summary
        .get("completedTask")
        .cloned()
        .ok_or_else(|| "Task contract summary missing completedTask".to_string())?;
    let waited = summary
        .get("waited")
        .cloned()
        .ok_or_else(|| "Task contract summary missing waited result".to_string())?;

    if running_task
        .get("state")
        .and_then(Value::as_str)
        .unwrap_or("")
        != "running"
    {
        return Err(format!(
            "Expected running task state to stay running after intermediate update, got {running_task}"
        ));
    }
    if running_task
        .get("outputs")
        .and_then(Value::as_array)
        .map(|entries| entries.len())
        .unwrap_or(0)
        != 1
    {
        return Err(format!(
            "Expected intermediate task update to persist exactly one output, got {running_task}"
        ));
    }
    if waited.get("ok").and_then(Value::as_bool) != Some(true) {
        return Err(format!(
            "Expected worker.wait() to succeed after running update, got {waited}"
        ));
    }
    if completed_task
        .get("state")
        .and_then(Value::as_str)
        .unwrap_or("")
        != "succeeded"
    {
        return Err(format!(
            "Expected completed task state succeeded, got {completed_task}"
        ));
    }
    if completed_task
        .get("artifacts")
        .and_then(Value::as_array)
        .map(|entries| entries.len())
        .unwrap_or(0)
        != 1
    {
        return Err(format!(
            "Expected completed task to replace artifacts with one log entry, got {completed_task}"
        ));
    }
    let completed_outputs = completed_task
        .get("outputs")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("Completed task outputs missing: {completed_task}"))?;
    if completed_outputs.len() != 1 {
        return Err(format!(
            "Expected completed task outputs to be replaced by one final summary, got {completed_task}"
        ));
    }
    if completed_outputs[0]
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("")
        != "summary:final"
    {
        return Err(format!(
            "Expected final output id summary:final, got {completed_task}"
        ));
    }
    let persisted_task = task_entry(home_root, &task_id)?
        .ok_or_else(|| format!("Expected persisted task record for probe task {task_id}"))?;
    if persisted_task
        .get("state")
        .and_then(Value::as_str)
        .unwrap_or("")
        != "succeeded"
    {
        return Err(format!(
            "Expected persisted task record to stay succeeded after terminal update, got {persisted_task}"
        ));
    }
    let final_process_count = extension_host_spawned_process_count_for_probe(&state)?;
    if final_process_count != 0 {
        return Err(format!(
            "Expected terminal task update to reap spawned process ownership, found {final_process_count} remaining entries"
        ));
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "ok": true,
            "taskId": task_id,
            "waited": waited,
            "spawnedProcessCountAfter": final_process_count,
            "runningTaskState": running_task.get("state").cloned().unwrap_or(Value::Null),
            "completedTaskState": completed_task.get("state").cloned().unwrap_or(Value::Null),
            "persistedTaskState": persisted_task.get("state").cloned().unwrap_or(Value::Null),
            "completedArtifacts": completed_task.get("artifacts").cloned().unwrap_or(Value::Null),
            "completedOutputs": completed_task.get("outputs").cloned().unwrap_or(Value::Null),
        }))
        .map_err(|error| format!("Failed to serialize task contract probe summary: {error}"))?
    );

    remove_task_records(home_root, &task_id).ok();
    Ok(())
}
