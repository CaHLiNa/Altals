use crate::extension_artifacts::ExtensionArtifact;
use crate::extension_manifest::{
    ExtensionCapabilityContribution, ExtensionInputDefinition, ExtensionOutputDefinition,
    ExtensionManifest,
};
use crate::extension_tasks::ExtensionTaskTarget;

fn normalize_text(value: &str) -> String {
    value.trim().to_string()
}

fn normalize_path(value: &str) -> String {
    value.replace('\\', "/").trim().to_string()
}

fn extname(path: &str) -> String {
    let normalized = normalize_path(path);
    let filename = normalized
        .rsplit('/')
        .next()
        .unwrap_or(normalized.as_str())
        .trim();
    if let Some(index) = filename.rfind('.') {
        if index > 0 {
            return filename[index..].to_ascii_lowercase();
        }
    }
    String::new()
}

fn normalize_extensions(values: &[String]) -> Vec<String> {
    values
        .iter()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .map(|value| {
            if value.starts_with('.') {
                value
            } else {
                format!(".{}", value.trim_start_matches('.'))
            }
        })
        .collect()
}

pub fn manifest_capability_by_id<'a>(
    manifest: &'a ExtensionManifest,
    capability_id: &str,
) -> Option<&'a ExtensionCapabilityContribution> {
    let normalized_capability_id = capability_id.trim();
    if normalized_capability_id.is_empty() {
        return None;
    }
    manifest
        .contributes
        .capabilities
        .iter()
        .find(|capability| capability.id.trim() == normalized_capability_id)
}

fn validate_workspace_file_input(
    input: &ExtensionInputDefinition,
    target: &ExtensionTaskTarget,
) -> Result<(), String> {
    let target_path = normalize_path(&target.path);
    if target_path.is_empty() {
        return Err("Requires an active file target".to_string());
    }

    let allowed_extensions = normalize_extensions(&input.extensions);
    if allowed_extensions.is_empty() {
        return Ok(());
    }

    let target_extension = extname(&target_path);
    if allowed_extensions.iter().any(|value| value == &target_extension) {
        Ok(())
    } else {
        Err(format!(
            "Requires one of: {}",
            allowed_extensions.join(", ")
        ))
    }
}

fn validate_reference_input(target: &ExtensionTaskTarget) -> Result<(), String> {
    if normalize_text(&target.reference_id).is_empty() {
        Err("Requires a selected reference".to_string())
    } else {
        Ok(())
    }
}

fn validate_required_input(
    key: &str,
    input: &ExtensionInputDefinition,
    target: &ExtensionTaskTarget,
) -> Result<(), String> {
    let normalized_type = input.input_type.trim().to_ascii_lowercase();
    let error = match normalized_type.as_str() {
        "workspacefile" => validate_workspace_file_input(input, target),
        "reference" => validate_reference_input(target),
        "artifact" => validate_workspace_file_input(input, target),
        _ => {
            if normalize_path(&target.path).is_empty()
                && normalize_text(&target.reference_id).is_empty()
            {
                Err(format!("Missing required capability input: {key}"))
            } else {
                Ok(())
            }
        }
    };
    error.map_err(|reason| format!("Capability input `{key}` is not satisfied: {reason}"))
}

pub fn validate_capability_inputs(
    capability: &ExtensionCapabilityContribution,
    target: &ExtensionTaskTarget,
) -> Result<(), String> {
    for (key, input) in &capability.inputs {
        if input.required {
            validate_required_input(key, input, target)?;
        }
    }
    Ok(())
}

fn output_matches_definition(
    output: &ExtensionOutputDefinition,
    artifact: &ExtensionArtifact,
) -> bool {
    let output_type = output.output_type.trim().to_ascii_lowercase();
    let media_type = output.media_type.trim().to_ascii_lowercase();
    let artifact_kind = artifact.kind.trim().to_ascii_lowercase();
    let artifact_media_type = artifact.media_type.trim().to_ascii_lowercase();

    let type_matches = match output_type.as_str() {
        "" => true,
        "artifact" => true,
        other => artifact_kind == other,
    };
    let media_type_matches = media_type.is_empty() || artifact_media_type == media_type;
    type_matches && media_type_matches
}

pub fn validate_capability_outputs(
    capability: &ExtensionCapabilityContribution,
    artifacts: &[ExtensionArtifact],
) -> Result<(), String> {
    for (key, output) in &capability.outputs {
        if !output.required {
            continue;
        }
        let matched = artifacts
            .iter()
            .any(|artifact| output_matches_definition(output, artifact));
        if !matched {
            let mut contract = String::new();
            if !output.output_type.trim().is_empty() {
                contract.push_str(output.output_type.trim());
            }
            if !output.media_type.trim().is_empty() {
                if !contract.is_empty() {
                    contract.push(' ');
                }
                contract.push_str(output.media_type.trim());
            }
            return Err(if contract.is_empty() {
                format!("Capability output `{key}` is required but was not produced")
            } else {
                format!(
                    "Capability output `{key}` is required but no matching artifact was produced for {contract}"
                )
            });
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        manifest_capability_by_id, validate_capability_inputs, validate_capability_outputs,
    };
    use crate::extension_artifacts::ExtensionArtifact;
    use crate::extension_manifest::{
        parse_extension_manifest_str, CANONICAL_EXTENSION_MANIFEST_FILENAME,
    };
    use crate::extension_tasks::ExtensionTaskTarget;

    fn manifest() -> crate::extension_manifest::ExtensionManifest {
        parse_extension_manifest_str(
            &serde_json::json!({
                "name": "example-pdf-extension",
                "displayName": "Example PDF Extension",
                "version": "0.1.0",
                "main": "./dist/extension.js",
                "contributes": {
                    "capabilities": [{
                        "id": "pdf.translate",
                        "inputs": {
                            "document": {
                                "type": "workspaceFile",
                                "required": true,
                                "extensions": [".pdf"]
                            },
                            "reference": {
                                "type": "reference",
                                "required": false
                            }
                        },
                        "outputs": {
                            "summary": {
                                "type": "artifact",
                                "mediaType": "text/plain",
                                "required": true
                            },
                            "translatedPdf": {
                                "type": "artifact",
                                "mediaType": "application/pdf",
                                "required": false
                            }
                        }
                    }]
                }
            })
            .to_string(),
            CANONICAL_EXTENSION_MANIFEST_FILENAME,
        )
        .expect("manifest parse")
        .manifest
    }

    fn target(path: &str, reference_id: &str) -> ExtensionTaskTarget {
        ExtensionTaskTarget {
            kind: if path.ends_with(".pdf") {
                "referencePdf".to_string()
            } else {
                "workspace".to_string()
            },
            reference_id: reference_id.to_string(),
            path: path.to_string(),
        }
    }

    #[test]
    fn accepts_matching_required_inputs() {
        let manifest = manifest();
        let capability = manifest_capability_by_id(&manifest, "pdf.translate").expect("capability");
        let result = validate_capability_inputs(capability, &target("/tmp/paper.pdf", "ref-123"));
        assert!(result.is_ok(), "{result:?}");
    }

    #[test]
    fn rejects_missing_workspace_file_input() {
        let manifest = manifest();
        let capability = manifest_capability_by_id(&manifest, "pdf.translate").expect("capability");
        let error =
            validate_capability_inputs(capability, &target("", "ref-123")).expect_err("missing path");
        assert!(error.contains("document"));
        assert!(error.contains("Requires an active file target"));
    }

    #[test]
    fn rejects_wrong_workspace_file_extension() {
        let manifest = manifest();
        let capability = manifest_capability_by_id(&manifest, "pdf.translate").expect("capability");
        let error = validate_capability_inputs(capability, &target("/tmp/note.md", "ref-123"))
            .expect_err("wrong extension");
        assert!(error.contains("Requires one of: .pdf"));
    }

    #[test]
    fn accepts_required_output_artifact_match() {
        let manifest = manifest();
        let capability = manifest_capability_by_id(&manifest, "pdf.translate").expect("capability");
        let artifacts = vec![ExtensionArtifact {
            id: "artifact-1".to_string(),
            extension_id: "example-pdf-extension".to_string(),
            task_id: "task-1".to_string(),
            capability: "pdf.translate".to_string(),
            kind: "translated-text".to_string(),
            media_type: "text/plain".to_string(),
            path: "/tmp/paper.pdf.zh-CN.translation.txt".to_string(),
            source_path: "/tmp/paper.pdf".to_string(),
            source_hash: String::new(),
            created_at: "2026-05-02T00:00:00Z".to_string(),
        }];
        let result = validate_capability_outputs(capability, &artifacts);
        assert!(result.is_ok(), "{result:?}");
    }

    #[test]
    fn rejects_missing_required_output_artifact() {
        let manifest = manifest();
        let capability = manifest_capability_by_id(&manifest, "pdf.translate").expect("capability");
        let error =
            validate_capability_outputs(capability, &[]).expect_err("missing required output");
        assert!(error.contains("summary"));
        assert!(error.contains("text/plain"));
    }
}
