pub(crate) fn looks_like_secret_setting_key(key: &str) -> bool {
    let normalized = key.trim().to_ascii_lowercase();
    normalized.contains("apikey")
        || normalized.contains("api_key")
        || normalized.contains("token")
        || normalized.contains("secret")
        || normalized.contains("password")
}
