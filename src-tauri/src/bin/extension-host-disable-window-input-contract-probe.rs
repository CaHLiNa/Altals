use scribeflow_lib::{
    extension_host_activate_by_id_for_probe, extension_host_build_invocation_envelope_for_probe,
    extension_host_cancel_window_inputs_for_probe, extension_host_deactivate_for_probe,
    extension_host_invoke_probe_request, ExtensionHostRequest, ExtensionHostResponse,
    ExtensionHostState,
};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

fn unique_temp_dir() -> Result<PathBuf, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Failed to read current time: {error}"))?
        .as_millis();
    let root =
        std::env::temp_dir().join(format!("scribeflow-extension-disable-window-input-{now}"));
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
        .join("example-disable-window-input-contract-extension");
    let manifest_path = extension_root.join("package.json");
    let entry_path = extension_root.join("dist").join("extension.js");
    let manifest = json!({
        "name": "example-disable-window-input-contract-extension",
        "displayName": "Example Disable Window Input Contract Extension",
        "version": "0.1.0",
        "type": "module",
        "main": "./dist/extension.js",
        "activationEvents": [
            "onCommand:exampleDisableWindowInputContractExtension.prompt"
        ],
        "contributes": {
            "commands": [
                {
                    "command": "exampleDisableWindowInputContractExtension.prompt",
                    "title": "Disable Window Input Contract"
                }
            ]
        },
        "permissions": {
            "readWorkspaceFiles": true
        }
    });
    let source = r#"
export async function activate(context) {
  context.commands.registerCommand('exampleDisableWindowInputContractExtension.prompt', async () => {
    const result = await context.window.showInputBox({
      title: 'Disable prompt',
      prompt: 'This prompt should close on disable',
      placeholder: 'Type here',
      value: 'seed-value',
    })

    return {
      message: typeof result === 'undefined' ? 'prompt cancelled by disable' : 'prompt completed',
      progressLabel: 'Disable prompt handled',
      taskState: 'succeeded',
      outputs: [
        {
          id: 'disable-window-input-summary',
          type: 'inlineText',
          mediaType: 'application/json',
          title: 'Disable Window Input Summary',
          text: JSON.stringify({
            cancelled: typeof result === 'undefined',
            resultType: typeof result,
          }),
        },
      ],
    }
  })
}
"#;

    write_file(
        &manifest_path,
        &serde_json::to_string_pretty(&manifest).map_err(|error| {
            format!("Failed to serialize disable window-input probe manifest: {error}")
        })?,
    )?;
    write_file(&entry_path, source)?;
    Ok(manifest_path)
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
    let result = run_probe(&probe_root);
    reset_home_dir(original_home);
    result
}

fn run_probe(probe_root: &Path) -> Result<(), String> {
    let workspace_root = probe_root.join("workspace");
    let global_config_dir = probe_root.join("global-config");
    fs::create_dir_all(&workspace_root)
        .map_err(|error| format!("Failed to create disable window-input probe workspace dir: {error}"))?;
    fs::create_dir_all(&global_config_dir)
        .map_err(|error| format!("Failed to create disable window-input probe global config dir: {error}"))?;

    let manifest_path = build_probe_extension(&workspace_root)?;
    let workspace_root_text = workspace_root.to_string_lossy().to_string();
    let global_config_dir_text = global_config_dir.to_string_lossy().to_string();

    let state = ExtensionHostState::default();
    let activate = extension_host_activate_by_id_for_probe(
        &state,
        &global_config_dir_text,
        &workspace_root_text,
        "example-disable-window-input-contract-extension",
        "onCommand:exampleDisableWindowInputContractExtension.prompt",
    )?;
    if !activate.activated {
        return Err(format!(
            "Disable window-input contract extension did not activate: {}",
            activate.reason
        ));
    }

    let manifest_path_text = manifest_path.to_string_lossy().to_string();
    let extension_path_text = manifest_path
        .parent()
        .ok_or_else(|| "Disable window-input probe manifest has no parent".to_string())?
        .to_string_lossy()
        .to_string();

    let worker_state = state.clone();
    let invoke_thread = std::thread::spawn(move || {
        extension_host_invoke_probe_request(
            &worker_state,
            ExtensionHostRequest::ExecuteCommand {
                activation_event: "onCommand:exampleDisableWindowInputContractExtension.prompt"
                    .to_string(),
                extension_path: extension_path_text,
                manifest_path: manifest_path_text,
                main_entry: "./dist/extension.js".to_string(),
                command_id: "exampleDisableWindowInputContractExtension.prompt".to_string(),
                envelope: extension_host_build_invocation_envelope_for_probe(
                    "disable-window-input-task",
                    "example-disable-window-input-contract-extension",
                    &workspace_root_text,
                    "exampleDisableWindowInputContractExtension.prompt",
                    "",
                    "",
                    "",
                    "",
                    "workspace",
                    "/tmp/file.txt",
                    &serde_json::Value::Object(Default::default()),
                ),
            },
        )
    });

    std::thread::sleep(std::time::Duration::from_millis(200));

    let cancelled = extension_host_cancel_window_inputs_for_probe(
        &state,
        "example-disable-window-input-contract-extension",
    )
    .map_err(|error| format!("Failed to cancel pending window inputs: {error}"))?;
    if !cancelled.accepted {
        return Err("Disable window-input cancellation was not accepted".to_string());
    }
    if cancelled.cancelled_request_ids.len() != 1 {
        return Err(format!(
            "Expected exactly one cancelled pending window input request, got {:?}",
            cancelled.cancelled_request_ids
        ));
    }
    let deactivated = extension_host_deactivate_for_probe(
        &state,
        "example-disable-window-input-contract-extension",
    )?;
    if !deactivated.accepted {
        return Err("Disable window-input deactivation was not accepted".to_string());
    }

    let response = invoke_thread
        .join()
        .map_err(|_| "Disable window-input probe thread panicked".to_string())??;
    let summary = match response {
        ExtensionHostResponse::ExecuteCommand(result) => result
            .outputs
            .iter()
            .find(|entry| entry.id == "disable-window-input-summary")
            .map(|entry| entry.text.clone())
            .ok_or_else(|| "Disable window-input summary output missing".to_string())?,
        other => {
            return Err(format!(
                "Disable window-input probe returned unexpected response kind: {other:?}"
            ))
        }
    };

    let parsed = serde_json::from_str::<serde_json::Value>(&summary)
        .map_err(|error| format!("Failed to parse disable window-input summary: {error}"))?;
    if parsed.get("cancelled").and_then(serde_json::Value::as_bool) != Some(true) {
        return Err(format!(
            "Disable window-input probe did not observe cancelled prompt semantics: {parsed}"
        ));
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "ok": true,
            "summary": {
                "cancelledRequestIds": cancelled.cancelled_request_ids,
                "cancelled": parsed.get("cancelled").and_then(serde_json::Value::as_bool).unwrap_or(false),
                "resultType": parsed.get("resultType").and_then(serde_json::Value::as_str).unwrap_or("")
            }
        }))
        .map_err(|error| format!("Failed to serialize disable window-input probe result: {error}"))?
    );

    Ok(())
}
