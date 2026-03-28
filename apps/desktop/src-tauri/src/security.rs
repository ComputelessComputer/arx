use crate::models::{AiProvider, AiSettings};
use keyring::Entry;
use keyring::Error;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const KEYRING_SERVICE: &str = "com.johnjeong.arx.mail-auth";
const AI_SETTINGS_KEY: &str = "ai-settings";
const AI_SETTINGS_FILE: &str = "ai-settings.json";

fn should_fallback_to_ai_settings_file(error: &Error) -> bool {
    matches!(error, Error::NoEntry | Error::NoStorageAccess(_))
        || error
            .to_string()
            .contains("No matching entry found in secure storage")
}

pub fn is_missing_secure_storage_error(message: &str) -> bool {
    message.contains("No matching entry found in secure storage")
}

pub fn store_account_secret(account_id: &str, payload: &Value) -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, account_id).map_err(|err| err.to_string())?;
    entry
        .set_password(&payload.to_string())
        .map_err(|err| err.to_string())
}

pub fn read_account_secret(account_id: &str) -> Result<String, String> {
    let entry = Entry::new(KEYRING_SERVICE, account_id).map_err(|err| err.to_string())?;
    entry.get_password().map_err(|err| {
        if should_fallback_to_ai_settings_file(&err) {
            "No matching entry found in secure storage".to_string()
        } else {
            err.to_string()
        }
    })
}

pub fn delete_account_secret(account_id: &str) -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, account_id).map_err(|err| err.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

fn ai_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|err| err.to_string())?;
    Ok(app_data_dir.join(AI_SETTINGS_FILE))
}

pub fn store_ai_settings(app: &AppHandle, settings: &AiSettings) -> Result<(), String> {
    let payload = serde_json::to_string(settings).map_err(|err| err.to_string())?;
    let path = ai_settings_path(app)?;
    fs::write(path, &payload).map_err(|err| err.to_string())?;

    let entry = Entry::new(KEYRING_SERVICE, AI_SETTINGS_KEY).map_err(|err| err.to_string())?;
    match entry.set_password(&payload) {
        Ok(()) | Err(Error::NoStorageAccess(_)) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

pub fn read_ai_settings(app: &AppHandle) -> Result<Option<AiSettings>, String> {
    let entry = Entry::new(KEYRING_SERVICE, AI_SETTINGS_KEY).map_err(|err| err.to_string())?;

    match entry.get_password() {
        Ok(payload) => serde_json::from_str(&payload)
            .map(Some)
            .map_err(|err| err.to_string()),
        Err(err) if should_fallback_to_ai_settings_file(&err) => {
            let path = ai_settings_path(app)?;
            if !path.exists() {
                return Ok(None);
            }

            let payload = fs::read_to_string(path).map_err(|err| err.to_string())?;
            serde_json::from_str(&payload)
                .map(Some)
                .map_err(|err| err.to_string())
        }
        Err(err) => Err(err.to_string()),
    }
}

pub fn default_ai_settings() -> AiSettings {
    AiSettings {
        provider: AiProvider::Openai,
        openai_api_key: String::new(),
        anthropic_api_key: String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug)]
    struct SecureStorageMissingEntry;

    impl std::fmt::Display for SecureStorageMissingEntry {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "No matching entry found in secure storage")
        }
    }

    impl std::error::Error for SecureStorageMissingEntry {}

    #[derive(Debug)]
    struct SecureStorageFailure;

    impl std::fmt::Display for SecureStorageFailure {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "Keychain is unavailable")
        }
    }

    impl std::error::Error for SecureStorageFailure {}

    #[test]
    fn falls_back_when_secure_storage_has_no_entry() {
        assert!(should_fallback_to_ai_settings_file(&Error::NoEntry));
    }

    #[test]
    fn falls_back_when_platform_error_matches_missing_entry_message() {
        let error = Error::PlatformFailure(Box::new(SecureStorageMissingEntry));

        assert!(should_fallback_to_ai_settings_file(&error));
    }

    #[test]
    fn does_not_fallback_for_other_platform_failures() {
        let error = Error::PlatformFailure(Box::new(SecureStorageFailure));

        assert!(!should_fallback_to_ai_settings_file(&error));
    }

    #[test]
    fn matches_missing_secure_storage_message() {
        assert!(is_missing_secure_storage_error("No matching entry found in secure storage"));
    }
}
