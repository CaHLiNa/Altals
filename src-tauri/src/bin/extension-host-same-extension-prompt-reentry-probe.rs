use scribeflow_lib::{
    extension_host_activate_by_id_for_probe, extension_host_build_invocation_envelope_for_probe,
    extension_host_cancel_window_inputs_for_probe, extension_host_invoke_probe_request,
    ExtensionHostRequest, ExtensionHostResponse, ExtensionHostState,
};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

fn unique_temp_dir() -> Result<PathBuf, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Failed to read current time: {error}"))?
        .as_millis();
    let root = std::env::temp_dir().join(format!("scribeflow-extension-same-prompt-reentry-{now}"));
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

fn build_probe_extension(workspace_root: &Path) -> Result<(String, String), String> {
    let extension_root = workspace_root
        .join(".scribeflow")
        .join("extensions")
        .join("example-same-prompt-reentry-extension");
    let manifest_path = extension_root.join("package.json");
    let entry_path = extension_root.join("dist").join("extension.js");
    let manifest = json!({
        "name": "example-same-prompt-reentry-extension",
        "displayName": "Example Same Prompt Reentry Extension",
        "version": "0.1.0",
        "type": "module",
        "main": "./dist/extension.js",
        "activationEvents": [
            "onCommand:exampleSamePromptReentryExtension.prompt",
            "onCommand:exampleSamePromptReentryExtension.other"
        ],
        "contributes": {
            "commands": [
                {
                    "command": "exampleSamePromptReentryExtension.prompt",
                    "title": "Prompt"
                },
                {
                    "command": "exampleSamePromptReentryExtension.other",
                    "title": "Other"
                }
            ]
        },
        "permissions": {
            "readWorkspaceFiles": true
        }
    });
    let source = r#"
export async function activate(context) {
  context.commands.registerCommand('exampleSamePromptReentryExtension.prompt', async () => {
    await context.window.showInputBox({
      title: 'Same-extension prompt',
      prompt: 'Prompt owned by this extension',
      placeholder: 'Type here',
      value: 'seed-value',
    })
    return {
      message: 'prompt completed',
      progressLabel: 'Prompt completed',
      taskState: 'succeeded',
    }
  })

  context.commands.registerCommand('exampleSamePromptReentryExtension.other', async () => {
    return {
      message: 'other command completed',
      progressLabel: 'Other command completed',
      taskState: 'succeeded',
    }
  })
}
"#;

    write_file(
        &manifest_path,
        &serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("Failed to serialize same-extension manifest: {error}"))?,
    )?;
    write_file(&entry_path, source)?;
    Ok((
        extension_root.to_string_lossy().to_string(),
        manifest_path.to_string_lossy().to_string(),
    ))
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
        .map_err(|error| format!("Failed to create same-extension probe workspace dir: {error}"))?;
    fs::create_dir_all(&global_config_dir)
        .map_err(|error| format!("Failed to create same-extension probe global config dir: {error}"))?;

    let (extension_path, manifest_path) = build_probe_extension(&workspace_root)?;
    let workspace_root_text = workspace_root.to_string_lossy().to_string();
    let global_config_dir_text = global_config_dir.to_string_lossy().to_string();

    let state = ExtensionHostState::default();
    let activate = extension_host_activate_by_id_for_probe(
        &state,
        &global_config_dir_text,
        &workspace_root_text,
        "example-same-prompt-reentry-extension",
        "onCommand:exampleSamePromptReentryExtension.prompt",
    )?;
    if !activate.activated {
        return Err(format!(
            "Same-extension prompt reentry extension did not activate: {}",
            activate.reason
        ));
    }

    let owner_state = state.clone();
    let owner_extension_path = extension_path.clone();
    let owner_manifest_path = manifest_path.clone();
    let owner_workspace_root = workspace_root_text.clone();
    let owner_thread = std::thread::spawn(move || {
        extension_host_invoke_probe_request(
            &owner_state,
            ExtensionHostRequest::ExecuteCommand {
                activation_event: "onCommand:exampleSamePromptReentryExtension.prompt".to_string(),
                extension_path: owner_extension_path,
                manifest_path: owner_manifest_path,
                main_entry: "./dist/extension.js".to_string(),
                command_id: "exampleSamePromptReentryExtension.prompt".to_string(),
                envelope: extension_host_build_invocation_envelope_for_probe(
                    "same-owner-prompt-task",
                    "example-same-prompt-reentry-extension",
                    &owner_workspace_root,
                    "exampleSamePromptReentryExtension.prompt",
                    "",
                    "",
                    "",
                    "",
                    "workspace",
                    "/tmp/file-a.txt",
                    &serde_json::Value::Object(Default::default()),
                ),
            },
        )
    });

    std::thread::sleep(Duration::from_millis(200));

    let competing_started = Instant::now();
    let competing_result = extension_host_invoke_probe_request(
        &state,
        ExtensionHostRequest::ExecuteCommand {
            activation_event: "onCommand:exampleSamePromptReentryExtension.other".to_string(),
            extension_path: extension_path.clone(),
            manifest_path: manifest_path.clone(),
            main_entry: "./dist/extension.js".to_string(),
            command_id: "exampleSamePromptReentryExtension.other".to_string(),
            envelope: extension_host_build_invocation_envelope_for_probe(
                "same-owner-other-task",
                "example-same-prompt-reentry-extension",
                &workspace_root_text,
                "exampleSamePromptReentryExtension.other",
                "",
                "",
                "",
                "",
                "workspace",
                "/tmp/file-b.txt",
                &serde_json::Value::Object(Default::default()),
            ),
        },
    );
    let competing_elapsed_ms = competing_started.elapsed().as_millis();

    let _ = extension_host_cancel_window_inputs_for_probe(
        &state,
        "example-same-prompt-reentry-extension",
        &workspace_root_text,
    );
    let owner_result = owner_thread
        .join()
        .map_err(|_| "Same-extension owner thread panicked".to_string())?;
    if owner_result.is_err() {
        return Err(format!(
            "Same-extension owner thread failed unexpectedly while cleaning up: {:?}",
            owner_result.err()
        ));
    }

    match competing_result {
        Ok(ExtensionHostResponse::ExecuteCommand(_)) => Err(
            "Same extension unexpectedly ran a second top-level request while its own prompt was pending".to_string(),
        ),
        Ok(other) => Err(format!(
            "Same-extension reentry returned unexpected response kind: {other:?}"
        )),
        Err(error) => {
            if competing_elapsed_ms > 1_000 {
                return Err(format!(
                    "Same-extension reentry should fail fast instead of blocking behind its own prompt: {competing_elapsed_ms}ms"
                ));
            }
            if !error.contains("waiting for UI input from example-same-prompt-reentry-extension") {
                return Err(format!(
                    "Same-extension reentry failed, but not with the expected prompt-reentry error: {error}"
                ));
            }
            println!(
                "{}",
                serde_json::to_string_pretty(&json!({
                    "ok": true,
                    "summary": {
                        "elapsedMs": competing_elapsed_ms,
                        "error": error
                    }
                }))
                .map_err(|serialize_error| {
                    format!("Failed to serialize same-extension prompt reentry probe result: {serialize_error}")
                })?
            );
            Ok(())
        }
    }
}
