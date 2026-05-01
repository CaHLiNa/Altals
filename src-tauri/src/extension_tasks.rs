use crate::app_dirs;
use crate::extension_artifacts::ExtensionArtifact;
#[cfg(not(test))]
use tauri::Emitter;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

const TASKS_FILENAME: &str = "tasks.json";
#[cfg(not(test))]
pub const EXTENSION_TASK_CHANGED_EVENT: &str = "extension-task-changed";

#[derive(Clone, Default)]
pub struct ExtensionTaskRuntimeState {
    running_pids: Arc<Mutex<HashMap<String, u32>>>,
    #[cfg(not(test))]
    app_handle: Arc<Mutex<Option<tauri::AppHandle>>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionTaskTarget {
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub reference_id: String,
    #[serde(default)]
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionTaskProgress {
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub current: u32,
    #[serde(default)]
    pub total: u32,
}

impl Default for ExtensionTaskProgress {
    fn default() -> Self {
        Self {
            label: String::new(),
            current: 0,
            total: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionTask {
    pub id: String,
    pub extension_id: String,
    pub capability: String,
    #[serde(default)]
    pub command_id: String,
    pub state: String,
    pub created_at: String,
    pub started_at: String,
    pub finished_at: String,
    pub target: ExtensionTaskTarget,
    pub settings: Value,
    pub progress: ExtensionTaskProgress,
    pub artifacts: Vec<ExtensionArtifact>,
    pub error: String,
    pub log_path: String,
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionTaskArtifactPatch {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub media_type: String,
    #[serde(default)]
    pub path: String,
    #[serde(default)]
    pub source_path: String,
    #[serde(default)]
    pub source_hash: String,
    #[serde(default)]
    pub created_at: String,
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionTaskUpdatePatch {
    #[serde(default)]
    pub task_id: String,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub progress_label: String,
    pub progress_current: Option<u32>,
    pub progress_total: Option<u32>,
    #[serde(default)]
    pub error: String,
    #[serde(default)]
    pub artifacts: Vec<ExtensionTaskArtifactPatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionTasksFile {
    #[serde(default = "default_tasks_version")]
    version: u32,
    #[serde(default)]
    tasks: Vec<ExtensionTask>,
}

impl Default for ExtensionTasksFile {
    fn default() -> Self {
        Self {
            version: default_tasks_version(),
            tasks: Vec::new(),
        }
    }
}

fn default_tasks_version() -> u32 {
    1
}

fn now_string() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn normalize_task_state(value: &str) -> Option<&'static str> {
    match value.trim().to_ascii_lowercase().as_str() {
        "queued" => Some("queued"),
        "running" => Some("running"),
        "succeeded" => Some("succeeded"),
        "failed" => Some("failed"),
        "cancelled" => Some("cancelled"),
        _ => None,
    }
}

fn is_terminal_task_state(value: &str) -> bool {
    matches!(value.trim(), "succeeded" | "failed" | "cancelled")
}

pub fn tasks_dir() -> Result<PathBuf, String> {
    app_dirs::extension_tasks_dir()
}

fn task_dir_in(tasks_root: &Path, task_id: &str) -> Result<PathBuf, String> {
    let dir = tasks_root.join(task_id);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    }
    Ok(dir)
}

fn tasks_file_path_in(tasks_root: &Path) -> PathBuf {
    tasks_root.join(TASKS_FILENAME)
}

fn read_tasks_file_raw_from(tasks_root: &Path) -> Result<ExtensionTasksFile, String> {
    let path = tasks_file_path_in(tasks_root);
    if !path.exists() {
        return Ok(ExtensionTasksFile::default());
    }
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str::<ExtensionTasksFile>(&content)
        .map_err(|error| format!("Failed to parse extension tasks: {error}"))
}

fn write_tasks_file_to(tasks_root: &Path, file: &ExtensionTasksFile) -> Result<(), String> {
    let path = tasks_file_path_in(tasks_root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let serialized = serde_json::to_string_pretty(file)
        .map_err(|error| format!("Failed to serialize extension tasks: {error}"))?;
    fs::write(path, serialized).map_err(|error| error.to_string())
}

#[cfg(not(test))]
fn emit_task_changed(task: &ExtensionTask, app_handle: &Arc<Mutex<Option<tauri::AppHandle>>>) {
    let Ok(handle) = app_handle.lock() else {
        return;
    };
    if let Some(app) = handle.as_ref() {
        let _ = app.emit(EXTENSION_TASK_CHANGED_EVENT, task.clone());
    }
}

fn recover_interrupted_tasks(mut file: ExtensionTasksFile) -> ExtensionTasksFile {
    let now = now_string();
    for task in &mut file.tasks {
        if matches!(task.state.as_str(), "queued" | "running") {
            task.state = "failed".to_string();
            task.finished_at = now.clone();
            task.error = "Interrupted by application shutdown".to_string();
        }
    }
    file
}

pub fn list_tasks() -> Result<Vec<ExtensionTask>, String> {
    list_tasks_from_dir(&tasks_dir()?)
}

fn list_tasks_from_dir(tasks_root: &Path) -> Result<Vec<ExtensionTask>, String> {
    let file = read_tasks_file_raw_from(tasks_root)?;
    Ok(file.tasks)
}

pub fn recover_interrupted_tasks_on_startup() -> Result<Vec<ExtensionTask>, String> {
    recover_interrupted_tasks_in_dir(&tasks_dir()?)
}

fn recover_interrupted_tasks_in_dir(tasks_root: &Path) -> Result<Vec<ExtensionTask>, String> {
    let file = recover_interrupted_tasks(read_tasks_file_raw_from(tasks_root)?);
    write_tasks_file_to(tasks_root, &file)?;
    Ok(file.tasks)
}

pub fn get_task(task_id: &str) -> Result<ExtensionTask, String> {
    list_tasks()?
        .into_iter()
        .find(|task| task.id == task_id)
        .ok_or_else(|| format!("Extension task not found: {task_id}"))
}

pub fn create_command_task(
    extension_id: &str,
    command_id: &str,
    target: ExtensionTaskTarget,
    settings: Value,
) -> Result<ExtensionTask, String> {
    create_task_in_dir(
        &tasks_dir()?,
        extension_id,
        command_id,
        command_id,
        target,
        settings,
    )
}

fn create_task_in_dir(
    tasks_root: &Path,
    extension_id: &str,
    capability: &str,
    command_id: &str,
    target: ExtensionTaskTarget,
    settings: Value,
) -> Result<ExtensionTask, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let log_path = task_dir_in(tasks_root, &id)?
        .join("task.log")
        .to_string_lossy()
        .to_string();
    let now = now_string();
    let task = ExtensionTask {
        id: id.clone(),
        extension_id: extension_id.to_string(),
        capability: capability.to_string(),
        command_id: command_id.to_string(),
        state: "queued".to_string(),
        created_at: now,
        started_at: String::new(),
        finished_at: String::new(),
        target,
        settings,
        progress: ExtensionTaskProgress {
            label: "Queued".to_string(),
            current: 0,
            total: 0,
        },
        artifacts: Vec::new(),
        error: String::new(),
        log_path,
    };

    let mut file = read_tasks_file_raw_from(tasks_root)?;
    file.tasks.insert(0, task.clone());
    write_tasks_file_to(tasks_root, &file)?;
    Ok(task)
}

pub fn update_task<F>(task_id: &str, update: F) -> Result<ExtensionTask, String>
where
    F: FnOnce(&mut ExtensionTask),
{
    update_task_in_dir(&tasks_dir()?, task_id, update)
}

fn update_task_in_dir<F>(
    tasks_root: &Path,
    task_id: &str,
    update: F,
) -> Result<ExtensionTask, String>
where
    F: FnOnce(&mut ExtensionTask),
{
    let mut file = read_tasks_file_raw_from(tasks_root)?;
    let Some(task) = file.tasks.iter_mut().find(|task| task.id == task_id) else {
        return Err(format!("Extension task not found: {task_id}"));
    };
    update(task);
    let updated = task.clone();
    write_tasks_file_to(tasks_root, &file)?;
    Ok(updated)
}

pub fn mark_task_running(task_id: &str) -> Result<ExtensionTask, String> {
    update_task(task_id, |task| {
        task.state = "running".to_string();
        task.started_at = now_string();
        task.finished_at.clear();
        task.error.clear();
        task.progress = ExtensionTaskProgress {
            label: "Running".to_string(),
            current: 0,
            total: 0,
        };
    })
}

pub fn mark_task_queued(
    task_id: &str,
    progress_label: &str,
    artifacts: Vec<ExtensionArtifact>,
) -> Result<ExtensionTask, String> {
    update_task(task_id, |task| {
        task.state = "queued".to_string();
        task.started_at.clear();
        task.finished_at.clear();
        task.error.clear();
        task.progress = ExtensionTaskProgress {
            label: if progress_label.trim().is_empty() {
                "Queued".to_string()
            } else {
                progress_label.trim().to_string()
            },
            current: 0,
            total: 0,
        };
        task.artifacts = artifacts;
    })
}

pub fn mark_task_running_with_progress(
    task_id: &str,
    progress_label: &str,
    artifacts: Vec<ExtensionArtifact>,
) -> Result<ExtensionTask, String> {
    update_task(task_id, |task| {
        task.state = "running".to_string();
        if task.started_at.trim().is_empty() {
            task.started_at = now_string();
        }
        task.finished_at.clear();
        task.error.clear();
        task.progress = ExtensionTaskProgress {
            label: if progress_label.trim().is_empty() {
                "Running".to_string()
            } else {
                progress_label.trim().to_string()
            },
            current: 0,
            total: 0,
        };
        task.artifacts = artifacts;
    })
}

pub fn mark_task_succeeded(
    task_id: &str,
    artifacts: Vec<ExtensionArtifact>,
    progress_label: &str,
) -> Result<ExtensionTask, String> {
    update_task(task_id, |task| {
        task.state = "succeeded".to_string();
        task.finished_at = now_string();
        task.progress = ExtensionTaskProgress {
            label: if progress_label.trim().is_empty() {
                "Completed".to_string()
            } else {
                progress_label.trim().to_string()
            },
            current: 1,
            total: 1,
        };
        task.artifacts = artifacts;
        task.error.clear();
    })
}

pub fn mark_task_failed(task_id: &str, error: &str) -> Result<ExtensionTask, String> {
    update_task(task_id, |task| {
        task.state = "failed".to_string();
        task.finished_at = now_string();
        task.progress.label = "Failed".to_string();
        task.error = error.to_string();
    })
}

pub fn mark_task_cancelled(task_id: &str) -> Result<ExtensionTask, String> {
    update_task(task_id, |task| {
        task.state = "cancelled".to_string();
        task.finished_at = now_string();
        task.progress.label = "Cancelled".to_string();
        task.error.clear();
    })
}

fn normalize_task_artifact(
    task: &ExtensionTask,
    patch: &ExtensionTaskArtifactPatch,
    index: usize,
) -> Option<ExtensionArtifact> {
    let path = patch.path.trim();
    if path.is_empty() {
        return None;
    }
    Some(ExtensionArtifact {
        id: if patch.id.trim().is_empty() {
            format!("artifact:{}", index + 1)
        } else {
            patch.id.trim().to_string()
        },
        extension_id: task.extension_id.clone(),
        task_id: task.id.clone(),
        capability: task.capability.clone(),
        kind: patch.kind.trim().to_string(),
        media_type: patch.media_type.trim().to_string(),
        path: path.to_string(),
        source_path: if patch.source_path.trim().is_empty() {
            task.target.path.clone()
        } else {
            patch.source_path.trim().to_string()
        },
        source_hash: patch.source_hash.trim().to_string(),
        created_at: if patch.created_at.trim().is_empty() {
            now_string()
        } else {
            patch.created_at.trim().to_string()
        },
    })
}

fn apply_task_update_in_dir(
    tasks_root: &Path,
    extension_id: &str,
    task_id: &str,
    patch: ExtensionTaskUpdatePatch,
) -> Result<ExtensionTask, String> {
    let task = list_tasks_from_dir(tasks_root)?
        .into_iter()
        .find(|task| task.id == task_id)
        .ok_or_else(|| format!("Extension task not found: {task_id}"))?;
    if task.extension_id.trim() != extension_id.trim() {
        return Err(format!(
            "Extension {} is not allowed to update task {}",
            extension_id, task_id
        ));
    }
    let terminal_task = is_terminal_task_state(&task.state);
    let next_state = normalize_task_state(&patch.state);
    let next_artifacts = if patch.artifacts.is_empty() {
        None
    } else {
        Some(
            patch.artifacts
                .iter()
                .enumerate()
                .filter_map(|(index, artifact)| normalize_task_artifact(&task, artifact, index))
                .collect::<Vec<_>>(),
        )
    };
    update_task_in_dir(tasks_root, task_id, |task| {
        if terminal_task {
            return;
        }

        if let Some(state) = next_state {
            match state {
                "queued" => {
                    task.state = "queued".to_string();
                    task.started_at.clear();
                    task.finished_at.clear();
                    if task.progress.label.trim().is_empty() {
                        task.progress.label = "Queued".to_string();
                    }
                    task.error.clear();
                }
                "running" => {
                    task.state = "running".to_string();
                    if task.started_at.trim().is_empty() {
                        task.started_at = now_string();
                    }
                    task.finished_at.clear();
                    if task.progress.label.trim().is_empty() {
                        task.progress.label = "Running".to_string();
                    }
                    task.error.clear();
                }
                "succeeded" => {
                    task.state = "succeeded".to_string();
                    if task.started_at.trim().is_empty() {
                        task.started_at = now_string();
                    }
                    task.finished_at = now_string();
                    if task.progress.label.trim().is_empty() {
                        task.progress.label = "Completed".to_string();
                    }
                    if patch.progress_current.is_none() && patch.progress_total.is_none() {
                        task.progress.current = 1;
                        task.progress.total = 1;
                    }
                    task.error.clear();
                }
                "failed" => {
                    task.state = "failed".to_string();
                    if task.started_at.trim().is_empty() {
                        task.started_at = now_string();
                    }
                    task.finished_at = now_string();
                    if task.progress.label.trim().is_empty() {
                        task.progress.label = "Failed".to_string();
                    }
                }
                "cancelled" => {
                    task.state = "cancelled".to_string();
                    if task.started_at.trim().is_empty() {
                        task.started_at = now_string();
                    }
                    task.finished_at = now_string();
                    if task.progress.label.trim().is_empty() {
                        task.progress.label = "Cancelled".to_string();
                    }
                    task.error.clear();
                }
                _ => {}
            }
        }

        if !patch.progress_label.trim().is_empty() {
            task.progress.label = patch.progress_label.trim().to_string();
        }
        if let Some(current) = patch.progress_current {
            task.progress.current = current;
        }
        if let Some(total) = patch.progress_total {
            task.progress.total = total;
        }
        if !patch.error.trim().is_empty() {
            task.error = patch.error.trim().to_string();
        }
        if let Some(artifacts) = &next_artifacts {
            task.artifacts = artifacts.clone();
        }
    })
}

#[cfg_attr(test, allow(dead_code))]
pub fn apply_task_update(
    extension_id: &str,
    task_id: &str,
    patch: ExtensionTaskUpdatePatch,
) -> Result<ExtensionTask, String> {
    apply_task_update_in_dir(&tasks_dir()?, extension_id, task_id, patch)
}

impl ExtensionTaskRuntimeState {
    #[cfg(not(test))]
    pub fn bind_app_handle(&self, app: tauri::AppHandle) {
        if let Ok(mut handle) = self.app_handle.lock() {
            *handle = Some(app);
        }
    }

    #[cfg(test)]
    pub fn bind_app_handle(&self, _app: tauri::AppHandle) {}

    #[cfg(not(test))]
    pub fn emit_task_changed(&self, task: &ExtensionTask) {
        emit_task_changed(task, &self.app_handle);
    }

    #[cfg(test)]
    pub fn emit_task_changed(&self, _task: &ExtensionTask) {}

    #[cfg_attr(test, allow(dead_code))]
    pub fn register_pid(&self, task_id: &str, pid: u32) -> Result<(), String> {
        let normalized_task_id = task_id.trim();
        if normalized_task_id.is_empty() || pid == 0 {
            return Ok(());
        }
        let mut guard = self
            .running_pids
            .lock()
            .map_err(|_| "Extension task runtime state is unavailable".to_string())?;
        guard.insert(normalized_task_id.to_string(), pid);
        Ok(())
    }

    pub fn unregister_pid(&self, task_id: &str) -> Result<Option<u32>, String> {
        let mut guard = self
            .running_pids
            .lock()
            .map_err(|_| "Extension task runtime state is unavailable".to_string())?;
        Ok(guard.remove(task_id))
    }

    pub fn clear_pid_if_terminal(&self, task: &ExtensionTask) -> Result<(), String> {
        if is_terminal_task_state(&task.state) {
            let _ = self.unregister_pid(&task.id)?;
        }
        Ok(())
    }
}

fn kill_pid(pid: u32) -> Result<(), String> {
    #[cfg(unix)]
    {
        let result = unsafe { libc::kill(pid as i32, libc::SIGTERM) };
        if result == 0 {
            return Ok(());
        }
        return Err(std::io::Error::last_os_error().to_string());
    }

    #[cfg(windows)]
    {
        let status = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status()
            .map_err(|error| error.to_string())?;
        if status.success() {
            return Ok(());
        }
        return Err(format!("taskkill failed: {status}"));
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionTaskGetParams {
    #[serde(default)]
    pub task_id: String,
}

#[tauri::command]
pub async fn extension_task_list() -> Result<Vec<ExtensionTask>, String> {
    list_tasks()
}

#[tauri::command]
pub async fn extension_task_get(params: ExtensionTaskGetParams) -> Result<ExtensionTask, String> {
    get_task(&params.task_id)
}

#[tauri::command]
pub async fn extension_task_cancel(
    params: ExtensionTaskGetParams,
    runtime_state: tauri::State<'_, ExtensionTaskRuntimeState>,
) -> Result<ExtensionTask, String> {
    if let Some(pid) = runtime_state.unregister_pid(&params.task_id)? {
        let _ = kill_pid(pid);
    }
    let task = mark_task_cancelled(&params.task_id)?;
    runtime_state.emit_task_changed(&task);
    Ok(task)
}

#[cfg(test)]
mod tests {
    use super::{
        apply_task_update_in_dir, create_task_in_dir, list_tasks_from_dir, recover_interrupted_tasks_in_dir,
        update_task_in_dir, ExtensionTaskArtifactPatch, ExtensionTaskRuntimeState, ExtensionTaskTarget,
        ExtensionTaskUpdatePatch,
    };
    use std::fs;

    fn temp_tasks_root(prefix: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("{prefix}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("temp tasks root");
        root
    }

    #[test]
    fn task_state_transitions_are_persisted() {
        let root = temp_tasks_root("scribeflow-extension-tasks-state");
        let task = create_task_in_dir(
            &root,
            "pdfmathtranslate",
            "pdf.translate",
            "scribeflow.pdf.translate",
            ExtensionTaskTarget {
                kind: "referencePdf".to_string(),
                reference_id: "ref-1".to_string(),
                path: "/tmp/paper.pdf".to_string(),
            },
            serde_json::json!({"targetLanguage": "zh"}),
        )
        .expect("create task");
        let running = update_task_in_dir(&root, &task.id, |task| {
            task.state = "running".to_string();
        })
        .expect("running");
        assert_eq!(running.state, "running");
        let failed = update_task_in_dir(&root, &task.id, |task| {
            task.state = "failed".to_string();
            task.error = "boom".to_string();
        })
        .expect("failed");
        assert_eq!(failed.error, "boom");
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn list_tasks_recovers_interrupted_running_tasks() {
        let root = temp_tasks_root("scribeflow-extension-tasks-recover");
        let task = create_task_in_dir(
            &root,
            "pdfmathtranslate",
            "pdf.translate",
            "scribeflow.pdf.translate",
            ExtensionTaskTarget {
                kind: "referencePdf".to_string(),
                reference_id: "ref-2".to_string(),
                path: "/tmp/paper.pdf".to_string(),
            },
            serde_json::json!({}),
        )
        .expect("create task");
        update_task_in_dir(&root, &task.id, |task| {
            task.state = "running".to_string();
        })
        .expect("running");
        let listed = list_tasks_from_dir(&root).expect("tasks");
        let still_running = listed
            .iter()
            .find(|item| item.id == task.id)
            .expect("listed task");
        assert_eq!(still_running.state, "running");

        let tasks = recover_interrupted_tasks_in_dir(&root).expect("tasks");
        let recovered = tasks.iter().find(|item| item.id == task.id).expect("task");
        assert_eq!(recovered.state, "failed");
        assert_eq!(recovered.error, "Interrupted by application shutdown");
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn queued_task_hint_resets_runtime_timestamps() {
        let root = temp_tasks_root("scribeflow-extension-tasks-queued");
        let task = create_task_in_dir(
            &root,
            "pdfmathtranslate",
            "pdf.translate",
            "scribeflow.pdf.translate",
            ExtensionTaskTarget {
                kind: "referencePdf".to_string(),
                reference_id: "ref-3".to_string(),
                path: "/tmp/paper.pdf".to_string(),
            },
            serde_json::json!({}),
        )
        .expect("create task");

        update_task_in_dir(&root, &task.id, |task| {
            task.state = "running".to_string();
            task.started_at = "2026-05-01T00:00:00Z".to_string();
        })
        .expect("running");

        let queued = super::update_task_in_dir(&root, &task.id, |task| {
            task.state = "queued".to_string();
            task.started_at.clear();
            task.finished_at.clear();
            task.progress.label = "Translation queued".to_string();
        })
        .expect("queued");

        assert_eq!(queued.state, "queued");
        assert!(queued.started_at.is_empty());
        assert!(queued.finished_at.is_empty());
        assert_eq!(queued.progress.label, "Translation queued");
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn runtime_state_registers_and_unregisters_spawned_pid() {
        let runtime = ExtensionTaskRuntimeState::default();
        runtime
            .register_pid("task-1", 4242)
            .expect("register pid");

        let first = runtime.unregister_pid("task-1").expect("unregister pid");
        assert_eq!(first, Some(4242));

        let second = runtime
            .unregister_pid("task-1")
            .expect("unregister missing pid");
        assert_eq!(second, None);
    }

    #[test]
    fn apply_task_update_merges_running_progress_and_artifacts() {
        let root = temp_tasks_root("scribeflow-extension-tasks-update");
        let task = create_task_in_dir(
            &root,
            "example-pdf-extension",
            "pdf.translate",
            "scribeflow.pdf.translate",
            ExtensionTaskTarget {
                kind: "referencePdf".to_string(),
                reference_id: "ref-4".to_string(),
                path: "/tmp/paper.pdf".to_string(),
            },
            serde_json::json!({}),
        )
        .expect("create task");

        let updated = super::update_task_in_dir(&root, &task.id, |task| {
            task.state = "running".to_string();
            task.started_at = "2026-05-01T00:00:00Z".to_string();
        })
        .expect("running");
        assert_eq!(updated.state, "running");

        let result = apply_task_update_in_dir(
            &root,
            "example-pdf-extension",
            &task.id,
            ExtensionTaskUpdatePatch {
                task_id: task.id.clone(),
                state: "running".to_string(),
                progress_label: "Spawned process 4242".to_string(),
                progress_current: Some(1),
                progress_total: Some(3),
                error: String::new(),
                artifacts: vec![ExtensionTaskArtifactPatch {
                    id: "artifact-1".to_string(),
                    kind: "log".to_string(),
                    media_type: "text/plain".to_string(),
                    path: "/tmp/output.log".to_string(),
                    source_path: "/tmp/paper.pdf".to_string(),
                    source_hash: String::new(),
                    created_at: String::new(),
                }],
            },
        )
        .expect("apply task update");

        assert_eq!(result.state, "running");
        assert_eq!(result.progress.label, "Spawned process 4242");
        assert_eq!(result.progress.current, 1);
        assert_eq!(result.progress.total, 3);
        assert_eq!(result.artifacts.len(), 1);
        assert_eq!(result.artifacts[0].path, "/tmp/output.log");
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn apply_task_update_does_not_reopen_terminal_task() {
        let root = temp_tasks_root("scribeflow-extension-tasks-terminal-guard");
        let task = create_task_in_dir(
            &root,
            "example-pdf-extension",
            "pdf.translate",
            "scribeflow.pdf.translate",
            ExtensionTaskTarget {
                kind: "referencePdf".to_string(),
                reference_id: "ref-5".to_string(),
                path: "/tmp/paper.pdf".to_string(),
            },
            serde_json::json!({}),
        )
        .expect("create task");

        let cancelled = super::update_task_in_dir(&root, &task.id, |task| {
            task.state = "cancelled".to_string();
            task.finished_at = "2026-05-01T01:00:00Z".to_string();
            task.progress.label = "Cancelled".to_string();
        })
        .expect("cancelled");
        assert_eq!(cancelled.state, "cancelled");

        let updated = apply_task_update_in_dir(
            &root,
            "example-pdf-extension",
            &task.id,
            ExtensionTaskUpdatePatch {
                task_id: task.id.clone(),
                state: "running".to_string(),
                progress_label: "Late update".to_string(),
                progress_current: Some(2),
                progress_total: Some(3),
                error: String::new(),
                artifacts: Vec::new(),
            },
        )
        .expect("late update ignored");

        assert_eq!(updated.state, "cancelled");
        assert_eq!(updated.progress.label, "Cancelled");
        assert_eq!(updated.progress.current, 0);
        assert_eq!(updated.progress.total, 0);
        assert_eq!(updated.finished_at, "2026-05-01T01:00:00Z");
        fs::remove_dir_all(root).ok();
    }
}
