use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteModelDescriptor {
    pub id: String,
}

fn normalize_openai_models_base_url(value: &str) -> String {
    let trimmed = value.trim().trim_end_matches('/');
    trimmed
        .trim_end_matches("/responses")
        .trim_end_matches("/chat/completions")
        .trim_end_matches("/models")
        .trim_end_matches('/')
        .to_string()
}

#[tauri::command]
pub async fn model_sync_list_openai_models(
    base_url: String,
    api_key: String,
) -> Result<Vec<RemoteModelDescriptor>, String> {
    let normalized_base = normalize_openai_models_base_url(&base_url);
    if normalized_base.is_empty() {
        return Err("Missing provider base URL".into());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(format!("{}/models", normalized_base))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("User-Agent", "Altals/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        let summary = body.lines().next().unwrap_or("").trim();
        if summary.is_empty() {
            return Err(format!("HTTP error {}", status.as_u16()));
        }
        return Err(format!("HTTP error {}: {}", status.as_u16(), summary));
    }

    let payload: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let Some(entries) = payload.get("data").and_then(|value| value.as_array()) else {
        return Err("Provider did not return a standard models list".into());
    };

    let mut models = Vec::new();
    for entry in entries {
        let Some(id) = entry.get("id").and_then(|value| value.as_str()) else {
            continue;
        };
        let trimmed = id.trim();
        if trimmed.is_empty() {
            continue;
        }
        models.push(RemoteModelDescriptor {
            id: trimmed.to_string(),
        });
    }

    Ok(models)
}
