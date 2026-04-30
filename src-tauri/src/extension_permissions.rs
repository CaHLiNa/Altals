use crate::extension_manifest::ExtensionManifest;

pub fn validate_manifest_permissions(manifest: &ExtensionManifest) -> Result<(), String> {
    if manifest.runtime.runtime_type != "extensionHost" {
        return Err("Only extensionHost runtime is supported".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_manifest_permissions;
    use crate::extension_manifest::ExtensionManifest;

    fn extension_manifest() -> ExtensionManifest {
        serde_json::from_value(serde_json::json!({
            "schemaVersion": 1,
            "id": "example-pdf-extension",
            "name": "Example PDF Extension",
            "version": "0.1.0",
            "capabilities": ["pdf.translate"],
            "runtime": {
                "type": "extensionHost"
            },
            "permissions": {
                "writeArtifacts": true,
                "spawnProcess": false,
                "network": "none"
            },
            "contributes": {
                "capabilities": [{
                    "id": "pdf.translate"
                }]
            },
            "main": "./dist/extension.js"
        }))
        .expect("manifest")
    }

    #[test]
    fn accepts_extension_host_runtime() {
        validate_manifest_permissions(&extension_manifest()).expect("extension runtime");
    }
}
