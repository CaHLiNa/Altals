use scribeflow_lib::{
    extension_host_activate_by_id_for_probe, extension_host_invoke_probe_request,
    ExtensionHostRequest, ExtensionHostResponse, ExtensionHostState,
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
    let root = std::env::temp_dir().join(format!("scribeflow-extension-host-state-{now}"));
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

fn build_probe_extension(workspace_root: &Path) -> Result<(), String> {
    let extension_root = workspace_root
        .join(".scribeflow")
        .join("extensions")
        .join("example-state-extension");
    let manifest_path = extension_root.join("package.json");
    let entry_path = extension_root.join("dist").join("extension.js");
    let manifest = json!({
        "name": "example-state-extension",
        "displayName": "Example State Extension",
        "version": "0.1.0",
        "type": "module",
        "main": "./dist/extension.js",
        "activationEvents": [
            "onCommand:exampleStateExtension.captureState"
        ],
        "contributes": {
            "commands": [
                {
                    "command": "exampleStateExtension.captureState",
                    "title": "Capture State"
                }
            ]
        },
        "permissions": {
            "readWorkspaceFiles": true
        }
    });
    let source = r#"
export async function activate(context) {
  context.commands.registerCommand('exampleStateExtension.captureState', async () => {
    const nextGlobal = Number(context.globalState.get('launchCount') || 0) + 1
    const nextWorkspace = Number(context.workspaceState.get('workspaceCount') || 0) + 1
    context.globalState.update('launchCount', nextGlobal)
    context.workspaceState.update('workspaceCount', nextWorkspace)
    return {
      message: 'state updated',
      progressLabel: 'State updated',
      taskState: 'succeeded',
      outputs: [
        {
          id: 'global-count',
          type: 'inlineText',
          mediaType: 'text/plain',
          title: 'Global Count',
          text: String(nextGlobal),
        },
        {
          id: 'workspace-count',
          type: 'inlineText',
          mediaType: 'text/plain',
          title: 'Workspace Count',
          text: String(nextWorkspace),
        },
      ],
    }
  })
}
"#;

    write_file(
        &manifest_path,
        &serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("Failed to serialize state probe manifest: {error}"))?,
    )?;
    write_file(&entry_path, source)?;
    Ok(())
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

fn execute_capture_command(
    state: &ExtensionHostState,
    workspace_root: &str,
    manifest_path: &str,
) -> Result<ExtensionHostResponse, String> {
    extension_host_invoke_probe_request(
        state,
        ExtensionHostRequest::ExecuteCommand {
            activation_event: "onCommand:exampleStateExtension.captureState".to_string(),
            extension_path: Path::new(manifest_path)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default(),
            manifest_path: manifest_path.to_string(),
            main_entry: "./dist/extension.js".to_string(),
            command_id: "exampleStateExtension.captureState".to_string(),
            envelope: serde_json::from_value(json!({
                "taskId": "task-state",
                "extensionId": "example-state-extension",
                "workspaceRoot": workspace_root,
                "commandId": "exampleStateExtension.captureState",
                "itemId": "",
                "itemHandle": "",
                "referenceId": "",
                "capability": "",
                "targetKind": "workspace",
                "targetPath": workspace_root,
                "settingsJson": "{}"
            }))
            .map_err(|error| format!("Failed to build state probe envelope: {error}"))?,
        },
    )
}

fn main() -> Result<(), String> {
    let probe_root = unique_temp_dir()?;
    let workspace_root = probe_root.join("workspace-a");
    let workspace_root_b = probe_root.join("workspace-b");
    let global_config_dir = probe_root.join("global-config");
    fs::create_dir_all(&workspace_root)
        .map_err(|error| format!("Failed to create probe workspace root: {error}"))?;
    fs::create_dir_all(&workspace_root_b)
        .map_err(|error| format!("Failed to create secondary probe workspace root: {error}"))?;
    fs::create_dir_all(&global_config_dir)
        .map_err(|error| format!("Failed to create probe global config dir: {error}"))?;
    build_probe_extension(&workspace_root)?;
    build_probe_extension(&workspace_root_b)?;

    let manifest_path = workspace_root
        .join(".scribeflow")
        .join("extensions")
        .join("example-state-extension")
        .join("package.json");
    let manifest_path_b = workspace_root_b
        .join(".scribeflow")
        .join("extensions")
        .join("example-state-extension")
        .join("package.json");

    let workspace_root_text = workspace_root.to_string_lossy().to_string();
    let workspace_root_b_text = workspace_root_b.to_string_lossy().to_string();
    let global_config_dir_text = global_config_dir.to_string_lossy().to_string();

    let first_state = ExtensionHostState::default();
    let activate_first = extension_host_activate_by_id_for_probe(
        &first_state,
        &global_config_dir_text,
        &workspace_root_text,
        "example-state-extension",
        "onCommand:exampleStateExtension.captureState",
    )?;
    if !activate_first.activated {
        return Err(format!(
            "State probe extension did not activate initially: {}",
            activate_first.reason
        ));
    }

    let first = execute_capture_command(
        &first_state,
        &workspace_root_text,
        &manifest_path.to_string_lossy(),
    )?;
    let first_global = output_text(&first, "global-count").unwrap_or_default();
    let first_workspace = output_text(&first, "workspace-count").unwrap_or_default();
    if first_global != "1" || first_workspace != "1" {
        return Err(format!(
            "Initial state update drifted: global={first_global} workspace={first_workspace}"
        ));
    }

    let second_state = ExtensionHostState::default();
    let activate_second = extension_host_activate_by_id_for_probe(
        &second_state,
        &global_config_dir_text,
        &workspace_root_text,
        "example-state-extension",
        "onCommand:exampleStateExtension.captureState",
    )?;
    if !activate_second.activated {
        return Err(format!(
            "State probe extension did not reactivate: {}",
            activate_second.reason
        ));
    }

    let second = execute_capture_command(
        &second_state,
        &workspace_root_text,
        &manifest_path.to_string_lossy(),
    )?;
    let second_global = output_text(&second, "global-count").unwrap_or_default();
    let second_workspace = output_text(&second, "workspace-count").unwrap_or_default();
    if second_global != "2" || second_workspace != "2" {
        return Err(format!(
            "Persisted state did not restore across activation: global={second_global} workspace={second_workspace}"
        ));
    }

    let third_state = ExtensionHostState::default();
    let activate_third = extension_host_activate_by_id_for_probe(
        &third_state,
        &global_config_dir_text,
        &workspace_root_b_text,
        "example-state-extension",
        "onCommand:exampleStateExtension.captureState",
    )?;
    if !activate_third.activated {
        return Err(format!(
            "State probe extension did not activate for secondary workspace: {}",
            activate_third.reason
        ));
    }

    let third = execute_capture_command(
        &third_state,
        &workspace_root_b_text,
        &manifest_path_b.to_string_lossy(),
    )?;
    let third_global = output_text(&third, "global-count").unwrap_or_default();
    let third_workspace = output_text(&third, "workspace-count").unwrap_or_default();
    if third_global != "3" || third_workspace != "1" {
        return Err(format!(
            "Workspace state isolation drifted across roots: global={third_global} workspace={third_workspace}"
        ));
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "ok": true,
            "summary": {
                "firstGlobal": first_global,
                "firstWorkspace": first_workspace,
                "secondGlobal": second_global,
                "secondWorkspace": second_workspace,
                "thirdGlobal": third_global,
                "thirdWorkspace": third_workspace,
            }
        }))
        .map_err(|error| format!("Failed to serialize state persistence probe result: {error}"))?
    );

    Ok(())
}
