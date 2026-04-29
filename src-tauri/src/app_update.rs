use futures_util::StreamExt;
use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Emitter;
use url::Url;

use crate::process_utils::background_command;

const DOWNLOAD_DIRNAME: &str = "ScribeFlow";
const RELEASE_HOST: &str = "github.com";
const RELEASE_PATH_PREFIX: &str = "/CaHLiNa/ScribeFlow/releases/download/";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateDownloadResult {
    pub path: String,
    pub file_name: String,
    pub folder_path: String,
    pub bytes: u64,
}

fn app_update_download_dir() -> Result<PathBuf, String> {
    let downloads_dir =
        dirs::download_dir().ok_or_else(|| "Cannot find the Downloads directory.".to_string())?;
    Ok(downloads_dir.join(DOWNLOAD_DIRNAME))
}

fn sanitize_release_asset_name(file_name: &str) -> Result<String, String> {
    let sanitized = file_name
        .trim()
        .chars()
        .filter_map(|value| match value {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => Some('-'),
            value if value.is_control() => None,
            value => Some(value),
        })
        .collect::<String>();

    let sanitized = sanitized.trim_matches(['.', ' ']).to_string();
    if sanitized.is_empty() {
        return Err("Release asset file name is empty.".to_string());
    }

    let extension = Path::new(&sanitized)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    if !matches!(extension.as_str(), "dmg" | "exe" | "msi") {
        return Err("Release asset must be a DMG, EXE, or MSI installer.".to_string());
    }

    Ok(sanitized)
}

fn validate_release_asset_url(download_url: &str) -> Result<Url, String> {
    let url = Url::parse(download_url).map_err(|_| "Release asset URL is invalid.".to_string())?;
    if url.scheme() != "https"
        || url.host_str() != Some(RELEASE_HOST)
        || !url.path().starts_with(RELEASE_PATH_PREFIX)
    {
        return Err("Release asset URL is not a ScribeFlow GitHub release asset.".to_string());
    }
    Ok(url)
}

fn reveal_path_in_file_manager(target: &Path) -> Result<(), String> {
    if !target.exists() {
        return Err("Path does not exist.".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let mut command = background_command("open");
        if target.is_file() {
            command.arg("-R");
        }
        command.arg(target);
        let status = command.status().map_err(|error| error.to_string())?;
        if status.success() {
            return Ok(());
        }
        return Err(format!("Failed to reveal path in Finder: {status}"));
    }

    #[cfg(target_os = "windows")]
    {
        let normalized = target.to_string_lossy().replace('/', "\\");
        let mut command = background_command("explorer");
        if target.is_file() {
            command.arg("/select,");
            command.arg(&normalized);
        } else {
            command.arg(&normalized);
        }
        let status = command.status().map_err(|error| error.to_string())?;
        if status.success() {
            return Ok(());
        }
        return Err(format!("Failed to reveal path in Explorer: {status}"));
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let open_target = if target.is_file() {
            target
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| target.to_path_buf())
        } else {
            target.to_path_buf()
        };
        let status = background_command("xdg-open")
            .arg(open_target)
            .status()
            .map_err(|error| error.to_string())?;
        if status.success() {
            return Ok(());
        }
        return Err(format!("Failed to reveal path in file manager: {status}"));
    }
}

#[tauri::command]
pub async fn app_update_download_asset(
    app: tauri::AppHandle,
    download_url: String,
    file_name: String,
) -> Result<AppUpdateDownloadResult, String> {
    let url = validate_release_asset_url(&download_url)?;
    let file_name = sanitize_release_asset_name(&file_name)?;
    let download_dir = app_update_download_dir()?;
    fs::create_dir_all(&download_dir)
        .map_err(|error| format!("Cannot create download directory: {error}"))?;

    let destination_path = download_dir.join(&file_name);
    let temporary_path = download_dir.join(format!("{file_name}.download"));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|error| format!("HTTP client error: {error}"))?;

    let response = client
        .get(url)
        .header("User-Agent", "ScribeFlow updater")
        .send()
        .await
        .map_err(|error| format!("Download failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with HTTP {}", response.status()));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut last_percent: u32 = 0;
    let mut stream = response.bytes_stream();
    let mut file = fs::File::create(&temporary_path)
        .map_err(|error| format!("Cannot create download file: {error}"))?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("Download error: {error}"))?;
        file.write_all(&chunk)
            .map_err(|error| format!("Write error: {error}"))?;
        downloaded += chunk.len() as u64;

        let percent = if total_bytes > 0 {
            ((downloaded as f64 / total_bytes as f64) * 100.0).round() as u32
        } else {
            0
        };
        if percent != last_percent {
            last_percent = percent;
            let _ = app.emit(
                "app-update-download-progress",
                serde_json::json!({
                    "percent": percent,
                    "downloadedBytes": downloaded,
                    "totalBytes": total_bytes,
                    "fileName": file_name,
                }),
            );
        }
    }

    file.flush()
        .map_err(|error| format!("Flush download file failed: {error}"))?;
    drop(file);

    if destination_path.exists() {
        fs::remove_file(&destination_path)
            .map_err(|error| format!("Cannot replace existing installer: {error}"))?;
    }
    fs::rename(&temporary_path, &destination_path)
        .map_err(|error| format!("Cannot finalize download: {error}"))?;

    Ok(AppUpdateDownloadResult {
        path: destination_path.to_string_lossy().to_string(),
        file_name,
        folder_path: download_dir.to_string_lossy().to_string(),
        bytes: downloaded,
    })
}

#[tauri::command]
pub async fn app_update_reveal_download(path: String) -> Result<(), String> {
    let download_dir = app_update_download_dir()?;
    let target = PathBuf::from(path);
    let canonical_download_dir = download_dir
        .canonicalize()
        .map_err(|error| format!("Cannot resolve download directory: {error}"))?;
    let canonical_target = target
        .canonicalize()
        .map_err(|error| format!("Cannot resolve downloaded file: {error}"))?;
    if !canonical_target.starts_with(&canonical_download_dir) {
        return Err("Only ScribeFlow update downloads can be revealed.".to_string());
    }
    reveal_path_in_file_manager(&canonical_target)
}

#[cfg(test)]
mod tests {
    use super::{sanitize_release_asset_name, validate_release_asset_url};

    #[test]
    fn validates_scribeflow_release_asset_urls() {
        assert!(validate_release_asset_url(
            "https://github.com/CaHLiNa/ScribeFlow/releases/download/v1.0.16/ScribeFlow-1.0.16-darwin-aarch64.dmg"
        )
        .is_ok());
        assert!(validate_release_asset_url("https://example.com/file.dmg").is_err());
    }

    #[test]
    fn sanitizes_installer_asset_names() {
        assert_eq!(
            sanitize_release_asset_name("ScribeFlow:1.0.16?.dmg").expect("valid name"),
            "ScribeFlow-1.0.16-.dmg"
        );
        assert!(sanitize_release_asset_name("../payload.sh").is_err());
    }
}
