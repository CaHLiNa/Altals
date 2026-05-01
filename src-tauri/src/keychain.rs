#[cfg(test)]
use std::collections::BTreeMap;
#[cfg(test)]
use std::sync::{Mutex, OnceLock};

#[cfg(not(test))]
pub(crate) const SERVICE_NAME: &str = "ScribeFlow";
const ALLOWED_KEYCHAIN_KEYS: &[&str] = &["zotero-api-key"];

#[cfg(test)]
fn test_keychain_store() -> &'static Mutex<BTreeMap<String, String>> {
    static STORE: OnceLock<Mutex<BTreeMap<String, String>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(BTreeMap::new()))
}

fn ensure_allowed_key(key: &str) -> Result<(), String> {
    if ALLOWED_KEYCHAIN_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(format!("Keychain key is not allowed: {key}"))
    }
}

#[cfg(not(test))]
pub(crate) fn keychain_set_entry(key: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE_NAME, key).map_err(|e| e.to_string())?;
    entry.set_password(value).map_err(|e| e.to_string())
}

#[cfg(test)]
pub(crate) fn keychain_set_entry(key: &str, value: &str) -> Result<(), String> {
    let mut store = test_keychain_store()
        .lock()
        .map_err(|_| "Failed to access test keychain store".to_string())?;
    store.insert(key.to_string(), value.to_string());
    Ok(())
}

#[cfg(not(test))]
pub(crate) fn keychain_get_entry(key: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE_NAME, key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(test)]
pub(crate) fn keychain_get_entry(key: &str) -> Result<Option<String>, String> {
    let store = test_keychain_store()
        .lock()
        .map_err(|_| "Failed to access test keychain store".to_string())?;
    Ok(store.get(key).cloned())
}

#[cfg(not(test))]
pub(crate) fn keychain_delete_entry(key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE_NAME, key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(test)]
pub(crate) fn keychain_delete_entry(key: &str) -> Result<(), String> {
    let mut store = test_keychain_store()
        .lock()
        .map_err(|_| "Failed to access test keychain store".to_string())?;
    store.remove(key);
    Ok(())
}

#[tauri::command]
pub fn keychain_set(key: String, value: String) -> Result<(), String> {
    ensure_allowed_key(&key)?;
    keychain_set_entry(&key, &value)
}

#[tauri::command]
pub fn keychain_get(key: String) -> Result<Option<String>, String> {
    ensure_allowed_key(&key)?;
    keychain_get_entry(&key)
}

#[tauri::command]
pub fn keychain_delete(key: String) -> Result<(), String> {
    ensure_allowed_key(&key)?;
    keychain_delete_entry(&key)
}
