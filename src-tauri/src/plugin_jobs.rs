use crate::app_dirs;
use crate::plugin_artifacts::PluginArtifact;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

const JOBS_FILENAME: &str = "jobs.json";

#[derive(Clone, Default)]
pub struct PluginJobRuntimeState {
    running_pids: Arc<Mutex<HashMap<String, u32>>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginJobTarget {
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub reference_id: String,
    #[serde(default)]
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginJobProgress {
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub current: u32,
    #[serde(default)]
    pub total: u32,
}

impl Default for PluginJobProgress {
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
pub struct PluginJob {
    pub id: String,
    pub plugin_id: String,
    pub capability: String,
    pub state: String,
    pub created_at: String,
    pub started_at: String,
    pub finished_at: String,
    pub target: PluginJobTarget,
    pub settings: Value,
    pub progress: PluginJobProgress,
    pub artifacts: Vec<PluginArtifact>,
    pub error: String,
    pub log_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginJobsFile {
    #[serde(default = "default_jobs_version")]
    version: u32,
    #[serde(default)]
    jobs: Vec<PluginJob>,
}

impl Default for PluginJobsFile {
    fn default() -> Self {
        Self {
            version: default_jobs_version(),
            jobs: Vec::new(),
        }
    }
}

fn default_jobs_version() -> u32 {
    1
}

fn now_string() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn jobs_dir() -> Result<PathBuf, String> {
    app_dirs::plugin_jobs_dir()
}

fn job_dir_in(jobs_root: &Path, job_id: &str) -> Result<PathBuf, String> {
    let dir = jobs_root.join(job_id);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    }
    Ok(dir)
}

fn jobs_file_path_in(jobs_root: &Path) -> PathBuf {
    jobs_root.join(JOBS_FILENAME)
}

fn read_jobs_file_raw_from(jobs_root: &Path) -> Result<PluginJobsFile, String> {
    let path = jobs_file_path_in(jobs_root);
    if !path.exists() {
        return Ok(PluginJobsFile::default());
    }
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str::<PluginJobsFile>(&content)
        .map_err(|error| format!("Failed to parse plugin jobs: {error}"))
}

fn write_jobs_file_to(jobs_root: &Path, file: &PluginJobsFile) -> Result<(), String> {
    let path = jobs_file_path_in(jobs_root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let serialized = serde_json::to_string_pretty(file)
        .map_err(|error| format!("Failed to serialize plugin jobs: {error}"))?;
    fs::write(path, serialized).map_err(|error| error.to_string())
}

fn recover_interrupted_jobs(mut file: PluginJobsFile) -> PluginJobsFile {
    let now = now_string();
    for job in &mut file.jobs {
        if matches!(job.state.as_str(), "queued" | "running") {
            job.state = "failed".to_string();
            job.finished_at = now.clone();
            job.error = "Interrupted by application shutdown".to_string();
        }
    }
    file
}

pub fn list_jobs() -> Result<Vec<PluginJob>, String> {
    list_jobs_from_dir(&jobs_dir()?)
}

fn list_jobs_from_dir(jobs_root: &Path) -> Result<Vec<PluginJob>, String> {
    let file = read_jobs_file_raw_from(jobs_root)?;
    Ok(file.jobs)
}

pub fn recover_interrupted_jobs_on_startup() -> Result<Vec<PluginJob>, String> {
    recover_interrupted_jobs_in_dir(&jobs_dir()?)
}

fn recover_interrupted_jobs_in_dir(jobs_root: &Path) -> Result<Vec<PluginJob>, String> {
    let file = recover_interrupted_jobs(read_jobs_file_raw_from(jobs_root)?);
    write_jobs_file_to(jobs_root, &file)?;
    Ok(file.jobs)
}

pub fn get_job(job_id: &str) -> Result<PluginJob, String> {
    list_jobs()?
        .into_iter()
        .find(|job| job.id == job_id)
        .ok_or_else(|| format!("Plugin job not found: {job_id}"))
}

pub fn create_job(
    plugin_id: &str,
    capability: &str,
    target: PluginJobTarget,
    settings: Value,
) -> Result<PluginJob, String> {
    create_job_in_dir(&jobs_dir()?, plugin_id, capability, target, settings)
}

fn create_job_in_dir(
    jobs_root: &Path,
    plugin_id: &str,
    capability: &str,
    target: PluginJobTarget,
    settings: Value,
) -> Result<PluginJob, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let log_path = job_dir_in(jobs_root, &id)?
        .join("job.log")
        .to_string_lossy()
        .to_string();
    let now = now_string();
    let job = PluginJob {
        id: id.clone(),
        plugin_id: plugin_id.to_string(),
        capability: capability.to_string(),
        state: "queued".to_string(),
        created_at: now,
        started_at: String::new(),
        finished_at: String::new(),
        target,
        settings,
        progress: PluginJobProgress {
            label: "Queued".to_string(),
            current: 0,
            total: 0,
        },
        artifacts: Vec::new(),
        error: String::new(),
        log_path,
    };

    let mut file = read_jobs_file_raw_from(jobs_root)?;
    file.jobs.insert(0, job.clone());
    write_jobs_file_to(jobs_root, &file)?;
    Ok(job)
}

pub fn update_job<F>(job_id: &str, update: F) -> Result<PluginJob, String>
where
    F: FnOnce(&mut PluginJob),
{
    update_job_in_dir(&jobs_dir()?, job_id, update)
}

fn update_job_in_dir<F>(jobs_root: &Path, job_id: &str, update: F) -> Result<PluginJob, String>
where
    F: FnOnce(&mut PluginJob),
{
    let mut file = read_jobs_file_raw_from(jobs_root)?;
    let Some(job) = file.jobs.iter_mut().find(|job| job.id == job_id) else {
        return Err(format!("Plugin job not found: {job_id}"));
    };
    update(job);
    let updated = job.clone();
    write_jobs_file_to(jobs_root, &file)?;
    Ok(updated)
}

pub fn mark_job_running(job_id: &str) -> Result<PluginJob, String> {
    update_job(job_id, |job| {
        job.state = "running".to_string();
        job.started_at = now_string();
        job.progress = PluginJobProgress {
            label: "Running".to_string(),
            current: 0,
            total: 0,
        };
    })
}

pub fn mark_job_succeeded(
    job_id: &str,
    artifacts: Vec<PluginArtifact>,
) -> Result<PluginJob, String> {
    update_job(job_id, |job| {
        job.state = "succeeded".to_string();
        job.finished_at = now_string();
        job.progress = PluginJobProgress {
            label: "Completed".to_string(),
            current: 1,
            total: 1,
        };
        job.artifacts = artifacts;
        job.error.clear();
    })
}

pub fn mark_job_failed(job_id: &str, error: &str) -> Result<PluginJob, String> {
    update_job(job_id, |job| {
        if job.state == "cancelled" {
            return;
        }
        job.state = "failed".to_string();
        job.finished_at = now_string();
        job.progress.label = "Failed".to_string();
        job.error = error.to_string();
    })
}

pub fn mark_job_cancelled(job_id: &str) -> Result<PluginJob, String> {
    update_job(job_id, |job| {
        job.state = "cancelled".to_string();
        job.finished_at = now_string();
        job.progress.label = "Cancelled".to_string();
        job.error.clear();
    })
}

impl PluginJobRuntimeState {
    pub fn register_pid(&self, job_id: &str, pid: u32) -> Result<(), String> {
        let mut guard = self
            .running_pids
            .lock()
            .map_err(|_| "Plugin job runtime state is unavailable".to_string())?;
        guard.insert(job_id.to_string(), pid);
        Ok(())
    }

    pub fn unregister_pid(&self, job_id: &str) -> Result<Option<u32>, String> {
        let mut guard = self
            .running_pids
            .lock()
            .map_err(|_| "Plugin job runtime state is unavailable".to_string())?;
        Ok(guard.remove(job_id))
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
pub struct PluginJobGetParams {
    #[serde(default)]
    pub job_id: String,
}

#[tauri::command]
pub async fn plugin_job_list() -> Result<Vec<PluginJob>, String> {
    list_jobs()
}

#[tauri::command]
pub async fn plugin_job_get(params: PluginJobGetParams) -> Result<PluginJob, String> {
    get_job(&params.job_id)
}

#[tauri::command]
pub async fn plugin_job_cancel(
    params: PluginJobGetParams,
    runtime_state: tauri::State<'_, PluginJobRuntimeState>,
) -> Result<PluginJob, String> {
    if let Some(pid) = runtime_state.unregister_pid(&params.job_id)? {
        let _ = kill_pid(pid);
    }
    mark_job_cancelled(&params.job_id)
}

#[cfg(test)]
mod tests {
    use super::{
        create_job_in_dir, list_jobs_from_dir, recover_interrupted_jobs_in_dir, update_job_in_dir,
        PluginJobTarget,
    };
    use std::fs;

    fn temp_jobs_root(prefix: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("{prefix}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("temp jobs root");
        root
    }

    #[test]
    fn job_state_transitions_are_persisted() {
        let root = temp_jobs_root("scribeflow-plugin-jobs-state");
        let job = create_job_in_dir(
            &root,
            "pdfmathtranslate",
            "pdf.translate",
            PluginJobTarget {
                kind: "referencePdf".to_string(),
                reference_id: "ref-1".to_string(),
                path: "/tmp/paper.pdf".to_string(),
            },
            serde_json::json!({"targetLanguage": "zh"}),
        )
        .expect("create job");
        let running = update_job_in_dir(&root, &job.id, |job| {
            job.state = "running".to_string();
        })
        .expect("running");
        assert_eq!(running.state, "running");
        let failed = update_job_in_dir(&root, &job.id, |job| {
            job.state = "failed".to_string();
            job.error = "boom".to_string();
        })
        .expect("failed");
        assert_eq!(failed.error, "boom");
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn list_jobs_recovers_interrupted_running_jobs() {
        let root = temp_jobs_root("scribeflow-plugin-jobs-recover");
        let job = create_job_in_dir(
            &root,
            "pdfmathtranslate",
            "pdf.translate",
            PluginJobTarget {
                kind: "referencePdf".to_string(),
                reference_id: "ref-2".to_string(),
                path: "/tmp/paper.pdf".to_string(),
            },
            serde_json::json!({}),
        )
        .expect("create job");
        update_job_in_dir(&root, &job.id, |job| {
            job.state = "running".to_string();
        })
        .expect("running");
        let listed = list_jobs_from_dir(&root).expect("jobs");
        let still_running = listed
            .iter()
            .find(|item| item.id == job.id)
            .expect("listed job");
        assert_eq!(still_running.state, "running");

        let jobs = recover_interrupted_jobs_in_dir(&root).expect("jobs");
        let recovered = jobs.iter().find(|item| item.id == job.id).expect("job");
        assert_eq!(recovered.state, "failed");
        assert_eq!(recovered.error, "Interrupted by application shutdown");
        fs::remove_dir_all(root).ok();
    }
}
