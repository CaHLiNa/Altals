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
    let root =
        std::env::temp_dir().join(format!("scribeflow-extension-cross-prompt-isolation-{now}"));
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

fn build_probe_extensions(workspace_root: &Path) -> Result<(), String> {
    let extensions_root = workspace_root.join(".scribeflow").join("extensions");

    let prompt_extension_root = extensions_root.join("example-prompt-owner-extension");
    let prompt_manifest_path = prompt_extension_root.join("package.json");
    let prompt_entry_path = prompt_extension_root.join("dist").join("extension.js");
    let prompt_manifest = json!({
        "name": "example-prompt-owner-extension",
        "displayName": "Example Prompt Owner Extension",
        "version": "0.1.0",
        "type": "module",
        "main": "./dist/extension.js",
        "activationEvents": [
            "onCommand:examplePromptOwnerExtension.prompt"
        ],
        "contributes": {
            "commands": [
                {
                    "command": "examplePromptOwnerExtension.prompt",
                    "title": "Prompt Owner"
                }
            ]
        },
        "permissions": {
            "readWorkspaceFiles": true
        }
    });
    let prompt_source = r#"
export async function activate(context) {
  context.commands.registerCommand('examplePromptOwnerExtension.prompt', async () => {
    const result = await context.window.showInputBox({
      title: 'Owner prompt',
      prompt: 'Prompt owned by extension A',
      placeholder: 'Type here',
      value: 'seed-value',
    })

    return {
      message: typeof result === 'undefined' ? 'owner prompt cancelled' : 'owner prompt completed',
      progressLabel: 'Owner prompt handled',
      taskState: 'succeeded',
    }
  })
}
"#;

    let competing_extension_root = extensions_root.join("example-competing-extension");
    let competing_manifest_path = competing_extension_root.join("package.json");
    let competing_entry_path = competing_extension_root.join("dist").join("extension.js");
    let competing_manifest = json!({
        "name": "example-competing-extension",
        "displayName": "Example Competing Extension",
        "version": "0.1.0",
        "type": "module",
        "main": "./dist/extension.js",
        "activationEvents": [
            "onCommand:exampleCompetingExtension.run"
        ],
        "contributes": {
            "commands": [
                {
                    "command": "exampleCompetingExtension.run",
                    "title": "Competing Command"
                }
            ]
        },
        "permissions": {
            "readWorkspaceFiles": true
        }
    });
    let competing_source = r#"
export async function activate(context) {
  context.commands.registerCommand('exampleCompetingExtension.run', async () => {
    return {
      message: 'competing command completed',
      progressLabel: 'Competing command completed',
      taskState: 'succeeded',
    }
  })
}
"#;

    write_file(
        &prompt_manifest_path,
        &serde_json::to_string_pretty(&prompt_manifest)
            .map_err(|error| format!("Failed to serialize prompt-owner manifest: {error}"))?,
    )?;
    write_file(&prompt_entry_path, prompt_source)?;

    write_file(
        &competing_manifest_path,
        &serde_json::to_string_pretty(&competing_manifest)
            .map_err(|error| format!("Failed to serialize competing manifest: {error}"))?,
    )?;
    write_file(&competing_entry_path, competing_source)?;

    Ok(())
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
        .map_err(|error| format!("Failed to create cross-prompt probe workspace dir: {error}"))?;
    fs::create_dir_all(&global_config_dir)
        .map_err(|error| format!("Failed to create cross-prompt probe global config dir: {error}"))?;
    build_probe_extensions(&workspace_root)?;

    let workspace_root_text = workspace_root.to_string_lossy().to_string();
    let global_config_dir_text = global_config_dir.to_string_lossy().to_string();
    let prompt_extension_root = workspace_root
        .join(".scribeflow")
        .join("extensions")
        .join("example-prompt-owner-extension");
    let prompt_manifest_path = prompt_extension_root.join("package.json");
    let competing_extension_root = workspace_root
        .join(".scribeflow")
        .join("extensions")
        .join("example-competing-extension");
    let competing_manifest_path = competing_extension_root.join("package.json");

    let state = ExtensionHostState::default();
    let activate_prompt = extension_host_activate_by_id_for_probe(
        &state,
        &global_config_dir_text,
        &workspace_root_text,
        "example-prompt-owner-extension",
        "onCommand:examplePromptOwnerExtension.prompt",
    )?;
    if !activate_prompt.activated {
        return Err(format!(
            "Prompt owner extension did not activate: {}",
            activate_prompt.reason
        ));
    }
    let activate_competing = extension_host_activate_by_id_for_probe(
        &state,
        &global_config_dir_text,
        &workspace_root_text,
        "example-competing-extension",
        "onCommand:exampleCompetingExtension.run",
    )?;
    if !activate_competing.activated {
        return Err(format!(
            "Competing extension did not activate: {}",
            activate_competing.reason
        ));
    }

    let state_for_owner = state.clone();
    let workspace_root_for_owner = workspace_root_text.clone();
    let prompt_manifest_path_text = prompt_manifest_path.to_string_lossy().to_string();
    let prompt_extension_path_text = prompt_extension_root.to_string_lossy().to_string();
    let owner_thread = std::thread::spawn(move || {
        extension_host_invoke_probe_request(
            &state_for_owner,
            ExtensionHostRequest::ExecuteCommand {
                activation_event: "onCommand:examplePromptOwnerExtension.prompt".to_string(),
                extension_path: prompt_extension_path_text,
                manifest_path: prompt_manifest_path_text,
                main_entry: "./dist/extension.js".to_string(),
                command_id: "examplePromptOwnerExtension.prompt".to_string(),
                envelope: extension_host_build_invocation_envelope_for_probe(
                    "owner-prompt-task",
                    "example-prompt-owner-extension",
                    &workspace_root_for_owner,
                    "examplePromptOwnerExtension.prompt",
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
            activation_event: "onCommand:exampleCompetingExtension.run".to_string(),
            extension_path: competing_extension_root.to_string_lossy().to_string(),
            manifest_path: competing_manifest_path.to_string_lossy().to_string(),
            main_entry: "./dist/extension.js".to_string(),
            command_id: "exampleCompetingExtension.run".to_string(),
            envelope: extension_host_build_invocation_envelope_for_probe(
                "competing-command-task",
                "example-competing-extension",
                &workspace_root_text,
                "exampleCompetingExtension.run",
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

    let _ = extension_host_cancel_window_inputs_for_probe(&state, "example-prompt-owner-extension");
    let owner_result = owner_thread
        .join()
        .map_err(|_| "Owner prompt thread panicked".to_string())?;
    if owner_result.is_err() {
        return Err(format!(
            "Owner prompt thread failed unexpectedly while cleaning up: {:?}",
            owner_result.err()
        ));
    }

    match competing_result {
        Ok(ExtensionHostResponse::ExecuteCommand(_)) => Err(
            "Competing extension request unexpectedly ran while another extension owned a pending prompt".to_string(),
        ),
        Ok(other) => Err(format!(
            "Competing extension request returned unexpected response kind: {other:?}"
        )),
        Err(error) => {
            if competing_elapsed_ms > 1_000 {
                return Err(format!(
                    "Competing extension request should fail fast instead of blocking behind a foreign prompt: {competing_elapsed_ms}ms"
                ));
            }
            if !error.contains("waiting for UI input from example-prompt-owner-extension") {
                return Err(format!(
                    "Competing extension request failed, but not with the expected prompt-isolation error: {error}"
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
                    format!("Failed to serialize cross-extension prompt isolation probe result: {serialize_error}")
                })?
            );
            Ok(())
        }
    }
}
