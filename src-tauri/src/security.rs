use crate::app_dirs;
use std::ffi::OsStr;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tokio::net::lookup_host;
use url::Url;

pub struct WorkspaceScopeState {
    active_workspace_root: Mutex<Option<PathBuf>>,
}

impl Default for WorkspaceScopeState {
    fn default() -> Self {
        let _ = app_dirs::data_root_dir();

        Self {
            active_workspace_root: Mutex::new(None),
        }
    }
}

impl WorkspaceScopeState {
    fn allowed_workspace_root(&self) -> Result<PathBuf, String> {
        let guard = self
            .active_workspace_root
            .lock()
            .map_err(|_| "Workspace scope state is unavailable".to_string())?;
        guard
            .clone()
            .ok_or_else(|| "No active workspace is registered".to_string())
    }

    fn is_allowed_workspace_path(&self, path: &Path) -> Result<bool, String> {
        let root = self.allowed_workspace_root()?;
        Ok(is_within_root(path, &root))
    }
}

#[tauri::command]
pub fn workspace_set_active_root(
    path: String,
    state: tauri::State<'_, WorkspaceScopeState>,
) -> Result<(), String> {
    let canonical = canonicalize_for_scope(Path::new(&path))?;
    if !canonical.is_dir() {
        return Err(format!("Workspace root is not a directory: {}", canonical.display()));
    }

    let mut guard = state
        .active_workspace_root
        .lock()
        .map_err(|_| "Workspace scope state is unavailable".to_string())?;
    *guard = Some(canonical);
    Ok(())
}

#[tauri::command]
pub fn workspace_clear_active_root(
    state: tauri::State<'_, WorkspaceScopeState>,
) -> Result<(), String> {
    let mut guard = state
        .active_workspace_root
        .lock()
        .map_err(|_| "Workspace scope state is unavailable".to_string())?;
    *guard = None;
    Ok(())
}

pub fn ensure_workspace_cwd(
    state: &WorkspaceScopeState,
    cwd: &str,
) -> Result<PathBuf, String> {
    let canonical = canonicalize_for_scope(Path::new(cwd))?;
    if state.is_allowed_workspace_path(&canonical)? {
        Ok(canonical)
    } else {
        Err(format!(
            "Path is outside the active workspace: {}",
            canonical.display()
        ))
    }
}

pub async fn validate_public_fetch_url(raw_url: &str) -> Result<Url, String> {
    let url = Url::parse(raw_url).map_err(|e| format!("Invalid URL: {e}"))?;

    match url.scheme() {
        "http" | "https" => {}
        scheme => return Err(format!("Unsupported URL scheme: {scheme}")),
    }

    if !url.username().is_empty() || url.password().is_some() {
        return Err("Embedded credentials are not allowed in fetched URLs".to_string());
    }

    let host = url
        .host_str()
        .ok_or_else(|| "URL has no host".to_string())?
        .trim()
        .to_lowercase();

    if host == "localhost" || host.ends_with(".local") {
        return Err(format!("Local hostnames are not allowed: {host}"));
    }

    let port = url.port_or_known_default().unwrap_or(80);

    if let Ok(ip) = host.parse::<IpAddr>() {
        if !is_public_ip(ip) {
            return Err(format!("Non-public IPs are not allowed: {host}"));
        }
        return Ok(url);
    }

    let mut saw_address = false;
    for addr in lookup_host((host.as_str(), port))
        .await
        .map_err(|e| format!("DNS lookup failed for {host}: {e}"))?
    {
        saw_address = true;
        if !is_public_ip(addr.ip()) {
            return Err(format!(
                "Host resolves to a non-public address: {}",
                addr.ip()
            ));
        }
    }

    if !saw_address {
        return Err(format!("Host did not resolve to any address: {host}"));
    }

    Ok(url)
}

pub fn normalize_absolute_path(path: &Path) -> PathBuf {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("/"))
            .join(path)
    };

    let mut normalized = PathBuf::new();
    for component in absolute.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(Path::new(std::path::MAIN_SEPARATOR_STR)),
            Component::CurDir => {}
            Component::ParentDir => {
                let _ = normalized.pop();
            }
            Component::Normal(part) => normalized.push(part),
        }
    }
    normalized
}

pub fn canonicalize_for_scope(path: &Path) -> Result<PathBuf, String> {
    let normalized = normalize_absolute_path(path);
    if normalized.exists() {
        return std::fs::canonicalize(&normalized)
            .map(|p| normalize_absolute_path(&p))
            .map_err(|e| format!("Failed to resolve path {}: {e}", normalized.display()));
    }

    let mut suffix: Vec<_> = Vec::new();
    let mut current = normalized.clone();

    while !current.exists() {
        let Some(name) = current.file_name().map(OsStr::to_os_string) else {
            return Err(format!(
                "Path has no existing ancestor: {}",
                normalized.display()
            ));
        };
        suffix.push(name);
        current = current.parent().map(Path::to_path_buf).ok_or_else(|| {
            format!("Path has no existing ancestor: {}", normalized.display())
        })?;
    }

    let mut canonical = std::fs::canonicalize(&current)
        .map_err(|e| format!("Failed to resolve path {}: {e}", current.display()))?;
    for segment in suffix.iter().rev() {
        canonical.push(segment);
    }

    Ok(normalize_absolute_path(&canonical))
}

fn is_within_root(path: &Path, root: &Path) -> bool {
    path == root || path.starts_with(root)
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(addr) => is_public_ipv4(addr),
        IpAddr::V6(addr) => is_public_ipv6(addr),
    }
}

fn is_public_ipv4(ip: Ipv4Addr) -> bool {
    let octets = ip.octets();
    !(ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_multicast()
        || ip.is_unspecified()
        || octets[0] == 0
        || (octets[0] == 100 && (64..=127).contains(&octets[1]))
        || (octets[0] == 198 && (octets[1] == 18 || octets[1] == 19)))
}

fn is_public_ipv6(ip: Ipv6Addr) -> bool {
    let segments = ip.segments();
    !(ip.is_loopback()
        || ip.is_unspecified()
        || ip.is_multicast()
        || ip.is_unique_local()
        || ip.is_unicast_link_local()
        || (segments[0] == 0x2001 && segments[1] == 0x0db8))
}
