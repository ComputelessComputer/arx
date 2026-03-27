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

pub fn store_account_secret(account_id: &str, payload: &Value) -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, account_id).map_err(|err| err.to_string())?;
    entry
        .set_password(&payload.to_string())
        .map_err(|err| err.to_string())
}

pub fn read_account_secret(account_id: &str) -> Result<String, String> {
    let entry = Entry::new(KEYRING_SERVICE, account_id).map_err(|err| err.to_string())?;
    entry.get_password().map_err(|err| err.to_string())
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
        Err(Error::NoEntry) | Err(Error::NoStorageAccess(_)) => {
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
