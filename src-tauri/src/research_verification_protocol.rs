use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResearchVerificationRecord {
    pub id: String,
    pub task_id: String,
    pub artifact_id: String,
    pub kind: String,
    pub status: String,
    pub summary: String,
    pub details: Vec<String>,
    pub blocking: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResearchVerificationRunParams {
    pub workspace_path: String,
    #[serde(default)]
    pub task_id: String,
    #[serde(default)]
    pub artifact_id: String,
    #[serde(default)]
    pub artifact: Value,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub citation_text: String,
    #[serde(default)]
    pub reference: Value,
    #[serde(default)]
    pub references: Vec<Value>,
    #[serde(default)]
    pub citation_style: String,
    #[serde(default)]
    pub file_path: String,
    #[serde(default)]
    pub created_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResearchVerificationRunResponse {
    pub verification: ResearchVerificationRecord,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResearchVerificationListParams {
    pub workspace_path: String,
    #[serde(default)]
    pub task_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResearchVerificationListResponse {
    pub verifications: Vec<ResearchVerificationRecord>,
}
