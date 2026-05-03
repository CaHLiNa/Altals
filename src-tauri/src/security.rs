use crate::app_dirs;
use std::ffi::OsStr;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

pub struct WorkspaceScopeState {
    allowed_roots: Mutex<AllowedRoots>,
}

#[derive(Clone, Default)]
struct AllowedRoots {
    workspace_root: Option<PathBuf>,
    data_dir: Option<PathBuf>,
    global_config_dir: Option<PathBuf>,
    claude_config_dir: Option<PathBuf>,
}

impl Default for WorkspaceScopeState {
    fn default() -> Self {
        let _ = app_dirs::data_root_dir();

        Self {
            allowed_roots: Mutex::new(AllowedRoots::default()),
        }
    }
}

impl WorkspaceScopeState {
    fn allowed_roots(&self) -> Result<AllowedRoots, String> {
        let guard = self
            .allowed_roots
            .lock()
            .map_err(|_| "Allowed roots state is unavailable".to_string())?;
        Ok(guard.clone())
    }

    fn allowed_root_for_scope(&self, scope: &str) -> Result<PathBuf, String> {
        let roots = self.allowed_roots()?;
        match scope {
            "workspace" => roots
                .workspace_root
                .ok_or_else(|| "No active workspace root is registered".to_string()),
            "data" => roots
                .data_dir
                .ok_or_else(|| "No active workspace data directory is registered".to_string()),
            "global" => roots
                .global_config_dir
                .ok_or_else(|| "No active global config directory is registered".to_string()),
            other => Err(format!("Unsupported scope: {other}")),
        }
    }

    fn has_registered_roots(&self) -> Result<bool, String> {
        let roots = self.allowed_roots()?;
        Ok(roots.workspace_root.is_some()
            || roots.data_dir.is_some()
            || roots.global_config_dir.is_some()
            || roots.claude_config_dir.is_some())
    }

    fn is_within_any_allowed_root(&self, path: &Path) -> Result<bool, String> {
        let roots = self.allowed_roots()?;
        let is_allowed = [
            roots.workspace_root.as_ref(),
            roots.data_dir.as_ref(),
            roots.global_config_dir.as_ref(),
            roots.claude_config_dir.as_ref(),
        ]
        .into_iter()
        .flatten()
        .any(|root| is_within_root(path, root));
        Ok(is_allowed)
    }
}

fn prepare_allowed_directory(path: &Path, create_if_missing: bool) -> Result<PathBuf, String> {
    if create_if_missing && !path.exists() {
        fs::create_dir_all(path).map_err(|e| e.to_string())?;
    }

    let canonical = canonicalize_for_scope(path)?;
    if !canonical.is_dir() {
        return Err(format!(
            "Allowed root is not a directory: {}",
            canonical.display()
        ));
    }
    Ok(canonical)
}

fn relabel_allowed_directory_error(error: String, label: &str) -> String {
    if error.starts_with("Allowed root is not a directory:") {
        error.replacen("Allowed root", label, 1)
    } else {
        error
    }
}

fn prepare_labeled_allowed_directory(
    path: &str,
    label: &str,
    create_if_missing: bool,
) -> Result<PathBuf, String> {
    prepare_allowed_directory(Path::new(path), create_if_missing)
        .map_err(|error| relabel_allowed_directory_error(error, label))
}

fn prepare_optional_labeled_allowed_directory(
    path: Option<&str>,
    label: &str,
) -> Result<Option<PathBuf>, String> {
    match path {
        Some(path) if !path.trim().is_empty() => {
            prepare_labeled_allowed_directory(path, label, true).map(Some)
        }
        _ => Ok(None),
    }
}

pub fn set_allowed_roots_internal(
    state: &WorkspaceScopeState,
    workspace_root: &str,
    data_dir: Option<&str>,
    global_config_dir: Option<&str>,
    claude_config_dir: Option<&str>,
) -> Result<(), String> {
    let canonical_workspace_root =
        prepare_labeled_allowed_directory(workspace_root, "Workspace root", false)?;
    let canonical_data_dir =
        prepare_optional_labeled_allowed_directory(data_dir, "Workspace data directory")?;
    let canonical_global_config_dir =
        prepare_optional_labeled_allowed_directory(global_config_dir, "Global config directory")?;
    let canonical_claude_config_dir =
        prepare_optional_labeled_allowed_directory(claude_config_dir, "Claude config directory")?;

    let mut guard = state
        .allowed_roots
        .lock()
        .map_err(|_| "Allowed roots state is unavailable".to_string())?;
    *guard = AllowedRoots {
        workspace_root: Some(canonical_workspace_root),
        data_dir: canonical_data_dir,
        global_config_dir: canonical_global_config_dir,
        claude_config_dir: canonical_claude_config_dir,
    };
    Ok(())
}

pub fn clear_allowed_roots_internal(state: &WorkspaceScopeState) -> Result<(), String> {
    let mut guard = state
        .allowed_roots
        .lock()
        .map_err(|_| "Allowed roots state is unavailable".to_string())?;
    *guard = AllowedRoots::default();
    Ok(())
}

#[tauri::command]
pub fn workspace_set_allowed_roots(
    workspace_root: String,
    data_dir: Option<String>,
    global_config_dir: Option<String>,
    claude_config_dir: Option<String>,
    state: tauri::State<'_, WorkspaceScopeState>,
) -> Result<(), String> {
    set_allowed_roots_internal(
        state.inner(),
        &workspace_root,
        data_dir.as_deref(),
        global_config_dir.as_deref(),
        claude_config_dir.as_deref(),
    )
}

#[tauri::command]
pub fn workspace_clear_allowed_roots(
    state: tauri::State<'_, WorkspaceScopeState>,
) -> Result<(), String> {
    clear_allowed_roots_internal(state.inner())
}

pub fn ensure_allowed_workspace_path(
    state: &WorkspaceScopeState,
    path: &Path,
) -> Result<PathBuf, String> {
    if !state.has_registered_roots()? {
        return Err("No active workspace roots are registered".to_string());
    }

    let canonical = canonicalize_for_scope(path)?;
    if state.is_within_any_allowed_root(&canonical)? {
        Ok(canonical)
    } else {
        Err(format!(
            "Path is outside the allowed workspace roots: {}",
            canonical.display()
        ))
    }
}

pub fn ensure_allowed_mutation_path(
    state: &WorkspaceScopeState,
    path: &Path,
) -> Result<PathBuf, String> {
    ensure_allowed_workspace_path(state, path)
}

pub fn resolve_allowed_scoped_path(
    state: &WorkspaceScopeState,
    scope: &str,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let root = state.allowed_root_for_scope(scope)?;
    let mut resolved = root.clone();

    for component in Path::new(relative_path).components() {
        match component {
            Component::Normal(segment) => resolved.push(segment),
            Component::CurDir => {}
            Component::RootDir | Component::ParentDir | Component::Prefix(_) => {
                return Err("Path traversal is not allowed".to_string())
            }
        }
    }

    let canonical = canonicalize_for_scope(&resolved)?;
    if !is_within_root(&canonical, &root) {
        return Err(format!(
            "Path is outside the allowed {scope} scope: {}",
            canonical.display()
        ));
    }
    Ok(canonical)
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
        current = current
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| format!("Path has no existing ancestor: {}", normalized.display()))?;
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

#[cfg(test)]
mod tests {
    use super::{ensure_allowed_workspace_path, set_allowed_roots_internal, WorkspaceScopeState};
    use std::fs;

    #[test]
    fn ensure_allowed_workspace_path_rejects_unregistered_scope() {
        let state = WorkspaceScopeState::default();
        let error = ensure_allowed_workspace_path(&state, std::path::Path::new("/tmp"))
            .expect_err("unregistered scope should fail");

        assert_eq!(error, "No active workspace roots are registered");
    }

    #[test]
    fn ensure_allowed_workspace_path_allows_workspace_and_rejects_outside() {
        let temp_root =
            std::env::temp_dir().join(format!("scribeflow-scope-root-{}", uuid::Uuid::new_v4()));
        let outside_root =
            std::env::temp_dir().join(format!("scribeflow-scope-outside-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_root).expect("create workspace root");
        fs::create_dir_all(&outside_root).expect("create outside root");

        let allowed_file = temp_root.join("note.md");
        let outside_file = outside_root.join("note.md");
        fs::write(&allowed_file, "inside").expect("write allowed file");
        fs::write(&outside_file, "outside").expect("write outside file");

        let state = WorkspaceScopeState::default();
        set_allowed_roots_internal(&state, &temp_root.to_string_lossy(), None, None, None)
            .expect("register workspace root");

        let allowed = ensure_allowed_workspace_path(&state, &allowed_file)
            .expect("workspace file should be allowed");
        assert!(allowed.ends_with("note.md"));

        let error = ensure_allowed_workspace_path(&state, &outside_file)
            .expect_err("outside file should be rejected");
        assert!(error.starts_with("Path is outside the allowed workspace roots:"));

        fs::remove_dir_all(temp_root).ok();
        fs::remove_dir_all(outside_root).ok();
    }

    #[test]
    fn allowed_root_directory_errors_keep_scope_labels() {
        let temp_root =
            std::env::temp_dir().join(format!("scribeflow-scope-file-{}", uuid::Uuid::new_v4()));
        fs::write(&temp_root, "not a directory").expect("write file root");

        let state = WorkspaceScopeState::default();
        let error =
            set_allowed_roots_internal(&state, &temp_root.to_string_lossy(), None, None, None)
                .expect_err("file root should fail");

        assert!(error.starts_with("Workspace root is not a directory:"));
        fs::remove_file(temp_root).ok();
    }
}
