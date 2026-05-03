use crate::security;
use percent_encoding::percent_decode_str;
use std::fs;
use std::path::Path;
use tauri::http::{header, Response, StatusCode};
use tauri::{AppHandle, Manager, Runtime};

fn workspace_file_content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("css") => "text/css; charset=utf-8",
        Some("csv") => "text/csv; charset=utf-8",
        Some("gif") => "image/gif",
        Some("htm") | Some("html") => "text/html; charset=utf-8",
        Some("ico") => "image/x-icon",
        Some("js") | Some("mjs") => "text/javascript; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("pdf") => "application/pdf",
        Some("eps") | Some("ps") => "application/postscript",
        Some("txt") | Some("log") => "text/plain; charset=utf-8",
        Some("tif") | Some("tiff") => "image/tiff",
        Some("tsv") => "text/tab-separated-values; charset=utf-8",
        Some("webp") => "image/webp",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("svg") => "image/svg+xml",
        Some("bmp") => "image/bmp",
        _ => "application/octet-stream",
    }
}

fn workspace_protocol_response(
    status: StatusCode,
    content_type: &'static str,
    body: Vec<u8>,
) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::CACHE_CONTROL, "no-store")
        .body(body)
        .unwrap()
}

fn workspace_protocol_error(status: StatusCode, message: impl Into<String>) -> Response<Vec<u8>> {
    workspace_protocol_response(
        status,
        "text/plain; charset=utf-8",
        message.into().into_bytes(),
    )
}

fn parse_workspace_protocol_request_path(request_path: &str) -> Result<(String, String), String> {
    let mut segments = request_path
        .split('/')
        .filter(|segment| !segment.is_empty());

    let scope = segments
        .next()
        .ok_or_else(|| "Missing file scope".to_string())?;

    let scope = percent_decode_str(scope)
        .decode_utf8()
        .map_err(|_| "Invalid workspace scope encoding".to_string())?
        .into_owned();

    let decoded_segments = segments
        .map(|segment| {
            percent_decode_str(segment)
                .decode_utf8()
                .map(|value| value.into_owned())
                .map_err(|_| format!("Invalid workspace path segment encoding: {segment}"))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let relative_path = decoded_segments.join("/");
    if relative_path.is_empty() {
        return Err("Missing file path".to_string());
    }

    Ok((scope, relative_path))
}

pub fn handle_workspace_protocol<R: Runtime>(
    app: &AppHandle<R>,
    request: tauri::http::Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    eprintln!(
        "[workspace-protocol] request uri={} path={}",
        request.uri(),
        request.uri().path()
    );
    let (scope, relative_path) = match parse_workspace_protocol_request_path(request.uri().path()) {
        Ok(parts) => parts,
        Err(error) => return workspace_protocol_error(StatusCode::BAD_REQUEST, error),
    };

    let state = app.state::<security::WorkspaceScopeState>();
    let resolved = match security::resolve_allowed_scoped_path(&state, &scope, &relative_path) {
        Ok(path) => path,
        Err(error) if error.contains("No active") => {
            return workspace_protocol_error(StatusCode::FORBIDDEN, error)
        }
        Err(error) if error.contains("outside") || error.contains("traversal") => {
            return workspace_protocol_error(StatusCode::FORBIDDEN, error)
        }
        Err(error) => return workspace_protocol_error(StatusCode::BAD_REQUEST, error),
    };

    eprintln!(
        "[workspace-protocol] resolved scope={} relative_path={} absolute_path={}",
        scope,
        relative_path,
        resolved.display()
    );

    let bytes = match fs::read(&resolved) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return workspace_protocol_error(
                StatusCode::NOT_FOUND,
                format!("File not found: {}", resolved.display()),
            )
        }
        Err(error) => {
            return workspace_protocol_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to read file: {error}"),
            )
        }
    };

    workspace_protocol_response(
        StatusCode::OK,
        workspace_file_content_type(&resolved),
        bytes,
    )
}

#[cfg(test)]
mod tests {
    use super::{parse_workspace_protocol_request_path, workspace_file_content_type};
    use std::path::Path;

    #[test]
    fn parses_scoped_workspace_file_path() {
        let parsed =
            parse_workspace_protocol_request_path("/workspace/main.tex").expect("valid path");

        assert_eq!(parsed, ("workspace".to_string(), "main.tex".to_string()));
    }

    #[test]
    fn decodes_scoped_workspace_file_path_segments() {
        let parsed =
            parse_workspace_protocol_request_path("/workspace/My%20Paper/figures/Figure%201.svg")
                .expect("valid encoded path");

        assert_eq!(
            parsed,
            (
                "workspace".to_string(),
                "My Paper/figures/Figure 1.svg".to_string(),
            )
        );
    }

    #[test]
    fn rejects_missing_scoped_file_path() {
        let error = parse_workspace_protocol_request_path("/workspace")
            .expect_err("missing relative path should fail");

        assert_eq!(error, "Missing file path");
    }

    #[test]
    fn detects_workspace_protocol_content_types_case_insensitively() {
        assert_eq!(
            workspace_file_content_type(Path::new("artifact.PDF")),
            "application/pdf",
        );
        assert_eq!(
            workspace_file_content_type(Path::new("preview.SVG")),
            "image/svg+xml",
        );
        assert_eq!(
            workspace_file_content_type(Path::new("unknown.asset")),
            "application/octet-stream",
        );
    }
}
