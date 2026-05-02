use scribeflow_lib::{
    extension_host_invoke_probe_request, ExtensionHostRequest, ExtensionHostResponse,
    ExtensionHostState,
};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

fn unique_temp_dir() -> Result<PathBuf, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Failed to read current time: {error}"))?
        .as_millis();
    let root = std::env::temp_dir().join(format!("scribeflow-extension-host-ui-interrupt-{now}"));
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

fn build_probe_extension(root: &Path) -> Result<(String, String), String> {
    let extension_root = root
        .join(".scribeflow")
        .join("extensions")
        .join("example-ui-interrupt-extension");
    let manifest_path = extension_root.join("package.json");
    let entry_path = extension_root.join("dist").join("extension.js");
    let manifest = json!({
        "name": "example-ui-interrupt-extension",
        "displayName": "Example UI Interrupt Extension",
        "version": "0.1.0",
        "type": "module",
        "main": "./dist/extension.js",
        "activationEvents": [
            "onCommand:exampleUiInterruptExtension.promptThenCrash"
        ],
        "contributes": {
            "commands": [
                {
                    "command": "exampleUiInterruptExtension.promptThenCrash",
                    "title": "Prompt Then Crash"
                }
            ]
        },
        "permissions": {
            "readWorkspaceFiles": true
        }
    });
    let source = r#"
export async function activate(context) {
  context.commands.registerCommand('exampleUiInterruptExtension.promptThenCrash', async () => {
    setTimeout(() => process.exit(1), 25)
    await context.window.showInputBox({
      title: 'Recovery prompt',
      prompt: 'This prompt should be interrupted',
      placeholder: 'Type here',
      value: 'seed',
    })
    return {
      message: 'unexpected success',
      progressLabel: 'unexpected success',
      taskState: 'succeeded',
    }
  })
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

fn main() -> Result<(), String> {
    let temp_root = unique_temp_dir()?;
    let (workspace_root, manifest_path) = build_probe_extension(&temp_root)?;
    let state = ExtensionHostState::default();
    let extension_path = Path::new(&manifest_path)
        .parent()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();

    let started = Instant::now();
    let state_for_thread = state.clone();
    let workspace_root_for_thread = workspace_root.clone();
    let manifest_path_for_thread = manifest_path.clone();
    let extension_path_for_thread = extension_path.clone();
    let worker = thread::spawn(move || {
        extension_host_invoke_probe_request(
            &state_for_thread,
            ExtensionHostRequest::ExecuteCommand {
                activation_event: "onCommand:exampleUiInterruptExtension.promptThenCrash"
                    .to_string(),
                extension_path: extension_path_for_thread,
                manifest_path: manifest_path_for_thread,
                main_entry: "./dist/extension.js".to_string(),
                command_id: "exampleUiInterruptExtension.promptThenCrash".to_string(),
                envelope: serde_json::from_value(json!({
                    "taskId": "task-ui-interrupt",
                    "extensionId": "example-ui-interrupt-extension",
                    "workspaceRoot": workspace_root_for_thread,
                    "commandId": "exampleUiInterruptExtension.promptThenCrash",
                    "itemId": "",
                    "itemHandle": "",
                    "referenceId": "",
                    "capability": "",
                    "targetKind": "workspace",
                    "targetPath": workspace_root_for_thread,
                    "settingsJson": "{}"
                }))
                .map_err(|error| format!("Failed to build UI interrupt envelope: {error}"))?,
            },
        )
    });

    thread::sleep(Duration::from_millis(200));
    let result = worker
        .join()
        .map_err(|_| "UI interrupt probe thread panicked".to_string())?;
    let elapsed_ms = started.elapsed().as_millis();
    match result {
        Ok(ExtensionHostResponse::ExecuteCommand(_)) => {
            Err("UI interrupt probe unexpectedly completed successfully".to_string())
        }
        Ok(other) => Err(format!(
            "UI interrupt probe returned unexpected response kind: {other:?}"
        )),
        Err(error) => {
            if elapsed_ms > 5_000 {
                return Err(format!(
                    "UI interrupt probe did not fail fast enough: {elapsed_ms}ms"
                ));
            }
            if !error.contains("Extension host stopped while waiting for UI request completion")
                && !error.contains("Extension host closed its response stream")
                && !error.contains("Failed to read extension host response")
            {
                return Err(format!(
                    "UI interrupt probe failed with unexpected error: {error}"
                ));
            }
            println!(
                "{}",
                serde_json::to_string_pretty(&json!({
                    "ok": true,
                    "summary": {
                        "interrupted": true,
                        "elapsedMs": elapsed_ms,
                        "error": error,
                    }
                }))
                .map_err(|serialize_error| {
                    format!("Failed to serialize UI interrupt probe result: {serialize_error}")
                })?
            );
            Ok(())
        }
    }
}
