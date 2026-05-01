use scribeflow_lib::{
    extension_host_activate_by_id_for_probe, extension_host_invoke_probe_request,
    ExtensionHostRequest, ExtensionHostResponse, ExtensionHostState,
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
    let root = std::env::temp_dir().join(format!("scribeflow-extension-host-process-{now}"));
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
        .join("example-process-contract-extension");
    let manifest_path = extension_root.join("package.json");
    let entry_path = extension_root.join("dist").join("extension.js");
    let manifest = json!({
        "name": "example-process-contract-extension",
        "displayName": "Example Process Contract Extension",
        "version": "0.1.0",
        "type": "module",
        "main": "./dist/extension.js",
        "activationEvents": [
            "onCommand:exampleProcessContractExtension.inspect"
        ],
        "contributes": {
            "commands": [
                {
                    "command": "exampleProcessContractExtension.inspect",
                    "title": "Inspect Process Contract"
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
  context.commands.registerCommand('exampleProcessContractExtension.inspect', async () => {
    const defaultExec = await context.process.exec('node', {
      args: ['-e', "process.stdout.write(JSON.stringify({ cwd: process.cwd(), env: process.env.PROBE_TOKEN || '' }))"],
      env: { PROBE_TOKEN: 'alpha-token' },
    })

    const nestedSpawn = await context.process.spawn('node', {
      args: ['-e', 'setTimeout(() => process.exit(0), 25)'],
      cwd: `${context.workspace?.rootPath || ''}/nested`,
      env: { PROBE_TOKEN: 'spawn-token' },
    })
    const nestedSpawnWait = await nestedSpawn.wait()

    const failingExec = await context.process.exec('node', {
      args: ['-e', "process.stderr.write('boom'); process.exit(7)"],
    })

    let outsideWorkspaceError = ''
    try {
      await context.process.exec('node', {
        args: ['-e', "process.stdout.write('blocked')"],
        cwd: '/tmp',
      })
    } catch (error) {
      outsideWorkspaceError = error?.message || String(error)
    }

    return {
      message: 'process contract inspected',
      progressLabel: 'Process contract inspected',
      taskState: 'succeeded',
      outputs: [
        {
          id: 'process-contract-summary',
          type: 'inlineText',
          mediaType: 'application/json',
          title: 'Process Contract Summary',
          text: JSON.stringify({
            defaultExec,
            nestedSpawn: {
              ok: nestedSpawn?.ok ?? null,
              pid: nestedSpawn?.pid ?? null,
            },
            nestedSpawnWait,
            failingExec,
            outsideWorkspaceError,
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
            .map_err(|error| format!("Failed to serialize process probe manifest: {error}"))?,
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

fn execute_process_command(
    state: &ExtensionHostState,
    workspace_root: &str,
    manifest_path: &str,
) -> Result<ExtensionHostResponse, String> {
    extension_host_invoke_probe_request(
        state,
        ExtensionHostRequest::ExecuteCommand {
            activation_event: "onCommand:exampleProcessContractExtension.inspect".to_string(),
            extension_path: Path::new(manifest_path)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default(),
            manifest_path: manifest_path.to_string(),
            main_entry: "./dist/extension.js".to_string(),
            command_id: "exampleProcessContractExtension.inspect".to_string(),
            envelope: serde_json::from_value(json!({
                "taskId": "task-process",
                "extensionId": "example-process-contract-extension",
                "workspaceRoot": workspace_root,
                "commandId": "exampleProcessContractExtension.inspect",
                "itemId": "",
                "itemHandle": "",
                "referenceId": "",
                "capability": "",
                "targetKind": "workspace",
                "targetPath": workspace_root,
                "settingsJson": "{}"
            }))
            .map_err(|error| format!("Failed to build process probe envelope: {error}"))?,
        },
    )
}

fn require_text(value: Option<String>, label: &str) -> Result<String, String> {
    value.ok_or_else(|| format!("Missing output text for {label}"))
}

fn main() -> Result<(), String> {
    let probe_root = unique_temp_dir()?;
    let workspace_root = probe_root.join("workspace");
    let nested_dir = workspace_root.join("nested");
    let global_config_dir = probe_root.join("global-config");
    fs::create_dir_all(&nested_dir)
        .map_err(|error| format!("Failed to create nested probe workspace dir: {error}"))?;
    fs::create_dir_all(&global_config_dir)
        .map_err(|error| format!("Failed to create probe global config dir: {error}"))?;

    let manifest_path = build_probe_extension(&workspace_root)?;
    let workspace_root_text = workspace_root.to_string_lossy().to_string();
    let canonical_workspace_root = workspace_root
        .canonicalize()
        .map_err(|error| format!("Failed to canonicalize probe workspace root: {error}"))?;
    let canonical_nested_root = nested_dir
        .canonicalize()
        .map_err(|error| format!("Failed to canonicalize nested probe workspace dir: {error}"))?;
    let canonical_workspace_root_text = canonical_workspace_root.to_string_lossy().to_string();
    let canonical_nested_root_text = canonical_nested_root.to_string_lossy().to_string();
    let global_config_dir_text = global_config_dir.to_string_lossy().to_string();

    let state = ExtensionHostState::default();
    let activate = extension_host_activate_by_id_for_probe(
        &state,
        &global_config_dir_text,
        &workspace_root_text,
        "example-process-contract-extension",
        "onCommand:exampleProcessContractExtension.inspect",
    )?;
    if !activate.activated {
        return Err(format!(
            "Process probe extension did not activate: {}",
            activate.reason
        ));
    }

    let response =
        execute_process_command(&state, &workspace_root_text, &manifest_path.to_string_lossy())?;
    let summary_text = require_text(
        output_text(&response, "process-contract-summary"),
        "process-contract-summary",
    )?;
    let summary = serde_json::from_str::<Value>(&summary_text)
        .map_err(|error| format!("Failed to parse process contract summary: {error}"))?;

    let default_exec = summary
        .get("defaultExec")
        .cloned()
        .ok_or_else(|| "Process probe missing defaultExec result".to_string())?;
    let nested_spawn = summary
        .get("nestedSpawn")
        .cloned()
        .ok_or_else(|| "Process probe missing nestedSpawn result".to_string())?;
    let nested_wait = summary
        .get("nestedSpawnWait")
        .cloned()
        .ok_or_else(|| "Process probe missing nestedSpawnWait result".to_string())?;
    let failing_exec = summary
        .get("failingExec")
        .cloned()
        .ok_or_else(|| "Process probe missing failingExec result".to_string())?;
    let outside_workspace_error = summary
        .get("outsideWorkspaceError")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    let default_exec_stdout = default_exec
        .get("stdout")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let default_exec_stdout_json = serde_json::from_str::<Value>(&default_exec_stdout)
        .map_err(|error| format!("Failed to parse default exec stdout JSON: {error}"))?;

    let spawn_pid = nested_spawn
        .get("pid")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Process spawn pid was missing".to_string())?;
    let waited_pid = nested_wait
        .get("pid")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Process wait pid was missing".to_string())?;

    if !default_exec
        .get("ok")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return Err(format!(
            "Process exec unexpectedly failed: {}",
            default_exec
        ));
    }
    if default_exec_stdout_json
        .get("cwd")
        .and_then(Value::as_str)
        .unwrap_or("")
        != canonical_workspace_root_text
    {
        return Err(format!(
            "Process exec default cwd drifted: expected {}, got {}",
            canonical_workspace_root_text,
            default_exec_stdout_json
                .get("cwd")
                .and_then(Value::as_str)
                .unwrap_or("")
        ));
    }
    if default_exec_stdout_json
        .get("env")
        .and_then(Value::as_str)
        .unwrap_or("")
        != "alpha-token"
    {
        return Err(format!(
            "Process exec env propagation drifted: expected alpha-token, got {}",
            default_exec_stdout_json
                .get("env")
                .and_then(Value::as_str)
                .unwrap_or("")
        ));
    }

    if !nested_spawn
        .get("ok")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return Err(format!("Process spawn unexpectedly failed: {nested_spawn}"));
    }
    if !nested_wait
        .get("ok")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return Err(format!("Process wait unexpectedly failed: {nested_wait}"));
    }
    if nested_wait.get("code").and_then(Value::as_i64) != Some(0) {
        return Err(format!(
            "Process wait exit code drifted: expected 0, got {}",
            nested_wait
                .get("code")
                .map(Value::to_string)
                .unwrap_or_else(|| "null".to_string())
        ));
    }
    if spawn_pid != waited_pid {
        return Err(format!(
            "Process wait pid drifted: spawn pid {spawn_pid}, waited pid {waited_pid}"
        ));
    }

    if failing_exec.get("ok").and_then(Value::as_bool) != Some(false) {
        return Err(format!(
            "Failing process exec unexpectedly succeeded: {failing_exec}"
        ));
    }
    if failing_exec.get("code").and_then(Value::as_i64) != Some(7) {
        return Err(format!(
            "Failing process exec exit code drifted: expected 7, got {}",
            failing_exec
                .get("code")
                .map(Value::to_string)
                .unwrap_or_else(|| "null".to_string())
        ));
    }
    if failing_exec
        .get("stderr")
        .and_then(Value::as_str)
        .unwrap_or("")
        != "boom"
    {
        return Err(format!(
            "Failing process exec stderr drifted: expected boom, got {}",
            failing_exec
                .get("stderr")
                .and_then(Value::as_str)
                .unwrap_or("")
        ));
    }
    if !outside_workspace_error.contains("Process cwd is outside the active workspace") {
        return Err(format!(
            "Outside-workspace process cwd error drifted: {outside_workspace_error}"
        ));
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "ok": true,
            "summary": {
                "defaultExec": {
                    "ok": default_exec.get("ok").and_then(Value::as_bool).unwrap_or(false),
                    "cwd": default_exec_stdout_json.get("cwd").and_then(Value::as_str).unwrap_or(""),
                    "env": default_exec_stdout_json.get("env").and_then(Value::as_str).unwrap_or(""),
                },
                "nestedSpawn": {
                    "ok": nested_spawn.get("ok").and_then(Value::as_bool).unwrap_or(false),
                    "pid": spawn_pid,
                    "cwd": canonical_nested_root_text,
                },
                "nestedSpawnWait": {
                    "ok": nested_wait.get("ok").and_then(Value::as_bool).unwrap_or(false),
                    "pid": waited_pid,
                    "code": nested_wait.get("code").and_then(Value::as_i64).unwrap_or(-1),
                },
                "failingExec": {
                    "ok": failing_exec.get("ok").and_then(Value::as_bool).unwrap_or(true),
                    "code": failing_exec.get("code").and_then(Value::as_i64).unwrap_or(-1),
                    "stderr": failing_exec.get("stderr").and_then(Value::as_str).unwrap_or(""),
                },
                "outsideWorkspaceError": outside_workspace_error,
            }
        }))
        .map_err(|error| format!("Failed to serialize process probe summary: {error}"))?
    );

    Ok(())
}
