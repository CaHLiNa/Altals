use notify::{recommended_watcher, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

pub const WORKSPACE_TREE_CHANGED_EVENT: &str = "workspace-tree-changed";

#[derive(Default)]
pub struct WorkspaceTreeWatchState {
    session: Mutex<Option<WorkspaceTreeWatchSession>>,
}

struct WorkspaceTreeWatchSession {
    workspace_path: String,
    _watcher: RecommendedWatcher,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceTreeChangedPayload {
    workspace_path: String,
    changed_paths: Vec<String>,
    kind: String,
}

fn normalize_workspace_path(path: &str) -> String {
    let trimmed = path.trim_end_matches(std::path::MAIN_SEPARATOR);
    if trimmed.is_empty() {
        std::path::MAIN_SEPARATOR.to_string()
    } else {
        trimmed.to_string()
    }
}

fn should_emit_event(kind: &EventKind) -> bool {
    !matches!(kind, EventKind::Access(_))
}

fn collect_workspace_event_paths(workspace_root: &Path, event: &Event) -> Vec<String> {
    event
        .paths
        .iter()
        .filter_map(|path| {
            let absolute_path = if path.is_absolute() {
                path.clone()
            } else {
                workspace_root.join(path)
            };
            if absolute_path.starts_with(workspace_root) {
                Some(absolute_path.to_string_lossy().to_string())
            } else {
                None
            }
        })
        .collect()
}

fn create_workspace_tree_watcher(
    app: AppHandle,
    workspace_path: String,
) -> Result<WorkspaceTreeWatchSession, String> {
    let workspace_root = PathBuf::from(&workspace_path);
    if !workspace_root.is_dir() {
        return Err(format!(
            "Workspace path is not a directory: {workspace_path}"
        ));
    }

    let emitted_workspace_path = workspace_path.clone();
    let watcher_root = workspace_root.clone();
    let watcher_app = app.clone();

    let mut watcher = recommended_watcher(move |result: notify::Result<Event>| match result {
        Ok(event) => {
            if !should_emit_event(&event.kind) {
                return;
            }

            let changed_paths = collect_workspace_event_paths(&watcher_root, &event);
            if changed_paths.is_empty() {
                return;
            }

            let payload = WorkspaceTreeChangedPayload {
                workspace_path: emitted_workspace_path.clone(),
                changed_paths,
                kind: format!("{:?}", event.kind),
            };

            let _ = watcher_app.emit(WORKSPACE_TREE_CHANGED_EVENT, payload);
        }
        Err(error) => {
            eprintln!(
                "[fs-watch] watcher error for {}: {}",
                emitted_workspace_path, error
            );
        }
    })
    .map_err(|error| error.to_string())?;

    watcher
        .watch(&workspace_root, RecursiveMode::Recursive)
        .map_err(|error| error.to_string())?;

    Ok(WorkspaceTreeWatchSession {
        workspace_path,
        _watcher: watcher,
    })
}

#[tauri::command]
pub fn workspace_tree_watch_start(
    app: AppHandle,
    state: State<'_, WorkspaceTreeWatchState>,
    path: String,
) -> Result<(), String> {
    let workspace_path = normalize_workspace_path(&path);
    let mut guard = state
        .session
        .lock()
        .map_err(|_| "Failed to acquire workspace watch state".to_string())?;

    if guard
        .as_ref()
        .map(|current| current.workspace_path.as_str())
        == Some(workspace_path.as_str())
    {
        return Ok(());
    }

    drop(guard);
    let session = create_workspace_tree_watcher(app, workspace_path.clone())?;

    guard = state
        .session
        .lock()
        .map_err(|_| "Failed to acquire workspace watch state".to_string())?;
    *guard = Some(session);
    Ok(())
}

#[tauri::command]
pub fn workspace_tree_watch_stop(state: State<'_, WorkspaceTreeWatchState>) -> Result<(), String> {
    let mut guard = state
        .session
        .lock()
        .map_err(|_| "Failed to acquire workspace watch state".to_string())?;
    *guard = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{collect_workspace_event_paths, normalize_workspace_path, should_emit_event};
    use notify::{event::AccessKind, Event, EventKind};
    use std::path::{Path, PathBuf};

    #[test]
    fn normalize_workspace_path_trims_trailing_separator() {
        assert_eq!(
            normalize_workspace_path("/tmp/workspace/"),
            "/tmp/workspace"
        );
        assert_eq!(normalize_workspace_path("/"), "/");
    }

    #[test]
    fn access_events_do_not_trigger_refresh() {
        assert!(!should_emit_event(&EventKind::Access(AccessKind::Close(
            notify::event::AccessMode::Read,
        ))));
        assert!(should_emit_event(&EventKind::Remove(
            notify::event::RemoveKind::Any,
        )));
    }

    #[test]
    fn collect_workspace_event_paths_filters_outside_paths() {
        let workspace_root = Path::new("/tmp/workspace");
        let event = Event {
            kind: EventKind::Modify(notify::event::ModifyKind::Any),
            paths: vec![
                PathBuf::from("/tmp/workspace/a.md"),
                PathBuf::from("/tmp/other/b.md"),
            ],
            attrs: Default::default(),
        };

        assert_eq!(
            collect_workspace_event_paths(workspace_root, &event),
            vec!["/tmp/workspace/a.md".to_string()]
        );
    }
}
