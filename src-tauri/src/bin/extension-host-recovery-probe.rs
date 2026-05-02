use scribeflow_lib::{
    extension_host_invoke_probe_request, ExtensionHostRequest, ExtensionHostResponse,
    ExtensionHostState,
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
    let root = std::env::temp_dir().join(format!("scribeflow-extension-host-recovery-{now}"));
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

fn build_probe_extension(root: &Path) -> Result<(String, String), String> {
    let extension_root = root.join(".scribeflow").join("extensions").join("example-recovery-extension");
    let manifest_path = extension_root.join("package.json");
    let entry_path = extension_root.join("dist").join("extension.js");
    let manifest = json!({
        "name": "example-recovery-extension",
        "displayName": "Example Recovery Extension",
        "version": "0.1.0",
        "type": "module",
        "main": "./dist/extension.js",
        "activationEvents": [
            "onCommand:exampleRecoveryExtension.crash",
            "onCommand:exampleRecoveryExtension.ping"
        ],
        "contributes": {
            "commands": [
                {
                    "command": "exampleRecoveryExtension.crash",
                    "title": "Crash Host"
                },
                {
                    "command": "exampleRecoveryExtension.ping",
                    "title": "Ping Host"
                }
            ]
        },
        "permissions": {
            "readWorkspaceFiles": true
        }
    });
    let source = r#"
export async function activate(context) {
  context.commands.registerCommand('exampleRecoveryExtension.crash', async () => {
    process.exit(1)
  })

  context.commands.registerCommand('exampleRecoveryExtension.ping', async () => ({
    message: 'extension host recovered',
    progressLabel: 'Extension host recovered',
    taskState: 'succeeded',
    outputs: [
      {
        id: 'recovery-ping',
        type: 'inlineText',
        mediaType: 'text/plain',
        title: 'Recovery Ping',
        text: 'pong',
      },
    ],
  }))
}
"#;

    write_file(
        &manifest_path,
        &serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("Failed to serialize probe manifest: {error}"))?,
    )?;
    write_file(&entry_path, source)?;
    Ok((
        root.to_string_lossy().to_string(),
        manifest_path.to_string_lossy().to_string(),
    ))
}

fn base_envelope(workspace_root: &str, command_id: &str) -> Value {
    json!({
        "taskId": format!("task-{command_id}"),
        "extensionId": "example-recovery-extension",
        "workspaceRoot": workspace_root,
        "commandId": command_id,
        "itemId": "",
        "itemHandle": "",
        "referenceId": "",
        "capability": "",
        "targetKind": "workspace",
        "targetPath": workspace_root,
        "settingsJson": "{}"
    })
}

fn execute_command(
    state: &ExtensionHostState,
    workspace_root: &str,
    manifest_path: &str,
    command_id: &str,
) -> Result<ExtensionHostResponse, String> {
    extension_host_invoke_probe_request(
        state,
        ExtensionHostRequest::ExecuteCommand {
            activation_event: format!("onCommand:{command_id}"),
            extension_path: Path::new(manifest_path)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default(),
            manifest_path: manifest_path.to_string(),
            main_entry: "./dist/extension.js".to_string(),
            command_id: command_id.to_string(),
            envelope: serde_json::from_value(base_envelope(workspace_root, command_id))
                .map_err(|error| format!("Failed to build execution envelope: {error}"))?,
        },
    )
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

fn main() -> Result<(), String> {
    let temp_root = unique_temp_dir()?;
    let (workspace_root, manifest_path) = build_probe_extension(&temp_root)?;
    let state = ExtensionHostState::default();

    let activate = extension_host_invoke_probe_request(
        &state,
        ExtensionHostRequest::Activate {
            extension_id: "example-recovery-extension".to_string(),
            workspace_root: workspace_root.clone(),
            activation_event: "onCommand:exampleRecoveryExtension.crash".to_string(),
            extension_path: Path::new(&manifest_path)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default(),
            manifest_path: manifest_path.clone(),
            main_entry: "./dist/extension.js".to_string(),
            permissions: serde_json::from_value(json!({
                "readWorkspaceFiles": true
            }))
            .map_err(|error| format!("Failed to build permissions payload: {error}"))?,
            capabilities: Vec::new(),
            activation_state: serde_json::from_value(json!({
                "settings": {},
                "globalState": {},
                "workspaceState": {}
            }))
            .map_err(|error| format!("Failed to build activation state payload: {error}"))?,
        },
    )?;
    match activate {
        ExtensionHostResponse::Activate(result) if result.activated => {}
        ExtensionHostResponse::Activate(result) => {
            return Err(format!(
                "Recovery probe extension did not activate: {}",
                result.reason
            ));
        }
        _ => return Err("Unexpected response kind for probe activation".to_string()),
    }

    let crash = execute_command(
        &state,
        &workspace_root,
        &manifest_path,
        "exampleRecoveryExtension.crash",
    );
    if crash.is_ok() {
        return Err("Crash command unexpectedly succeeded".to_string());
    }

    let recovered = execute_command(
        &state,
        &workspace_root,
        &manifest_path,
        "exampleRecoveryExtension.ping",
    )?;
    let pong = output_text(&recovered, "recovery-ping").unwrap_or_default();
    match recovered {
        ExtensionHostResponse::ExecuteCommand(result) => {
            if !result.accepted {
                return Err("Recovery ping was not accepted after host restart".to_string());
            }
            if pong != "pong" {
                return Err(format!(
                    "Recovery ping output drifted after host restart: expected pong, got {pong}"
                ));
            }
        }
        _ => {
            return Err("Unexpected response kind for recovery ping".to_string());
        }
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "ok": true,
            "summary": {
                "crashRecovered": true,
                "recoveryOutput": pong,
            }
        }))
        .map_err(|error| format!("Failed to serialize recovery probe result: {error}"))?
    );
    Ok(())
}
