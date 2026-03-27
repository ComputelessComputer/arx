use keyring::Entry;
use serde_json::Value;

const KEYRING_SERVICE: &str = "com.johnjeong.arx.mail-auth";

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

