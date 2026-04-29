use crate::plugin_manifest::{is_safe_cli_command_name, PluginManifest};
use crate::security::{self, WorkspaceScopeState};
use std::path::{Path, PathBuf};

pub fn validate_manifest_permissions(manifest: &PluginManifest) -> Result<(), String> {
    if manifest.runtime.runtime_type == "cli" && !manifest.permissions.spawn_process {
        return Err("CLI runtime requires spawnProcess permission".to_string());
    }
    if manifest.runtime.runtime_type == "cli"
        && !is_safe_cli_command_name(&manifest.runtime.command)
    {
        return Err("Unsafe CLI command name".to_string());
    }
    Ok(())
}

pub fn validate_plugin_input_file_path(
    scope_state: Option<&WorkspaceScopeState>,
    path: &Path,
) -> Result<PathBuf, String> {
    if let Some(state) = scope_state {
        return security::ensure_allowed_workspace_path(state, path);
    }
    if !path.is_absolute() {
        return Err("Plugin input file path must be absolute".to_string());
    }
    if !path.exists() {
        return Err(format!(
            "Plugin input file does not exist: {}",
            path.display()
        ));
    }
    Ok(path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::{validate_manifest_permissions, validate_plugin_input_file_path};
    use crate::plugin_manifest::PluginManifest;

    fn manifest_with_command(command: &str) -> PluginManifest {
        serde_json::from_value(serde_json::json!({
            "schemaVersion": 1,
            "id": "pdfmathtranslate",
            "name": "PDFMathTranslate",
            "version": "1.0.0",
            "capabilities": ["pdf.translate"],
            "runtime": {
                "type": "cli",
                "command": command
            },
            "permissions": {
                "writeArtifacts": true,
                "spawnProcess": true,
                "network": "none"
            }
        }))
        .expect("manifest")
    }

    #[test]
    fn rejects_unsafe_command_strings() {
        let manifest = manifest_with_command("pdf2zh;rm");
        let error = validate_manifest_permissions(&manifest).expect_err("unsafe command");
        assert_eq!(error, "Unsafe CLI command name");
    }

    #[test]
    fn rejects_relative_input_path_without_scope() {
        let error = validate_plugin_input_file_path(None, std::path::Path::new("paper.pdf"))
            .expect_err("relative path should fail");
        assert_eq!(error, "Plugin input file path must be absolute");
    }
}
