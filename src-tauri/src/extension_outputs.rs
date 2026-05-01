use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionCapabilityOutput {
    #[serde(default)]
    pub id: String,
    #[serde(rename = "type", default)]
    pub output_type: String,
    #[serde(default)]
    pub media_type: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub html: String,
}
