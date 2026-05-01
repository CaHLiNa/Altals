use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, Stream};
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
    let root = std::env::temp_dir().join(format!("scribeflow-extension-host-reference-pdf-{now}"));
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

fn build_probe_pdf(path: &Path, title: &str, author: &str, year: &str) -> Result<(), String> {
    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();
    let font_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Courier",
    });
    let resources_id = doc.add_object(dictionary! {
        "Font" => dictionary! {
            "F1" => font_id,
        },
    });
    let content = Content {
        operations: vec![
            Operation::new("BT", vec![]),
            Operation::new("Tf", vec!["F1".into(), 24.into()]),
            Operation::new("Td", vec![72.into(), 720.into()]),
            Operation::new("Tj", vec![Object::string_literal(title)]),
            Operation::new("ET", vec![]),
        ],
    };
    let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap_or_default()));
    let page_id = doc.add_object(dictionary! {
        "Type" => "Page",
        "Parent" => pages_id,
        "Contents" => content_id,
    });
    let pages = dictionary! {
        "Type" => "Pages",
        "Kids" => vec![page_id.into()],
        "Count" => 1,
        "Resources" => resources_id,
        "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
    };
    doc.objects.insert(pages_id, Object::Dictionary(pages));

    let catalog_id = doc.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    let info_id = doc.add_object(dictionary! {
        "Title" => Object::string_literal(title),
        "Author" => Object::string_literal(author),
        "CreationDate" => Object::string_literal(format!("D:{year}0101000000Z")),
    });
    doc.trailer.set("Root", catalog_id);
    doc.trailer.set("Info", info_id);
    doc.compress();
    doc.save(path)
        .map_err(|error| format!("Failed to save probe PDF {}: {error}", path.display()))?;
    Ok(())
}

fn build_probe_extension(workspace_root: &Path) -> Result<PathBuf, String> {
    let extension_root = workspace_root
        .join(".scribeflow")
        .join("extensions")
        .join("example-reference-pdf-contract-extension");
    let manifest_path = extension_root.join("package.json");
    let entry_path = extension_root.join("dist").join("extension.js");
    let manifest = json!({
        "name": "example-reference-pdf-contract-extension",
        "displayName": "Example Reference PDF Contract Extension",
        "version": "0.1.0",
        "type": "module",
        "main": "./dist/extension.js",
        "activationEvents": [
            "onCommand:exampleReferencePdfContractExtension.inspect"
        ],
        "contributes": {
            "commands": [
                {
                    "command": "exampleReferencePdfContractExtension.inspect",
                    "title": "Inspect Reference PDF Contract"
                }
            ]
        },
        "permissions": {
            "readWorkspaceFiles": true,
            "readReferenceLibrary": true
        }
    });
    let source = r#"
export async function activate(context) {
  context.commands.registerCommand('exampleReferencePdfContractExtension.inspect', async () => {
    const currentReference = context.references.current
    const currentPdf = context.pdf.current
    const library = await context.references.readCurrentLibrary()
    const metadata = await context.pdf.extractMetadata()
    const text = await context.pdf.extractText()
    let outsidePdfError = ''
    try {
      await context.pdf.extractMetadata('/tmp/reference-pdf-outside.pdf')
    } catch (error) {
      outsidePdfError = error?.message || String(error)
    }

    return {
      message: 'reference pdf contract inspected',
      progressLabel: 'Reference PDF contract inspected',
      taskState: 'succeeded',
      outputs: [
        {
          id: 'reference-pdf-contract-summary',
          type: 'inlineText',
          mediaType: 'application/json',
          title: 'Reference PDF Contract Summary',
          text: JSON.stringify({
            currentReference,
            currentPdf,
            libraryCount: Array.isArray(library?.references) ? library.references.length : 0,
            firstReferenceTitle: library?.references?.[0]?.title || '',
            citationStyle: library?.citationStyle || '',
            metadataTitle: metadata?.metadata?.title || '',
            metadataAuthor: metadata?.metadata?.author || '',
            metadataYear: metadata?.metadata?.year ?? null,
            textIncludesTitle: String(text || '').includes('Probe PDF Title'),
            outsidePdfError,
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
            format!("Failed to serialize reference/pdf probe manifest: {error}")
        })?,
    )?;
    write_file(&entry_path, source)?;
    Ok(manifest_path)
}

fn write_reference_library(global_config_dir: &Path, pdf_path: &str) -> Result<(), String> {
    let library_path = global_config_dir.join("references").join("library.json");
    write_file(
        &library_path,
        &serde_json::to_string_pretty(&json!({
            "version": 2,
            "citationStyle": "apa",
            "documentReferenceSelections": {},
            "collections": [],
            "tags": [],
            "references": [
                {
                    "id": "ref-123",
                    "citationKey": "probe-2025",
                    "title": "Reference Probe Title",
                    "authors": ["Ada Lovelace"],
                    "authorLine": "Ada Lovelace",
                    "typeKey": "journal-article",
                    "pdfPath": pdf_path,
                    "hasPdf": true,
                    "collections": [],
                    "tags": []
                }
            ]
        }))
        .map_err(|error| format!("Failed to serialize reference library snapshot: {error}"))?,
    )
}

fn execute_reference_pdf_command(
    state: &ExtensionHostState,
    workspace_root: &str,
    manifest_path: &str,
    target_path: &str,
) -> Result<ExtensionHostResponse, String> {
    extension_host_invoke_probe_request(
        state,
        ExtensionHostRequest::ExecuteCommand {
            activation_event: "onCommand:exampleReferencePdfContractExtension.inspect".to_string(),
            extension_path: Path::new(manifest_path)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default(),
            manifest_path: manifest_path.to_string(),
            main_entry: "./dist/extension.js".to_string(),
            command_id: "exampleReferencePdfContractExtension.inspect".to_string(),
            envelope: serde_json::from_value(json!({
                "taskId": "task-reference-pdf",
                "extensionId": "example-reference-pdf-contract-extension",
                "workspaceRoot": workspace_root,
                "commandId": "exampleReferencePdfContractExtension.inspect",
                "itemId": "",
                "itemHandle": "",
                "referenceId": "ref-123",
                "capability": "",
                "targetKind": "pdf",
                "targetPath": target_path,
                "settingsJson": "{}"
            }))
            .map_err(|error| format!("Failed to build reference/pdf probe envelope: {error}"))?,
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

fn require_text(value: Option<String>, label: &str) -> Result<String, String> {
    value.ok_or_else(|| format!("Missing output text for {label}"))
}

fn main() -> Result<(), String> {
    let probe_root = unique_temp_dir()?;
    let workspace_root = probe_root.join("workspace");
    let global_config_dir = probe_root.join("global-config");
    fs::create_dir_all(&workspace_root)
        .map_err(|error| format!("Failed to create probe workspace root: {error}"))?;
    fs::create_dir_all(&global_config_dir)
        .map_err(|error| format!("Failed to create probe global config dir: {error}"))?;

    let pdf_path = workspace_root.join("paper.pdf");
    let pdf_path_text = pdf_path.to_string_lossy().to_string();
    build_probe_pdf(&pdf_path, "Probe PDF Title", "Probe Author", "2025")?;
    write_reference_library(&global_config_dir, &pdf_path_text)?;
    let manifest_path = build_probe_extension(&workspace_root)?;

    let workspace_root_text = workspace_root.to_string_lossy().to_string();
    let state = ExtensionHostState::default();
    let activate = extension_host_activate_by_id_for_probe(
        &state,
        &global_config_dir.to_string_lossy(),
        &workspace_root_text,
        "example-reference-pdf-contract-extension",
        "onCommand:exampleReferencePdfContractExtension.inspect",
    )?;
    if !activate.activated {
        return Err(format!(
            "Reference/PDF probe extension did not activate: {}",
            activate.reason
        ));
    }

    let response = execute_reference_pdf_command(
        &state,
        &workspace_root_text,
        &manifest_path.to_string_lossy(),
        &pdf_path_text,
    )?;
    let summary_text = require_text(
        output_text(&response, "reference-pdf-contract-summary"),
        "reference-pdf-contract-summary",
    )?;
    let summary = serde_json::from_str::<Value>(&summary_text)
        .map_err(|error| format!("Failed to parse reference/pdf contract summary: {error}"))?;

    let current_reference = summary
        .get("currentReference")
        .cloned()
        .ok_or_else(|| "Reference/PDF probe missing currentReference".to_string())?;
    let current_pdf = summary
        .get("currentPdf")
        .cloned()
        .ok_or_else(|| "Reference/PDF probe missing currentPdf".to_string())?;
    let library_count = summary
        .get("libraryCount")
        .and_then(Value::as_u64)
        .unwrap_or_default();
    let first_reference_title = summary
        .get("firstReferenceTitle")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let citation_style = summary
        .get("citationStyle")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let metadata_title = summary
        .get("metadataTitle")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let metadata_author = summary
        .get("metadataAuthor")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let metadata_year = summary
        .get("metadataYear")
        .and_then(Value::as_i64)
        .unwrap_or_default();
    let text_includes_title = summary
        .get("textIncludesTitle")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let outside_pdf_error = summary
        .get("outsidePdfError")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    if current_reference.get("id").and_then(Value::as_str).unwrap_or("") != "ref-123" {
        return Err(format!(
            "Reference context id drifted: {current_reference}"
        ));
    }
    if current_reference
        .get("hasReference")
        .and_then(Value::as_bool)
        != Some(true)
    {
        return Err(format!(
            "Reference context hasReference drifted: {current_reference}"
        ));
    }
    if current_reference
        .get("pdfPath")
        .and_then(Value::as_str)
        .unwrap_or("")
        != pdf_path_text
    {
        return Err(format!(
            "Reference context pdfPath drifted: expected {}, got {}",
            pdf_path_text,
            current_reference
                .get("pdfPath")
                .and_then(Value::as_str)
                .unwrap_or("")
        ));
    }
    if current_pdf.get("path").and_then(Value::as_str).unwrap_or("") != pdf_path_text {
        return Err(format!(
            "PDF context path drifted: expected {}, got {}",
            pdf_path_text,
            current_pdf.get("path").and_then(Value::as_str).unwrap_or("")
        ));
    }
    if current_pdf.get("isPdf").and_then(Value::as_bool) != Some(true) {
        return Err(format!("PDF context isPdf drifted: {current_pdf}"));
    }
    if current_pdf
        .get("filename")
        .and_then(Value::as_str)
        .unwrap_or("")
        != "paper.pdf"
    {
        return Err(format!("PDF context filename drifted: {current_pdf}"));
    }
    if current_pdf
        .get("referenceId")
        .and_then(Value::as_str)
        .unwrap_or("")
        != "ref-123"
    {
        return Err(format!("PDF context referenceId drifted: {current_pdf}"));
    }
    if library_count != 1 {
        return Err(format!(
            "Reference library count drifted: expected 1, got {library_count}"
        ));
    }
    if first_reference_title != "Reference Probe Title" {
        return Err(format!(
            "Reference library title drifted: expected Reference Probe Title, got {first_reference_title}"
        ));
    }
    if citation_style != "apa" {
        return Err(format!(
            "Reference library citation style drifted: expected apa, got {citation_style}"
        ));
    }
    if metadata_title != "Probe PDF Title" {
        return Err(format!(
            "PDF metadata title drifted: expected Probe PDF Title, got {metadata_title}"
        ));
    }
    if metadata_author != "Probe Author" {
        return Err(format!(
            "PDF metadata author drifted: expected Probe Author, got {metadata_author}"
        ));
    }
    if metadata_year != 2025 {
        return Err(format!(
            "PDF metadata year drifted: expected 2025, got {metadata_year}"
        ));
    }
    if !text_includes_title {
        return Err("PDF text extraction no longer includes the probe title".to_string());
    }
    if !outside_pdf_error.contains("is not allowed to inspect PDF path") {
        return Err(format!(
            "Outside-workspace PDF error drifted: {outside_pdf_error}"
        ));
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "ok": true,
            "summary": {
                "currentReference": current_reference,
                "currentPdf": current_pdf,
                "libraryCount": library_count,
                "firstReferenceTitle": first_reference_title,
                "citationStyle": citation_style,
                "metadataTitle": metadata_title,
                "metadataAuthor": metadata_author,
                "metadataYear": metadata_year,
                "textIncludesTitle": text_includes_title,
                "outsidePdfError": outside_pdf_error,
            }
        }))
        .map_err(|error| format!("Failed to serialize reference/pdf probe summary: {error}"))?
    );

    Ok(())
}
