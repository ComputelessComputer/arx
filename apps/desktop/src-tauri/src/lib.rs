mod ai;
mod models;
mod provider;
mod security;
mod store;

use ai::{build_reply_draft, build_suggestion_batch, rewrite_draft_text};
use models::{
    ActionRequest, AiSettings, AppSnapshot, ConnectAccountInput, DraftDocument, DraftRewriteTone,
    MailAccount, ThreadDetail,
};
use provider::{adapter_for, MailProviderAdapter};
use store::Store;
use tauri::AppHandle;

fn app_store(app: &AppHandle) -> Result<Store, String> {
    let store = Store::from_app(app)?;
    store.init()?;
    Ok(store)
}

fn load_account_adapter(account: &MailAccount) -> Box<dyn MailProviderAdapter> {
    adapter_for(&account.provider)
}

#[tauri::command]
fn bootstrap_app(app: AppHandle) -> Result<AppSnapshot, String> {
    let store = app_store(&app)?;
    store.bootstrap_snapshot()
}

#[tauri::command]
fn load_ai_settings(app: AppHandle) -> Result<AiSettings, String> {
    Ok(security::read_ai_settings(&app)?.unwrap_or_else(security::default_ai_settings))
}

#[tauri::command]
fn save_ai_settings(app: AppHandle, settings: AiSettings) -> Result<AiSettings, String> {
    security::store_ai_settings(&app, &settings)?;
    Ok(settings)
}

#[tauri::command]
fn connect_account(app: AppHandle, input: ConnectAccountInput) -> Result<MailAccount, String> {
    let store = app_store(&app)?;
    let adapter = adapter_for(&input.provider);
    let connection = adapter.connect(&store, &input)?;
    let delta = adapter.sync_delta(&store, &connection.account, None)?;
    store.save_sync_delta(
        &connection.account.id,
        &delta.mailboxes,
        &delta.threads,
        &delta.messages,
        &delta.next_cursor,
    )?;
    Ok(connection.account)
}

#[tauri::command]
fn sync_account(app: AppHandle, account_id: String) -> Result<(), String> {
    let store = app_store(&app)?;
    let account = store.get_account(&account_id)?;
    let adapter = load_account_adapter(&account);
    adapter.refresh_auth(&account)?;
    let cursor = store.get_sync_cursor(&account_id)?;
    let delta = adapter.sync_delta(&store, &account, cursor.as_deref())?;
    store.save_sync_delta(
        &account_id,
        &delta.mailboxes,
        &delta.threads,
        &delta.messages,
        &delta.next_cursor,
    )
}

#[tauri::command]
fn get_thread_detail(app: AppHandle, thread_id: String) -> Result<ThreadDetail, String> {
    let store = app_store(&app)?;
    let detail = store.get_thread_detail(&thread_id)?;
    let account = store.get_account(&detail.thread.account_id)?;
    let adapter = load_account_adapter(&account);
    adapter.get_thread(&store, &thread_id)
}

#[tauri::command]
fn prepare_reply_draft(app: AppHandle, thread_id: String) -> Result<DraftDocument, String> {
    let store = app_store(&app)?;
    if let Some(existing) = store.latest_draft_for_thread(&thread_id)? {
        return Ok(existing);
    }

    let detail = store.get_thread_detail(&thread_id)?;
    let account = store.get_account(&detail.thread.account_id)?;
    let draft = build_reply_draft(&account, &detail, None);
    store.save_draft(&draft)
}

#[tauri::command]
fn save_draft_command(app: AppHandle, draft: DraftDocument) -> Result<DraftDocument, String> {
    let store = app_store(&app)?;
    let account = store.get_account(&draft.account_id)?;
    let adapter = load_account_adapter(&account);
    adapter.save_draft(&store, &draft)
}

#[tauri::command]
fn send_draft_command(app: AppHandle, draft_id: String) -> Result<(), String> {
    let store = app_store(&app)?;
    let draft = store.get_draft(&draft_id)?;
    let account = store.get_account(&draft.account_id)?;
    let adapter = load_account_adapter(&account);
    adapter.send(&store, &draft)?;
    Ok(())
}

#[tauri::command]
fn generate_ai_suggestion_batch(app: AppHandle, account_id: Option<String>) -> Result<(), String> {
    let store = app_store(&app)?;
    let threads = store.list_threads(account_id.as_deref())?;
    let details = threads
        .iter()
        .map(|thread| store.get_thread_detail(&thread.id))
        .collect::<Result<Vec<_>, _>>()?;
    let account = account_id
        .as_deref()
        .map(|id| store.get_account(id))
        .transpose()?;
    let batch = build_suggestion_batch(account.as_ref(), &details);
    store.save_suggestion_batch(&batch)
}

#[tauri::command]
fn apply_actions_command(app: AppHandle, actions: Vec<ActionRequest>) -> Result<(), String> {
    let store = app_store(&app)?;
    for action in actions {
        let detail = store.get_thread_detail(&action.thread_id)?;
        let account = if let Some(account_id) = &action.account_id {
            store.get_account(account_id)?
        } else {
            store.get_account(&detail.thread.account_id)?
        };
        let adapter = load_account_adapter(&account);
        adapter.apply_actions(&store, &account, &[action])?;
    }
    Ok(())
}

#[tauri::command]
fn rewrite_draft_text_command(text: String, tone: DraftRewriteTone) -> Result<String, String> {
    Ok(rewrite_draft_text(&text, tone))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let store = app_store(&app.handle())?;
            store.init()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap_app,
            load_ai_settings,
            save_ai_settings,
            connect_account,
            sync_account,
            get_thread_detail,
            prepare_reply_draft,
            save_draft_command,
            send_draft_command,
            generate_ai_suggestion_batch,
            apply_actions_command,
            rewrite_draft_text_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running arx");
}
