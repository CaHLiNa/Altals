use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::path::Path;
use std::sync::Mutex;
use tauri::Emitter;

use crate::fs_tree::{collect_files_recursive, FileEntry};
use crate::latex_compile::{
    apply_tex_locale_std, apply_tex_locale_tokio, apply_user_perl_local_lib_env_tokio,
    compile_latex_with_preference, latexindent_is_healthy, latexindent_null_path,
    read_or_use_source_content, run_command_with_stdin,
};
use crate::latex_diagnostics::{
    adjust_chktex_columns_for_source, default_chktex_args, discover_chktexrc, parse_chktex_output,
    read_chktex_tab_size,
};
use crate::latex_tools::{
    binary_status, find_chktex, find_latexindent, find_synctex, scribeflow_bin_dir,
    tectonic_binary_name, LatexCompilerStatus, LatexToolStatus,
};
use crate::process_utils::background_command;

pub struct LatexState {
    pub compiling: Mutex<HashMap<String, bool>>,
}

impl Default for LatexState {
    fn default() -> Self {
        Self {
            compiling: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatexError {
    pub file: Option<String>,
    pub line: Option<u32>,
    pub column: Option<u32>,
    pub message: String,
    pub severity: String,
    pub raw: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompileResult {
    pub success: bool,
    pub pdf_path: Option<String>,
    pub synctex_path: Option<String>,
    pub errors: Vec<LatexError>,
    pub warnings: Vec<LatexError>,
    pub log: String,
    pub duration_ms: u64,
    pub compiler_backend: Option<String>,
    pub command_preview: Option<String>,
    pub requested_program: Option<String>,
    pub requested_program_applied: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatexPreviewSyncTargetPathParams {
    #[serde(default)]
    pub reported_file: String,
    #[serde(default)]
    pub source_path: String,
    #[serde(default)]
    pub compile_target_path: String,
    #[serde(default)]
    pub workspace_path: String,
    #[serde(default = "default_include_hidden")]
    pub include_hidden: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatexPreviewEditorSelectionParams {
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub line: usize,
    #[serde(default)]
    pub column: usize,
    #[serde(default)]
    pub text_before_selection: String,
    #[serde(default)]
    pub text_after_selection: String,
    #[serde(default)]
    pub strict_line: bool,
}

fn default_include_hidden() -> bool {
    true
}

#[tauri::command]
pub async fn compile_latex(
    app: tauri::AppHandle,
    state: tauri::State<'_, LatexState>,
    tex_path: String,
    compiler_preference: Option<String>,
    engine_preference: Option<String>,
    build_extra_args: Option<String>,
    custom_system_tex_path: Option<String>,
    custom_tectonic_path: Option<String>,
) -> Result<CompileResult, String> {
    {
        let mut compiling = state.compiling.lock().unwrap();
        if *compiling.get(&tex_path).unwrap_or(&false) {
            return Err("Compilation already in progress for this file.".to_string());
        }
        compiling.insert(tex_path.clone(), true);
    }

    let result = compile_latex_with_preference(
        &app,
        &tex_path,
        compiler_preference,
        engine_preference,
        build_extra_args,
        custom_system_tex_path,
        custom_tectonic_path,
    )
    .await;

    {
        let mut compiling = state.compiling.lock().unwrap();
        compiling.remove(&tex_path);
    }

    result
}

#[tauri::command]
pub async fn check_latex_compilers(
    _app: tauri::AppHandle,
    custom_system_tex_path: Option<String>,
    custom_tectonic_path: Option<String>,
) -> Result<LatexCompilerStatus, String> {
    Ok(LatexCompilerStatus {
        tectonic: binary_status(crate::latex_tools::find_tectonic(
            custom_tectonic_path.as_deref(),
        )),
        system_tex: binary_status(crate::latex_tools::find_system_tex(
            custom_system_tex_path.as_deref(),
        )),
    })
}

#[tauri::command]
pub async fn check_latex_tools(
    custom_system_tex_path: Option<String>,
) -> Result<LatexToolStatus, String> {
    let chktex = find_chktex(custom_system_tex_path.as_deref());
    eprintln!("[latex] check_latex_tools chktex={:?}", chktex);
    let latexindent = match find_latexindent(custom_system_tex_path.as_deref()) {
        Some(path) if latexindent_is_healthy(&path).await => Some(path),
        _ => None,
    };
    eprintln!("[latex] check_latex_tools latexindent={:?}", latexindent);

    Ok(LatexToolStatus {
        chktex: binary_status(chktex),
        latexindent: binary_status(latexindent),
    })
}

#[tauri::command]
pub async fn run_chktex(
    tex_path: String,
    content: Option<String>,
    custom_system_tex_path: Option<String>,
    workspace_path: Option<String>,
) -> Result<Vec<LatexError>, String> {
    let chktex = match find_chktex(custom_system_tex_path.as_deref()) {
        Some(path) => path,
        None => return Ok(Vec::new()),
    };

    let tex = Path::new(&tex_path);
    let dir = tex.parent().ok_or("Invalid tex path")?;
    let tex_arg = tex
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| tex_path.clone());
    let source_content = read_or_use_source_content(&tex_path, content).await?;

    let chktexrc = discover_chktexrc(&tex_path, workspace_path.as_deref());

    let mut command = crate::process_utils::background_tokio_command(&chktex);
    command.current_dir(dir);
    apply_tex_locale_tokio(&mut command);
    command.args(default_chktex_args());
    if let Some(rc_path) = chktexrc.as_ref() {
        command.arg("-l");
        command.arg(rc_path.as_os_str());
    }
    command.args([
        "-I0",
        "-p",
        &tex_arg,
        "-f%f\x1f%l\x1f%c\x1f%k\x1f%n\x1f%m\n",
    ]);

    let (status, stdout, stderr) = run_command_with_stdin(command, source_content.clone()).await?;
    let mut diagnostics = parse_chktex_output(&stdout);
    let tab_size = read_chktex_tab_size(chktexrc.as_deref()).unwrap_or(8);
    adjust_chktex_columns_for_source(&mut diagnostics, &tex_path, &source_content, tab_size);

    if !diagnostics.is_empty() || status.success() {
        return Ok(diagnostics);
    }

    let message = stderr
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .or_else(|| stdout.lines().rev().find(|line| !line.trim().is_empty()))
        .unwrap_or("ChkTeX failed without diagnostics.")
        .trim()
        .to_string();
    Err(message)
}

#[tauri::command]
pub async fn format_latex_document(
    tex_path: String,
    content: String,
    custom_system_tex_path: Option<String>,
) -> Result<String, String> {
    let latexindent = find_latexindent(custom_system_tex_path.as_deref()).ok_or_else(|| {
        "latexindent not found. Install it with your TeX distribution.".to_string()
    })?;

    let tex = Path::new(&tex_path);
    let dir = tex.parent().ok_or("Invalid tex path")?;

    let mut command = crate::process_utils::background_tokio_command(&latexindent);
    command.current_dir(dir);
    apply_tex_locale_tokio(&mut command);
    apply_user_perl_local_lib_env_tokio(&mut command);
    command.arg(format!("-g={}", latexindent_null_path()));
    command.arg("-");

    let (status, stdout, stderr) = run_command_with_stdin(command, content).await?;
    if status.success() {
        return Ok(stdout);
    }

    let message = stderr
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .or_else(|| stdout.lines().rev().find(|line| !line.trim().is_empty()))
        .unwrap_or("latexindent failed.")
        .trim()
        .to_string();
    Err(message)
}

const TECTONIC_VERSION: &str = "0.15.0";

fn tectonic_download_url() -> Result<(String, bool), String> {
    let base = format!(
        "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40{}/tectonic-{}",
        TECTONIC_VERSION, TECTONIC_VERSION
    );

    let arch = if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else {
        return Err("Unsupported architecture".to_string());
    };

    if cfg!(target_os = "macos") {
        Ok((format!("{}-{}-apple-darwin.tar.gz", base, arch), false))
    } else if cfg!(target_os = "linux") {
        Ok((
            format!("{}-{}-unknown-linux-musl.tar.gz", base, arch),
            false,
        ))
    } else if cfg!(target_os = "windows") {
        Ok((format!("{}-{}-pc-windows-msvc.zip", base, arch), true))
    } else {
        Err("Unsupported platform".to_string())
    }
}

#[tauri::command]
pub async fn download_tectonic(app: tauri::AppHandle) -> Result<String, String> {
    let bin_dir =
        scribeflow_bin_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    std::fs::create_dir_all(&bin_dir).map_err(|e| format!("Cannot create directory: {}", e))?;

    let (url, is_zip) = tectonic_download_url()?;
    eprintln!("[tectonic] Downloading from: {}", url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .get(&url)
        .header("User-Agent", "ScribeFlow/1.0")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with HTTP {}", response.status()));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let total_mb = total_bytes as f64 / 1_048_576.0;

    let archive_ext = if is_zip { "zip" } else { "tar.gz" };
    let archive_path = bin_dir.join(format!("tectonic-download.{}", archive_ext));
    let mut file = std::fs::File::create(&archive_path)
        .map_err(|e| format!("Cannot create temp file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut last_pct: u32 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        let pct = if total_bytes > 0 {
            ((downloaded as f64 / total_bytes as f64) * 100.0) as u32
        } else {
            0
        };

        if pct != last_pct {
            last_pct = pct;
            let _ = app.emit(
                "tectonic-download-progress",
                serde_json::json!({
                    "percent": pct,
                    "downloaded_mb": format!("{:.1}", downloaded as f64 / 1_048_576.0),
                    "total_mb": format!("{:.1}", total_mb),
                }),
            );
        }
    }

    drop(file);
    eprintln!("[tectonic] Download complete: {} bytes", downloaded);

    let binary_name = tectonic_binary_name();
    let dest_path = bin_dir.join(binary_name);

    if is_zip {
        #[cfg(windows)]
        {
            let status = background_command("powershell")
                .args(&[
                    "-NoProfile",
                    "-Command",
                    &format!(
                        "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                        archive_path.display(),
                        bin_dir.display(),
                    ),
                ])
                .status()
                .map_err(|e| format!("Extract failed: {}", e))?;
            if !status.success() {
                return Err("Failed to extract zip archive".to_string());
            }
        }
        #[cfg(not(windows))]
        {
            return Err("Zip extraction not supported on this platform".to_string());
        }
    } else {
        let status = background_command("tar")
            .args(&[
                "xzf",
                &archive_path.to_string_lossy(),
                "-C",
                &bin_dir.to_string_lossy(),
            ])
            .status()
            .map_err(|e| format!("Extract failed: {}", e))?;
        if !status.success() {
            return Err("Failed to extract tar.gz archive".to_string());
        }
    }

    let _ = std::fs::remove_file(&archive_path);

    if !dest_path.exists() {
        return Err(format!(
            "Binary not found after extraction at {}",
            dest_path.display()
        ));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&dest_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }

    let result = dest_path.to_string_lossy().to_string();
    eprintln!("[tectonic] Installed to: {}", result);

    let _ = app.emit(
        "tectonic-download-progress",
        serde_json::json!({ "percent": 100, "downloaded_mb": format!("{:.1}", total_mb), "total_mb": format!("{:.1}", total_mb) }),
    );

    Ok(result)
}

#[tauri::command]
pub async fn synctex_backward(
    synctex_path: String,
    page: u32,
    x: f64,
    y: f64,
) -> Result<serde_json::Value, String> {
    let synctex = Path::new(&synctex_path);
    if !synctex.exists() {
        return Err("SyncTeX file not found. Recompile with SyncTeX enabled.".to_string());
    }

    if let Some(pdf_path) = derive_pdf_path_from_synctex_path(&synctex_path) {
        if let Some(binary) = find_synctex(None) {
            if let Ok(result) = run_synctex_edit_cli(&binary, &pdf_path, page, x, y) {
                return Ok(append_synctex_strict_line(result, true));
            }
        }
    }

    let data = read_synctex_nodes(&synctex_path)?;
    Ok(append_synctex_strict_line(
        backward_sync(&data, page, x, y)?,
        false,
    ))
}

#[tauri::command]
pub async fn synctex_forward(
    synctex_path: String,
    file_path: String,
    line: u32,
    column: u32,
) -> Result<serde_json::Value, String> {
    let synctex = Path::new(&synctex_path);
    if !synctex.exists() {
        return Err("SyncTeX file not found. Recompile with SyncTeX enabled.".to_string());
    }

    let normalized_file_path = file_path.trim();
    if normalized_file_path.is_empty() {
        return Err("Source file path is required for forward SyncTeX.".to_string());
    }

    let pdf_path = derive_pdf_path_from_synctex_path(&synctex_path)
        .ok_or_else(|| "Could not derive PDF path from SyncTeX file.".to_string())?;

    if let Some(binary) = find_synctex(None) {
        if let Ok(result) = run_synctex_view_cli(
            &binary,
            normalized_file_path,
            &pdf_path,
            line.max(1),
            column.max(1),
        ) {
            return Ok(append_synctex_strict_line(result, true));
        }
    }

    let data = read_synctex_nodes(&synctex_path)?;
    Ok(append_synctex_strict_line(
        forward_sync(&data, normalized_file_path, line.max(1))?,
        false,
    ))
}

const SYNCTEX_SCALED_POINT_TO_BIG_POINT: f64 = 72.0 / 72.27 / 65536.0;

#[derive(Debug)]
#[allow(dead_code)]
struct SyncNode {
    kind: char,
    file: String,
    line: u32,
    page: u32,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn synctex_scaled_to_big_point(value: f64) -> f64 {
    value * SYNCTEX_SCALED_POINT_TO_BIG_POINT
}

fn normalize_synctex_path(path: &str) -> String {
    path.trim().replace('\\', "/")
}

fn split_normalized_path_segments(value: &str) -> Vec<String> {
    normalize_synctex_path(value)
        .to_lowercase()
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(|segment| segment.to_string())
        .collect()
}

fn score_synctex_input_path(input_path: &str, file_path: &str) -> i32 {
    let normalized_input_path = normalize_synctex_path(input_path).to_lowercase();
    let normalized_file_path = normalize_synctex_path(file_path).to_lowercase();
    if normalized_input_path.is_empty() || normalized_file_path.is_empty() {
        return -1;
    }
    if normalized_input_path == normalized_file_path {
        return 10_000;
    }

    let input_segments = split_normalized_path_segments(&normalized_input_path);
    let file_segments = split_normalized_path_segments(&normalized_file_path);
    if input_segments.is_empty() || file_segments.is_empty() {
        return -1;
    }
    if input_segments.last() != file_segments.last() {
        return -1;
    }

    let mut trailing_matches = 0usize;
    while trailing_matches < input_segments.len()
        && trailing_matches < file_segments.len()
        && input_segments[input_segments.len() - 1 - trailing_matches]
            == file_segments[file_segments.len() - 1 - trailing_matches]
    {
        trailing_matches += 1;
    }

    100 + (trailing_matches as i32) * 25
}

fn resolve_forward_input_file_path(nodes: &[SyncNode], file_path: &str) -> String {
    let mut best_path = String::new();
    let mut best_score = -1;

    for node in nodes {
        let score = score_synctex_input_path(&node.file, file_path);
        if score > best_score {
            best_path = node.file.clone();
            best_score = score;
        }
    }

    if best_score >= 125 {
        best_path
    } else {
        String::new()
    }
}

fn resolve_forward_line_candidate(line_numbers: &[u32], requested_line: u32) -> u32 {
    if line_numbers.is_empty() {
        return 0;
    }
    if line_numbers.contains(&requested_line) {
        return requested_line;
    }
    if let Some(next_line) = line_numbers.iter().copied().find(|line| *line >= requested_line) {
        return next_line;
    }
    *line_numbers.last().unwrap_or(&0)
}

fn append_synctex_strict_line(
    value: serde_json::Value,
    strict_line: bool,
) -> serde_json::Value {
    match value {
        serde_json::Value::Object(mut map) => {
            map.insert(
                "strictLine".to_string(),
                serde_json::Value::Bool(strict_line),
            );
            serde_json::Value::Object(map)
        }
        serde_json::Value::Array(items) => serde_json::Value::Array(
            items.into_iter()
                .map(|item| append_synctex_strict_line(item, strict_line))
                .collect(),
        ),
        other => other,
    }
}

fn derive_pdf_path_from_synctex_path(synctex_path: &str) -> Option<String> {
    if let Some(path) = synctex_path.strip_suffix(".synctex.gz") {
        return Some(format!("{path}.pdf"));
    }
    if let Some(path) = synctex_path.strip_suffix(".synctex") {
        return Some(format!("{path}.pdf"));
    }
    None
}

fn parse_synctex_edit_output(output: &str) -> Result<serde_json::Value, String> {
    let mut input = None;
    let mut line = None;

    for raw_line in output.lines() {
        let trimmed = raw_line.trim();
        if let Some(value) = trimmed.strip_prefix("Input:") {
            input = Some(normalize_synctex_path(value));
        } else if let Some(value) = trimmed.strip_prefix("Line:") {
            line = value.trim().parse::<u32>().ok();
        }

        if let (Some(file), Some(line)) = (&input, line) {
            return Ok(serde_json::json!({
                "file": file,
                "line": line,
            }));
        }
    }

    Err("SyncTeX edit output did not contain a complete result.".to_string())
}

fn push_synctex_view_record(
    records: &mut Vec<serde_json::Map<String, serde_json::Value>>,
    current: &mut serde_json::Map<String, serde_json::Value>,
) {
    let has_page = current
        .get("page")
        .and_then(|value| value.as_u64())
        .map(|page| page > 0)
        .unwrap_or(false);
    let has_point = current.get("x").and_then(|value| value.as_f64()).is_some()
        && current.get("y").and_then(|value| value.as_f64()).is_some();
    let has_rect = current.get("h").and_then(|value| value.as_f64()).is_some()
        && current.get("v").and_then(|value| value.as_f64()).is_some()
        && current.get("W").and_then(|value| value.as_f64()).is_some()
        && current.get("H").and_then(|value| value.as_f64()).is_some();

    if has_page && (has_point || has_rect) {
        let mut record = current.clone();
        record.insert("indicator".to_string(), serde_json::Value::Bool(true));
        records.push(record);
    }

    current.clear();
}

fn parse_synctex_view_output(output: &str) -> Result<serde_json::Value, String> {
    let mut records = Vec::new();
    let mut current = serde_json::Map::new();
    let mut started = false;
    let mut saw_output_marker = false;

    for raw_line in output.lines() {
        let trimmed = raw_line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.contains("SyncTeX result begin") {
            started = true;
            continue;
        }
        if trimmed.contains("SyncTeX result end") {
            break;
        }
        if !started {
            continue;
        }

        let Some((raw_key, raw_value)) = trimmed.split_once(':') else {
            continue;
        };
        let key = raw_key.trim();
        let value = raw_value.trim();

        if key.eq_ignore_ascii_case("Output") {
            push_synctex_view_record(&mut records, &mut current);
            saw_output_marker = true;
            continue;
        }

        if key.eq_ignore_ascii_case("Page") {
            if let Ok(page) = value.parse::<u32>() {
                current.insert(
                    "page".to_string(),
                    serde_json::Value::Number(serde_json::Number::from(page)),
                );
            }
            continue;
        }

        if matches!(key, "x" | "y" | "h" | "v" | "W" | "H") {
            if let Some(number) =
                serde_json::Number::from_f64(value.parse::<f64>().unwrap_or(f64::NAN))
            {
                current.insert(key.to_string(), serde_json::Value::Number(number));
            }
        }
    }

    push_synctex_view_record(&mut records, &mut current);

    if records.is_empty() {
        return Err("SyncTeX view output did not contain a usable PDF location.".to_string());
    }

    if !saw_output_marker && records.len() == 1 {
        return Ok(serde_json::Value::Object(records.remove(0)));
    }

    Ok(serde_json::Value::Array(
        records.into_iter().map(serde_json::Value::Object).collect(),
    ))
}

fn run_synctex_edit_cli(
    synctex_binary: &str,
    pdf_path: &str,
    page: u32,
    x: f64,
    y: f64,
) -> Result<serde_json::Value, String> {
    let location = format!("{}:{:.6}:{:.6}:{}", page.max(1), x, y, pdf_path);
    let mut command = background_command(synctex_binary);
    apply_tex_locale_std(&mut command);
    let output = command
        .args(["edit", "-o", &location])
        .output()
        .map_err(|e| format!("Failed to run synctex edit: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    parse_synctex_edit_output(&String::from_utf8_lossy(&output.stdout))
}

fn run_synctex_view_cli(
    synctex_binary: &str,
    file_path: &str,
    pdf_path: &str,
    line: u32,
    column: u32,
) -> Result<serde_json::Value, String> {
    let source_location = format!("{}:{}:{}", line.max(1), column.max(1), file_path);
    let mut command = background_command(synctex_binary);
    apply_tex_locale_std(&mut command);
    let output = command
        .args(["view", "-i", &source_location, "-o", pdf_path])
        .output()
        .map_err(|e| format!("Failed to run synctex view: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    parse_synctex_view_output(&String::from_utf8_lossy(&output.stdout))
}

fn parse_synctex_content(content: &str) -> Vec<SyncNode> {
    let mut nodes = Vec::new();
    let mut inputs: HashMap<u32, String> = HashMap::new();
    let mut current_page: u32 = 0;
    let mut x_offset: f64 = 0.0;
    let mut y_offset: f64 = 0.0;

    for line in content.lines() {
        if let Some(rest) = line.strip_prefix("Input:") {
            if let Some(colon) = rest.find(':') {
                if let Ok(id) = rest[..colon].parse::<u32>() {
                    inputs.insert(id, rest[colon + 1..].to_string());
                }
            }
            continue;
        }

        if let Some(value) = line.strip_prefix("X Offset:") {
            x_offset = value.trim().parse::<f64>().unwrap_or(0.0);
            continue;
        }

        if let Some(value) = line.strip_prefix("Y Offset:") {
            y_offset = value.trim().parse::<f64>().unwrap_or(0.0);
            continue;
        }

        if let Some(page_marker) = line.strip_prefix('{') {
            if let Ok(page) = page_marker.trim().parse::<u32>() {
                current_page = page;
            }
            continue;
        }

        let kind = match line.chars().next() {
            Some('h' | 'v' | 'x') if line.len() > 1 => line.chars().next().unwrap(),
            _ => continue,
        };

        let Some((head, tail)) = line[1..].split_once(':') else {
            continue;
        };
        let Some((input_id_raw, line_raw)) = head.split_once(',') else {
            continue;
        };
        let Ok(input_id) = input_id_raw.parse::<u32>() else {
            continue;
        };
        let Ok(source_line) = line_raw.parse::<u32>() else {
            continue;
        };
        let Some(file) = inputs.get(&input_id) else {
            continue;
        };

        let (x, y, width, height) = if kind == 'x' {
            let Some((x_raw, y_raw)) = tail.split_once(',') else {
                continue;
            };
            let Ok(x_value) = x_raw.parse::<f64>() else {
                continue;
            };
            let Ok(y_value) = y_raw.parse::<f64>() else {
                continue;
            };
            (
                synctex_scaled_to_big_point(x_offset + x_value),
                synctex_scaled_to_big_point(y_offset + y_value),
                0.0,
                0.0,
            )
        } else {
            let Some((position_part, size_part)) = tail.split_once(':') else {
                continue;
            };
            let mut position_values = position_part.split(',');
            let Some(x_raw) = position_values.next() else {
                continue;
            };
            let Some(y_raw) = position_values.next() else {
                continue;
            };
            let Ok(x_value) = x_raw.parse::<f64>() else {
                continue;
            };
            let Ok(y_value) = y_raw.parse::<f64>() else {
                continue;
            };

            let mut size_values = size_part.split(',');
            let width_value = size_values
                .next()
                .and_then(|value| value.parse::<f64>().ok())
                .unwrap_or(0.0);
            let height_value = size_values
                .next()
                .and_then(|value| value.parse::<f64>().ok())
                .unwrap_or(0.0);

            (
                synctex_scaled_to_big_point(x_offset + x_value),
                synctex_scaled_to_big_point(y_offset + y_value),
                synctex_scaled_to_big_point(width_value),
                synctex_scaled_to_big_point(height_value),
            )
        };

        nodes.push(SyncNode {
            kind,
            file: normalize_synctex_path(file),
            line: source_line,
            page: current_page,
            x,
            y,
            width,
            height,
        });
    }

    nodes
}

fn read_synctex_content(path: &str) -> Result<String, String> {
    use std::io::Read;

    let normalized = Path::new(path);
    if !normalized.exists() {
        return Err("SyncTeX file not found.".to_string());
    }

    if path.ends_with(".gz") {
        let file =
            std::fs::File::open(normalized).map_err(|e| format!("Cannot open synctex: {}", e))?;
        let mut decoder = flate2::read::GzDecoder::new(file);
        let mut content = String::new();
        decoder
            .read_to_string(&mut content)
            .map_err(|e| format!("Cannot decompress synctex: {}", e))?;
        return Ok(content);
    }

    std::fs::read_to_string(normalized).map_err(|e| format!("Cannot read synctex: {}", e))
}

fn read_synctex_nodes(path: &str) -> Result<Vec<SyncNode>, String> {
    Ok(parse_synctex_content(&read_synctex_content(path)?))
}

fn backward_sync(
    nodes: &[SyncNode],
    page: u32,
    x: f64,
    y: f64,
) -> Result<serde_json::Value, String> {
    let mut best: Option<&SyncNode> = None;
    let mut best_dist: f64 = f64::MAX;

    for node in nodes {
        if node.page == page {
            let dx = node.x - x;
            let dy = node.y - y;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist < best_dist {
                best_dist = dist;
                best = Some(node);
            }
        }
    }

    match best {
        Some(node) => Ok(serde_json::json!({
            "file": normalize_synctex_path(&node.file),
            "line": node.line,
            "column": 0,
        })),
        None => Err("No SyncTeX match found at this position.".to_string()),
    }
}

fn forward_sync(nodes: &[SyncNode], file_path: &str, line: u32) -> Result<serde_json::Value, String> {
    let normalized_file_path = normalize_synctex_path(file_path);
    let requested_line = line.max(1);
    if normalized_file_path.is_empty() {
        return Err("Source file path is required for forward SyncTeX.".to_string());
    }

    let input_file_path = resolve_forward_input_file_path(nodes, &normalized_file_path);
    if input_file_path.is_empty() {
        return Err("No SyncTeX input file matched the requested source path.".to_string());
    }

    let mut line_numbers = nodes
        .iter()
        .filter(|node| node.file == input_file_path && node.line > 0)
        .map(|node| node.line)
        .collect::<Vec<_>>();
    line_numbers.sort_unstable();
    line_numbers.dedup();

    let resolved_line = resolve_forward_line_candidate(&line_numbers, requested_line);
    if resolved_line == 0 {
        return Err("No SyncTeX line mapping was found for the requested source file.".to_string());
    }

    let mut page_bounds: HashMap<u32, (f64, f64, f64, f64)> = HashMap::new();
    for node in nodes
        .iter()
        .filter(|node| node.file == input_file_path && node.line == resolved_line && node.page > 0)
    {
        let left = node.x;
        let right = if node.width > 0.0 {
            node.x + node.width
        } else {
            node.x
        };
        let bottom = node.y;
        let top = if node.height > 0.0 {
            node.y - node.height
        } else {
            node.y
        };

        page_bounds
            .entry(node.page)
            .and_modify(|bounds| {
                bounds.0 = bounds.0.min(left);
                bounds.1 = bounds.1.max(right);
                bounds.2 = bounds.2.min(top);
                bounds.3 = bounds.3.max(bottom);
            })
            .or_insert((left, right, top, bottom));
    }

    if page_bounds.is_empty() {
        return Err("No SyncTeX PDF location was found for the requested source line.".to_string());
    }

    let mut pages = page_bounds.into_iter().collect::<Vec<_>>();
    pages.sort_by_key(|(page, _)| *page);

    let mut records = pages
        .into_iter()
        .map(|(page, (left, right, top, bottom))| {
            let width = (right - left).max(0.0);
            let height = (bottom - top).max(0.0);
            serde_json::json!({
                "page": page,
                "x": left,
                "y": bottom,
                "h": left,
                "v": bottom,
                "W": width,
                "H": height,
                "indicator": true,
            })
        })
        .collect::<Vec<_>>();

    if records.len() == 1 {
        return Ok(records.remove(0));
    }

    Ok(serde_json::Value::Array(records))
}

fn collapse_preview_path_segments(value: &str) -> String {
    let normalized = normalize_synctex_path(value);
    if normalized.is_empty() {
        return String::new();
    }

    let has_drive_prefix = normalized.len() >= 3
        && normalized.as_bytes()[1] == b':'
        && normalized.as_bytes()[2] == b'/';
    let is_absolute = normalized.starts_with('/');
    let drive_prefix = if has_drive_prefix {
        normalized[..2].to_string()
    } else {
        String::new()
    };
    let seed = if has_drive_prefix {
        &normalized[3..]
    } else if is_absolute {
        &normalized[1..]
    } else {
        normalized.as_str()
    };

    let mut next_segments = Vec::new();
    for segment in seed.split('/') {
        if segment.is_empty() || segment == "." {
            continue;
        }
        if segment == ".." {
            if !next_segments.is_empty() {
                next_segments.pop();
            }
            continue;
        }
        next_segments.push(segment.to_string());
    }

    if has_drive_prefix {
        if next_segments.is_empty() {
            format!("{drive_prefix}/")
        } else {
            format!("{drive_prefix}/{}", next_segments.join("/"))
        }
    } else if is_absolute {
        if next_segments.is_empty() {
            "/".to_string()
        } else {
            format!("/{}", next_segments.join("/"))
        }
    } else {
        next_segments.join("/")
    }
}

fn dirname_path(path: &str) -> String {
    Path::new(path)
        .parent()
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .unwrap_or_default()
}

fn split_preview_path_segments(value: &str) -> Vec<String> {
    let normalized = collapse_preview_path_segments(value);
    if normalized.is_empty() {
        return Vec::new();
    }

    let has_drive_prefix = normalized.len() >= 3
        && normalized.as_bytes()[1] == b':'
        && normalized.as_bytes()[2] == b'/';
    let seed = if has_drive_prefix {
        &normalized[3..]
    } else if normalized.starts_with('/') {
        &normalized[1..]
    } else {
        normalized.as_str()
    };

    seed
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(|segment| segment.to_string())
        .collect()
}

fn trailing_segment_match_count(left: &str, right: &str) -> usize {
    let left_segments = split_preview_path_segments(left);
    let right_segments = split_preview_path_segments(right);
    let mut matches = 0usize;

    while matches < left_segments.len()
        && matches < right_segments.len()
        && left_segments[left_segments.len() - 1 - matches]
            == right_segments[right_segments.len() - 1 - matches]
    {
        matches += 1;
    }

    matches
}

fn is_preview_tex_path(value: &str) -> bool {
    let normalized = normalize_synctex_path(value).to_ascii_lowercase();
    normalized.ends_with(".tex") || normalized.ends_with(".latex")
}

fn score_moved_path_candidate(candidate_path: &str, reported_path: &str) -> i32 {
    let normalized_candidate = collapse_preview_path_segments(candidate_path);
    let normalized_reported = collapse_preview_path_segments(reported_path);
    if normalized_candidate.is_empty() || normalized_reported.is_empty() {
        return -1;
    }
    if normalized_candidate == normalized_reported {
        return 10_000;
    }

    let candidate_segments = split_preview_path_segments(&normalized_candidate);
    let reported_segments = split_preview_path_segments(&normalized_reported);
    if candidate_segments.is_empty() || reported_segments.is_empty() {
        return -1;
    }
    if candidate_segments.last() != reported_segments.last() {
        return -1;
    }

    100 + (trailing_segment_match_count(&normalized_candidate, &normalized_reported) as i32) * 25
}

fn read_workspace_tex_paths(workspace_path: &str, include_hidden: bool) -> Vec<String> {
    let normalized_workspace_path = normalize_synctex_path(workspace_path);
    if normalized_workspace_path.is_empty() {
        return Vec::new();
    }

    let mut entries: Vec<FileEntry> = Vec::new();
    if collect_files_recursive(
        Path::new(&normalized_workspace_path),
        &mut entries,
        include_hidden,
    )
    .is_err()
    {
        return Vec::new();
    }

    let mut paths = entries
        .into_iter()
        .map(|entry| normalize_synctex_path(&entry.path))
        .filter(|path| is_preview_tex_path(path))
        .collect::<Vec<_>>();
    paths.sort();
    paths.dedup();
    paths
}

fn resolve_relative_preview_path(base_dir: &str, reported_path: &str) -> String {
    if base_dir.trim().is_empty() {
        return collapse_preview_path_segments(reported_path);
    }

    normalize_synctex_path(
        &Path::new(base_dir)
            .join(reported_path)
            .to_string_lossy(),
    )
}

fn resolve_moved_absolute_latex_path(params: &LatexPreviewSyncTargetPathParams) -> String {
    let normalized_reported = collapse_preview_path_segments(&params.reported_file);
    if normalized_reported.is_empty() {
        return String::new();
    }
    if !normalized_reported.starts_with('/')
        && !(normalized_reported.len() >= 3
            && normalized_reported.as_bytes()[1] == b':'
            && normalized_reported.as_bytes()[2] == b'/')
    {
        return normalized_reported;
    }
    if Path::new(&normalized_reported).exists() {
        return normalized_reported;
    }

    let source_path = normalize_synctex_path(&params.source_path);
    let compile_target_path = normalize_synctex_path(&params.compile_target_path);
    let workspace_path = normalize_synctex_path(&params.workspace_path);
    let mut candidates = vec![source_path, compile_target_path];
    candidates.extend(read_workspace_tex_paths(
        &workspace_path,
        params.include_hidden,
    ));

    let mut best_path = String::new();
    let mut best_score = -1;
    for candidate in candidates {
        let score = score_moved_path_candidate(&candidate, &normalized_reported);
        if score > best_score {
            best_path = candidate;
            best_score = score;
        }
    }

    if !best_path.is_empty() && best_score >= 125 && Path::new(&best_path).exists() {
        return best_path;
    }

    normalized_reported
}

fn resolve_sync_target_path_internal(params: &LatexPreviewSyncTargetPathParams) -> String {
    let normalized_reported = collapse_preview_path_segments(&params.reported_file);
    if normalized_reported.is_empty() {
        return String::new();
    }

    if normalized_reported.starts_with('/')
        || (normalized_reported.len() >= 3
            && normalized_reported.as_bytes()[1] == b':'
            && normalized_reported.as_bytes()[2] == b'/')
    {
        return resolve_moved_absolute_latex_path(params);
    }

    let normalized_compile_target_path = normalize_synctex_path(&params.compile_target_path);
    let normalized_source_path = normalize_synctex_path(&params.source_path);
    let workspace_path = normalize_synctex_path(&params.workspace_path);
    let base_dirs = vec![
        if normalized_compile_target_path.is_empty() {
            String::new()
        } else {
            dirname_path(&normalized_compile_target_path)
        },
        if normalized_source_path.is_empty() {
            String::new()
        } else {
            dirname_path(&normalized_source_path)
        },
        workspace_path,
    ];

    for base_dir in base_dirs.iter().filter(|value| !value.is_empty()) {
        let resolved = resolve_relative_preview_path(base_dir, &normalized_reported);
        if !resolved.is_empty() && Path::new(&resolved).exists() {
            return resolved;
        }
    }

    for base_dir in base_dirs.iter().filter(|value| !value.is_empty()) {
        let resolved = resolve_relative_preview_path(base_dir, &normalized_reported);
        if !resolved.is_empty() {
            return resolved;
        }
    }

    normalized_reported
}

fn utf16_units(value: &str) -> Vec<u16> {
    value.encode_utf16().collect()
}

fn find_utf16_indexes(source: &[u16], needle: &[u16]) -> Vec<usize> {
    let mut out = Vec::new();
    if needle.is_empty() || needle.len() > source.len() {
        return out;
    }

    for index in 0..=source.len() - needle.len() {
        if source[index..index + needle.len()] == *needle {
            out.push(index);
        }
    }

    out
}

fn score_column_matches(
    line_text: &str,
    text_before_selection_full: &str,
    text_after_selection_full: &str,
) -> Option<usize> {
    let line_units = utf16_units(line_text);
    let before_units = utf16_units(text_before_selection_full);
    let after_units = utf16_units(text_after_selection_full);
    let max_length = before_units.len().max(after_units.len());
    let mut previous_column_matches: Option<HashMap<usize, usize>> = None;

    for length in 5..=max_length {
        let mut columns = Vec::new();

        if !before_units.is_empty() {
            let start = before_units.len().saturating_sub(length);
            let before_slice = &before_units[start..];
            let before_columns = find_utf16_indexes(&line_units, before_slice)
                .into_iter()
                .map(|index| index + before_slice.len())
                .collect::<Vec<_>>();
            columns.extend(before_columns);
        }

        if !after_units.is_empty() {
            let end = length.min(after_units.len());
            let after_slice = &after_units[..end];
            columns.extend(find_utf16_indexes(&line_units, after_slice));
        }

        let mut column_matches = HashMap::new();
        for column in columns {
            *column_matches.entry(column).or_insert(0usize) += 1;
        }

        let mut values = column_matches.values().copied().collect::<Vec<_>>();
        values.sort_unstable();
        if values.len() > 1 && values[0] == values[1] {
            previous_column_matches = Some(column_matches);
            continue;
        }
        if !values.is_empty() {
            return column_matches
                .into_iter()
                .max_by_key(|(_, count)| *count)
                .map(|(column, _)| column);
        }
        if let Some(previous) = previous_column_matches.take() {
            if !previous.is_empty() {
                return previous
                    .into_iter()
                    .max_by_key(|(_, count)| *count)
                    .map(|(column, _)| column);
            }
        }
        return None;
    }

    None
}

fn build_line_records(content: &str) -> Vec<(String, usize)> {
    let mut records = Vec::new();
    let mut utf16_offset = 0usize;
    for segment in content.split('\n') {
        records.push((segment.to_string(), utf16_offset));
        utf16_offset += segment.encode_utf16().count() + 1;
    }
    records
}

fn resolve_editor_selection_internal(
    params: &LatexPreviewEditorSelectionParams,
) -> Option<serde_json::Value> {
    if params.line < 1 {
        return None;
    }

    let line_records = build_line_records(&params.content);
    if line_records.is_empty() {
        return None;
    }

    let safe_line = params.line.clamp(1, line_records.len());
    let line_utf16_len = line_records[safe_line - 1].0.encode_utf16().count();
    if params.text_before_selection.len() >= 5 || params.text_after_selection.len() >= 5 {
        let candidate_rows = if params.strict_line {
            vec![safe_line]
        } else {
            vec![safe_line, safe_line.saturating_sub(1), safe_line + 1]
        };
        let mut normalized_rows = Vec::new();
        for row in candidate_rows {
            if row == 0 || row > line_records.len() || normalized_rows.contains(&row) {
                continue;
            }
            normalized_rows.push(row);
        }

        for row in normalized_rows {
            let candidate_line = &line_records[row - 1].0;
            let Some(column) = score_column_matches(
                candidate_line,
                &params.text_before_selection,
                &params.text_after_selection,
            ) else {
                continue;
            };
            let safe_column = column.min(candidate_line.encode_utf16().count());
            return Some(serde_json::json!({
                "lineNumber": row,
                "column": safe_column,
            }));
        }
    }

    if params.column > 0 && params.column <= line_utf16_len {
        return Some(serde_json::json!({
            "lineNumber": safe_line,
            "column": params.column,
        }));
    }

    Some(serde_json::json!({
        "lineNumber": safe_line,
        "column": 0,
    }))
}

#[tauri::command]
pub async fn latex_preview_resolve_sync_target_path(
    params: LatexPreviewSyncTargetPathParams,
) -> Result<String, String> {
    Ok(resolve_sync_target_path_internal(&params))
}

#[tauri::command]
pub async fn latex_preview_resolve_editor_selection(
    params: LatexPreviewEditorSelectionParams,
) -> Result<serde_json::Value, String> {
    Ok(resolve_editor_selection_internal(&params).unwrap_or(serde_json::Value::Null))
}

#[cfg(test)]
mod tests {
    use super::{
        forward_sync, parse_synctex_content, parse_synctex_view_output,
        resolve_editor_selection_internal, resolve_sync_target_path_internal,
        LatexPreviewEditorSelectionParams, LatexPreviewSyncTargetPathParams,
    };
    use std::fs;

    #[test]
    fn parse_synctex_view_output_supports_rectangle_records() {
        let output = r#"
SyncTeX result begin
Output:foo
Page:3
x:72.0
y:144.0
h:70.0
v:150.0
W:80.0
H:12.0
Output:bar
Page:4
x:90.0
y:200.0
h:88.0
v:206.0
W:64.0
H:10.0
SyncTeX result end
"#;

        let parsed = parse_synctex_view_output(output).expect("should parse rectangle records");
        let records = parsed.as_array().expect("expected array result");
        assert_eq!(records.len(), 2);
        assert_eq!(records[0]["page"].as_u64(), Some(3));
        assert_eq!(records[1]["page"].as_u64(), Some(4));
        assert_eq!(records[0]["indicator"].as_bool(), Some(true));
    }

    #[test]
    fn parse_synctex_view_output_supports_single_point_record() {
        let output = r#"
SyncTeX result begin
Page:2
x:18.5
y:24.25
SyncTeX result end
"#;

        let parsed = parse_synctex_view_output(output).expect("should parse point record");
        assert!(parsed.is_object());
        assert_eq!(parsed["page"].as_u64(), Some(2));
        assert_eq!(parsed["indicator"].as_bool(), Some(true));
    }

    #[test]
    fn forward_sync_matches_trailing_path_and_uses_next_line_when_needed() {
        let content = r#"SyncTeX Version:1
Input:1:/tmp/project/sections/intro.tex
X Offset:0
Y Offset:0
{1
h1,12:65536,131072:32768,16384
}
"#;

        let nodes = parse_synctex_content(content);
        let parsed = forward_sync(&nodes, "/Users/me/work/intro.tex", 11)
            .expect("should resolve fallback forward sync");

        assert!(parsed.is_object());
        assert_eq!(parsed["page"].as_u64(), Some(1));
        assert_eq!(parsed["indicator"].as_bool(), Some(true));
        assert!(parsed["W"].as_f64().unwrap_or_default() > 0.0);
        assert!(parsed["H"].as_f64().unwrap_or_default() > 0.0);
    }

    #[test]
    fn resolve_editor_selection_prefers_neighboring_line_when_not_strict() {
        let parsed = resolve_editor_selection_internal(&LatexPreviewEditorSelectionParams {
            content: "alpha beta\nprefix target suffix\n".to_string(),
            line: 1,
            column: 0,
            text_before_selection: "prefix ".to_string(),
            text_after_selection: "target".to_string(),
            strict_line: false,
        })
        .expect("selection");

        assert_eq!(parsed["lineNumber"].as_u64(), Some(2));
        assert_eq!(parsed["column"].as_u64(), Some(7));
    }

    #[test]
    fn resolve_sync_target_path_uses_workspace_match_for_moved_absolute_path() {
        let base_dir = std::env::temp_dir().join(format!(
            "scribeflow-preview-sync-{}",
            std::process::id()
        ));
        let workspace_dir = base_dir.join("workspace");
        let source_dir = workspace_dir.join("sections");
        fs::create_dir_all(&source_dir).expect("create workspace");
        let target_path = source_dir.join("intro.tex");
        fs::write(&target_path, "\\section{Intro}\n").expect("write tex file");

        let resolved = resolve_sync_target_path_internal(&LatexPreviewSyncTargetPathParams {
            reported_file: "/moved/location/intro.tex".to_string(),
            source_path: target_path.to_string_lossy().to_string(),
            compile_target_path: String::new(),
            workspace_path: workspace_dir.to_string_lossy().to_string(),
            include_hidden: true,
        });

        assert_eq!(
            resolved.replace('\\', "/"),
            target_path.to_string_lossy().replace('\\', "/"),
        );

        let _ = fs::remove_file(&target_path);
        let _ = fs::remove_dir_all(&base_dir);
    }
}
