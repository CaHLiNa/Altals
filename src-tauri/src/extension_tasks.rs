use crate::app_dirs;
use crate::extension_artifacts::ExtensionArtifact;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

const TASKS_FILENAME: &str = "tasks.json";

#[derive(Clone, Default)]
pub struct ExtensionTaskRuntimeState {
    running_pids: Arc<Mutex<HashMap<String, u32>>>,
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

pub fn create_task(
    extension_id: &str,
    capability: &str,
    target: ExtensionTaskTarget,
    settings: Value,
) -> Result<ExtensionTask, String> {
    create_task_in_dir(&tasks_dir()?, extension_id, capability, target, settings)
}

fn create_task_in_dir(
    tasks_root: &Path,
    extension_id: &str,
    capability: &str,
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
        task.progress = ExtensionTaskProgress {
            label: "Running".to_string(),
            current: 0,
            total: 0,
        };
    })
}

pub fn mark_task_succeeded(
    task_id: &str,
    artifacts: Vec<ExtensionArtifact>,
) -> Result<ExtensionTask, String> {
    update_task(task_id, |task| {
        task.state = "succeeded".to_string();
        task.finished_at = now_string();
        task.progress = ExtensionTaskProgress {
            label: "Completed".to_string(),
            current: 1,
            total: 1,
        };
        task.artifacts = artifacts;
        task.error.clear();
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

impl ExtensionTaskRuntimeState {
    pub fn unregister_pid(&self, task_id: &str) -> Result<Option<u32>, String> {
        let mut guard = self
            .running_pids
            .lock()
            .map_err(|_| "Extension task runtime state is unavailable".to_string())?;
        Ok(guard.remove(task_id))
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
    mark_task_cancelled(&params.task_id)
}

#[cfg(test)]
mod tests {
    use super::{
        create_task_in_dir, list_tasks_from_dir, recover_interrupted_tasks_in_dir,
        update_task_in_dir, ExtensionTaskTarget,
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
}
