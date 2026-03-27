use crate::models::{
    AISuggestionBatch, ActionLogEntry, DraftDocument, DraftStatus, MailAccount, Mailbox,
    MailboxRole, NormalizedMessage, NormalizedThread, ProviderKind, Suggestion,
    SuggestionAction, ThreadDetail,
};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

pub fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

pub struct Store {
    db_path: PathBuf,
}

impl Store {
    pub fn from_app(app: &AppHandle) -> Result<Self, String> {
        let app_data_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
        fs::create_dir_all(&app_data_dir).map_err(|err| err.to_string())?;
        Ok(Self {
            db_path: app_data_dir.join("arx.sqlite3"),
        })
    }

    #[cfg(test)]
    pub fn from_path(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    fn connect(&self) -> Result<Connection, String> {
        let connection = Connection::open(&self.db_path).map_err(|err| err.to_string())?;
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|err| err.to_string())?;
        Ok(connection)
    }

    pub fn init(&self) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS accounts (
                    id TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    capabilities_json TEXT NOT NULL,
                    archive_mailbox TEXT,
                    connected_at TEXT NOT NULL,
                    last_synced_at TEXT,
                    sync_cursor TEXT,
                    settings_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS mailboxes (
                    id TEXT PRIMARY KEY,
                    account_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS threads (
                    id TEXT PRIMARY KEY,
                    account_id TEXT NOT NULL,
                    mailbox_id TEXT NOT NULL,
                    provider_thread_id TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    participants_json TEXT NOT NULL,
                    unread INTEGER NOT NULL,
                    starred INTEGER NOT NULL,
                    archived INTEGER NOT NULL,
                    needs_reply INTEGER NOT NULL,
                    snippet TEXT NOT NULL,
                    last_message_at TEXT NOT NULL,
                    message_count INTEGER NOT NULL,
                    provider_metadata_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    thread_id TEXT NOT NULL,
                    account_id TEXT NOT NULL,
                    provider_message_id TEXT NOT NULL,
                    from_json TEXT NOT NULL,
                    to_json TEXT NOT NULL,
                    cc_json TEXT NOT NULL,
                    bcc_json TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    received_at TEXT NOT NULL,
                    sanitized_html TEXT NOT NULL,
                    text TEXT NOT NULL,
                    headers_json TEXT NOT NULL,
                    is_outbound INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS drafts (
                    id TEXT PRIMARY KEY,
                    thread_id TEXT NOT NULL,
                    account_id TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    to_json TEXT NOT NULL,
                    cc_json TEXT NOT NULL,
                    bcc_json TEXT NOT NULL,
                    in_reply_to TEXT,
                    references_json TEXT NOT NULL,
                    tiptap_json TEXT NOT NULL,
                    html TEXT NOT NULL,
                    text TEXT NOT NULL,
                    status TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS suggestion_batches (
                    id TEXT PRIMARY KEY,
                    summary TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    account_id TEXT
                );

                CREATE TABLE IF NOT EXISTS suggestions (
                    id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL,
                    account_id TEXT NOT NULL,
                    thread_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    selected INTEGER NOT NULL,
                    draft_reply_json TEXT
                );

                CREATE TABLE IF NOT EXISTS action_log (
                    id TEXT PRIMARY KEY,
                    account_id TEXT,
                    thread_id TEXT,
                    action TEXT NOT NULL,
                    detail_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                "#,
            )
            .map_err(|err| err.to_string())
    }

    pub fn upsert_account(&self, account: &MailAccount, settings: &Value) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute(
                r#"
                INSERT INTO accounts (
                    id,
                    provider,
                    display_name,
                    email,
                    capabilities_json,
                    archive_mailbox,
                    connected_at,
                    last_synced_at,
                    sync_cursor,
                    settings_json
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, COALESCE((SELECT sync_cursor FROM accounts WHERE id = ?1), NULL), ?9)
                ON CONFLICT(id) DO UPDATE SET
                    display_name = excluded.display_name,
                    email = excluded.email,
                    capabilities_json = excluded.capabilities_json,
                    archive_mailbox = excluded.archive_mailbox,
                    settings_json = excluded.settings_json
                "#,
                params![
                    account.id,
                    account.provider.as_str(),
                    account.display_name,
                    account.email,
                    to_json(&account.capabilities)?,
                    account.archive_mailbox,
                    account.connected_at,
                    account.last_synced_at,
                    to_json(settings)?,
                ],
            )
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    pub fn get_account(&self, account_id: &str) -> Result<MailAccount, String> {
        let connection = self.connect()?;
        let row = connection
            .query_row(
                r#"
                SELECT
                    id,
                    provider,
                    display_name,
                    email,
                    capabilities_json,
                    archive_mailbox,
                    connected_at,
                    last_synced_at
                FROM accounts
                WHERE id = ?1
                "#,
                [account_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, Option<String>>(5)?,
                        row.get::<_, String>(6)?,
                        row.get::<_, Option<String>>(7)?,
                    ))
                },
            )
            .optional()
            .map_err(|err| err.to_string())?
            .ok_or_else(|| format!("Account not found: {account_id}"))?;

        Ok(MailAccount {
            id: row.0,
            provider: ProviderKind::from_db(&row.1)?,
            display_name: row.2,
            email: row.3,
            capabilities: from_json(&row.4)?,
            archive_mailbox: row.5,
            connected_at: row.6,
            last_synced_at: row.7,
        })
    }

    pub fn get_sync_cursor(&self, account_id: &str) -> Result<Option<String>, String> {
        let connection = self.connect()?;
        connection
            .query_row(
                "SELECT sync_cursor FROM accounts WHERE id = ?1",
                [account_id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .map_err(|err| err.to_string())?
            .ok_or_else(|| format!("Account not found: {account_id}"))
    }

    pub fn save_sync_delta(
        &self,
        account_id: &str,
        mailboxes: &[Mailbox],
        threads: &[NormalizedThread],
        messages: &[NormalizedMessage],
        next_cursor: &str,
    ) -> Result<(), String> {
        let mut connection = self.connect()?;
        let transaction = connection.transaction().map_err(|err| err.to_string())?;

        for mailbox in mailboxes {
            transaction
                .execute(
                    r#"
                    INSERT INTO mailboxes (id, account_id, name, role)
                    VALUES (?1, ?2, ?3, ?4)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name,
                        role = excluded.role
                    "#,
                    params![
                        mailbox.id,
                        mailbox.account_id,
                        mailbox.name,
                        mailbox.role.as_str(),
                    ],
                )
                .map_err(|err| err.to_string())?;
        }

        for thread in threads {
            transaction
                .execute(
                    r#"
                    INSERT INTO threads (
                        id,
                        account_id,
                        mailbox_id,
                        provider_thread_id,
                        subject,
                        participants_json,
                        unread,
                        starred,
                        archived,
                        needs_reply,
                        snippet,
                        last_message_at,
                        message_count,
                        provider_metadata_json
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
                    ON CONFLICT(id) DO UPDATE SET
                        mailbox_id = excluded.mailbox_id,
                        subject = excluded.subject,
                        participants_json = excluded.participants_json,
                        unread = excluded.unread,
                        starred = excluded.starred,
                        archived = excluded.archived,
                        needs_reply = excluded.needs_reply,
                        snippet = excluded.snippet,
                        last_message_at = excluded.last_message_at,
                        message_count = excluded.message_count,
                        provider_metadata_json = excluded.provider_metadata_json
                    "#,
                    params![
                        thread.id,
                        thread.account_id,
                        thread.mailbox_id,
                        thread.provider_thread_id,
                        thread.subject,
                        to_json(&thread.participants)?,
                        i64::from(thread.unread),
                        i64::from(thread.starred),
                        i64::from(thread.archived),
                        i64::from(thread.needs_reply),
                        thread.snippet,
                        thread.last_message_at,
                        thread.message_count,
                        to_json(&thread.provider_metadata)?,
                    ],
                )
                .map_err(|err| err.to_string())?;
        }

        for message in messages {
            transaction
                .execute(
                    r#"
                    INSERT INTO messages (
                        id,
                        thread_id,
                        account_id,
                        provider_message_id,
                        from_json,
                        to_json,
                        cc_json,
                        bcc_json,
                        subject,
                        received_at,
                        sanitized_html,
                        text,
                        headers_json,
                        is_outbound
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
                    ON CONFLICT(id) DO UPDATE SET
                        sanitized_html = excluded.sanitized_html,
                        text = excluded.text,
                        headers_json = excluded.headers_json,
                        received_at = excluded.received_at,
                        is_outbound = excluded.is_outbound
                    "#,
                    params![
                        message.id,
                        message.thread_id,
                        message.account_id,
                        message.provider_message_id,
                        to_json(&message.from)?,
                        to_json(&message.to)?,
                        to_json(&message.cc)?,
                        to_json(&message.bcc)?,
                        message.subject,
                        message.received_at,
                        message.sanitized_html,
                        message.text,
                        to_json(&message.headers)?,
                        i64::from(message.is_outbound),
                    ],
                )
                .map_err(|err| err.to_string())?;
        }

        transaction
            .execute(
                "UPDATE accounts SET sync_cursor = ?1, last_synced_at = ?2 WHERE id = ?3",
                params![next_cursor, now_iso(), account_id],
            )
            .map_err(|err| err.to_string())?;
        transaction.commit().map_err(|err| err.to_string())
    }

    pub fn list_accounts(&self) -> Result<Vec<MailAccount>, String> {
        let connection = self.connect()?;
        let mut statement = connection
            .prepare(
                r#"
                SELECT
                    id,
                    provider,
                    display_name,
                    email,
                    capabilities_json,
                    archive_mailbox,
                    connected_at,
                    last_synced_at
                FROM accounts
                ORDER BY connected_at DESC
                "#,
            )
            .map_err(|err| err.to_string())?;

        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, Option<String>>(7)?,
                ))
            })
            .map_err(|err| err.to_string())?;

        rows.map(|row| {
            let row = row.map_err(|err| err.to_string())?;
            Ok(MailAccount {
                id: row.0,
                provider: ProviderKind::from_db(&row.1)?,
                display_name: row.2,
                email: row.3,
                capabilities: from_json(&row.4)?,
                archive_mailbox: row.5,
                connected_at: row.6,
                last_synced_at: row.7,
            })
        })
        .collect()
    }

    pub fn list_mailboxes(&self) -> Result<Vec<Mailbox>, String> {
        let connection = self.connect()?;
        let mut statement = connection
            .prepare(
                r#"
                SELECT
                    m.id,
                    m.account_id,
                    m.name,
                    m.role,
                    COALESCE(SUM(CASE WHEN t.unread = 1 THEN 1 ELSE 0 END), 0)
                FROM mailboxes m
                LEFT JOIN threads t ON t.mailbox_id = m.id
                GROUP BY m.id, m.account_id, m.name, m.role
                ORDER BY m.account_id, m.role, m.name
                "#,
            )
            .map_err(|err| err.to_string())?;

        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            })
            .map_err(|err| err.to_string())?;

        rows.map(|row| {
            let row = row.map_err(|err| err.to_string())?;
            Ok(Mailbox {
                id: row.0,
                account_id: row.1,
                name: row.2,
                role: MailboxRole::from_db(&row.3)?,
                unread_count: row.4,
            })
        })
        .collect()
    }

    pub fn list_threads(&self, account_id: Option<&str>) -> Result<Vec<NormalizedThread>, String> {
        let connection = self.connect()?;
        let sql = if account_id.is_some() {
            r#"
            SELECT
                id,
                account_id,
                mailbox_id,
                provider_thread_id,
                subject,
                participants_json,
                unread,
                starred,
                archived,
                needs_reply,
                snippet,
                last_message_at,
                message_count,
                provider_metadata_json
            FROM threads
            WHERE account_id = ?1
            ORDER BY unread DESC, last_message_at DESC
            "#
        } else {
            r#"
            SELECT
                id,
                account_id,
                mailbox_id,
                provider_thread_id,
                subject,
                participants_json,
                unread,
                starred,
                archived,
                needs_reply,
                snippet,
                last_message_at,
                message_count,
                provider_metadata_json
            FROM threads
            ORDER BY unread DESC, last_message_at DESC
            "#
        };

        let mut statement = connection.prepare(sql).map_err(|err| err.to_string())?;
        let mapper = |row: &rusqlite::Row<'_>| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
                row.get::<_, i64>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, String>(11)?,
                row.get::<_, i64>(12)?,
                row.get::<_, String>(13)?,
            ))
        };

        let rows = if let Some(account_id) = account_id {
            statement
                .query_map([account_id], mapper)
                .map_err(|err| err.to_string())?
        } else {
            statement.query_map([], mapper).map_err(|err| err.to_string())?
        };

        rows.map(|row| {
            let row = row.map_err(|err| err.to_string())?;
            Ok(NormalizedThread {
                id: row.0,
                account_id: row.1,
                mailbox_id: row.2,
                provider_thread_id: row.3,
                subject: row.4,
                participants: from_json(&row.5)?,
                unread: row.6 != 0,
                starred: row.7 != 0,
                archived: row.8 != 0,
                needs_reply: row.9 != 0,
                snippet: row.10,
                last_message_at: row.11,
                message_count: row.12,
                provider_metadata: from_json(&row.13)?,
            })
        })
        .collect()
    }

    pub fn get_thread_detail(&self, thread_id: &str) -> Result<ThreadDetail, String> {
        let connection = self.connect()?;

        let thread_row = connection
            .query_row(
                r#"
                SELECT
                    id,
                    account_id,
                    mailbox_id,
                    provider_thread_id,
                    subject,
                    participants_json,
                    unread,
                    starred,
                    archived,
                    needs_reply,
                    snippet,
                    last_message_at,
                    message_count,
                    provider_metadata_json
                FROM threads
                WHERE id = ?1
                "#,
                [thread_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, i64>(6)?,
                        row.get::<_, i64>(7)?,
                        row.get::<_, i64>(8)?,
                        row.get::<_, i64>(9)?,
                        row.get::<_, String>(10)?,
                        row.get::<_, String>(11)?,
                        row.get::<_, i64>(12)?,
                        row.get::<_, String>(13)?,
                    ))
                },
            )
            .optional()
            .map_err(|err| err.to_string())?
            .ok_or_else(|| format!("Thread not found: {thread_id}"))?;

        let thread = NormalizedThread {
            id: thread_row.0,
            account_id: thread_row.1,
            mailbox_id: thread_row.2,
            provider_thread_id: thread_row.3,
            subject: thread_row.4,
            participants: from_json(&thread_row.5)?,
            unread: thread_row.6 != 0,
            starred: thread_row.7 != 0,
            archived: thread_row.8 != 0,
            needs_reply: thread_row.9 != 0,
            snippet: thread_row.10,
            last_message_at: thread_row.11,
            message_count: thread_row.12,
            provider_metadata: from_json(&thread_row.13)?,
        };

        let mut message_statement = connection
            .prepare(
                r#"
                SELECT
                    id,
                    thread_id,
                    account_id,
                    provider_message_id,
                    from_json,
                    to_json,
                    cc_json,
                    bcc_json,
                    subject,
                    received_at,
                    sanitized_html,
                    text,
                    headers_json,
                    is_outbound
                FROM messages
                WHERE thread_id = ?1
                ORDER BY received_at ASC
                "#,
            )
            .map_err(|err| err.to_string())?;

        let messages = message_statement
            .query_map([thread_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, String>(9)?,
                    row.get::<_, String>(10)?,
                    row.get::<_, String>(11)?,
                    row.get::<_, String>(12)?,
                    row.get::<_, i64>(13)?,
                ))
            })
            .map_err(|err| err.to_string())?
            .map(|row| {
                let row = row.map_err(|err| err.to_string())?;
                Ok::<NormalizedMessage, String>(NormalizedMessage {
                    id: row.0,
                    thread_id: row.1,
                    account_id: row.2,
                    provider_message_id: row.3,
                    from: from_json(&row.4)?,
                    to: from_json(&row.5)?,
                    cc: from_json(&row.6)?,
                    bcc: from_json(&row.7)?,
                    subject: row.8,
                    received_at: row.9,
                    sanitized_html: row.10,
                    text: row.11,
                    headers: from_json(&row.12)?,
                    is_outbound: row.13 != 0,
                })
            })
            .collect::<Result<Vec<_>, _>>()?;

        let draft = self.latest_draft_for_thread(thread_id)?;

        Ok(ThreadDetail {
            thread,
            messages,
            draft,
        })
    }

    pub fn latest_draft_for_thread(&self, thread_id: &str) -> Result<Option<DraftDocument>, String> {
        let connection = self.connect()?;
        connection
            .query_row(
                r#"
                SELECT
                    id,
                    thread_id,
                    account_id,
                    subject,
                    to_json,
                    cc_json,
                    bcc_json,
                    in_reply_to,
                    references_json,
                    tiptap_json,
                    html,
                    text,
                    status,
                    updated_at
                FROM drafts
                WHERE thread_id = ?1
                ORDER BY updated_at DESC
                LIMIT 1
                "#,
                [thread_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, String>(6)?,
                        row.get::<_, Option<String>>(7)?,
                        row.get::<_, String>(8)?,
                        row.get::<_, String>(9)?,
                        row.get::<_, String>(10)?,
                        row.get::<_, String>(11)?,
                        row.get::<_, String>(12)?,
                        row.get::<_, String>(13)?,
                    ))
                },
            )
            .optional()
            .map_err(|err| err.to_string())?
            .map(|row| {
                Ok(DraftDocument {
                    id: row.0,
                    thread_id: row.1,
                    account_id: row.2,
                    subject: row.3,
                    to: from_json(&row.4)?,
                    cc: from_json(&row.5)?,
                    bcc: from_json(&row.6)?,
                    in_reply_to: row.7,
                    references: from_json(&row.8)?,
                    tiptap_json: from_json(&row.9)?,
                    html: row.10,
                    text: row.11,
                    status: DraftStatus::from_db(&row.12)?,
                    updated_at: row.13,
                })
            })
            .transpose()
    }

    pub fn get_draft(&self, draft_id: &str) -> Result<DraftDocument, String> {
        let connection = self.connect()?;
        let row = connection
            .query_row(
                r#"
                SELECT
                    id,
                    thread_id,
                    account_id,
                    subject,
                    to_json,
                    cc_json,
                    bcc_json,
                    in_reply_to,
                    references_json,
                    tiptap_json,
                    html,
                    text,
                    status,
                    updated_at
                FROM drafts
                WHERE id = ?1
                "#,
                [draft_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, String>(6)?,
                        row.get::<_, Option<String>>(7)?,
                        row.get::<_, String>(8)?,
                        row.get::<_, String>(9)?,
                        row.get::<_, String>(10)?,
                        row.get::<_, String>(11)?,
                        row.get::<_, String>(12)?,
                        row.get::<_, String>(13)?,
                    ))
                },
            )
            .optional()
            .map_err(|err| err.to_string())?
            .ok_or_else(|| format!("Draft not found: {draft_id}"))?;

        Ok(DraftDocument {
            id: row.0,
            thread_id: row.1,
            account_id: row.2,
            subject: row.3,
            to: from_json(&row.4)?,
            cc: from_json(&row.5)?,
            bcc: from_json(&row.6)?,
            in_reply_to: row.7,
            references: from_json(&row.8)?,
            tiptap_json: from_json(&row.9)?,
            html: row.10,
            text: row.11,
            status: DraftStatus::from_db(&row.12)?,
            updated_at: row.13,
        })
    }

    pub fn save_draft(&self, draft: &DraftDocument) -> Result<DraftDocument, String> {
        let connection = self.connect()?;
        connection
            .execute(
                r#"
                INSERT INTO drafts (
                    id,
                    thread_id,
                    account_id,
                    subject,
                    to_json,
                    cc_json,
                    bcc_json,
                    in_reply_to,
                    references_json,
                    tiptap_json,
                    html,
                    text,
                    status,
                    updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
                ON CONFLICT(id) DO UPDATE SET
                    subject = excluded.subject,
                    to_json = excluded.to_json,
                    cc_json = excluded.cc_json,
                    bcc_json = excluded.bcc_json,
                    in_reply_to = excluded.in_reply_to,
                    references_json = excluded.references_json,
                    tiptap_json = excluded.tiptap_json,
                    html = excluded.html,
                    text = excluded.text,
                    status = excluded.status,
                    updated_at = excluded.updated_at
                "#,
                params![
                    draft.id,
                    draft.thread_id,
                    draft.account_id,
                    draft.subject,
                    to_json(&draft.to)?,
                    to_json(&draft.cc)?,
                    to_json(&draft.bcc)?,
                    draft.in_reply_to,
                    to_json(&draft.references)?,
                    to_json(&draft.tiptap_json)?,
                    draft.html,
                    draft.text,
                    draft.status.as_str(),
                    draft.updated_at,
                ],
            )
            .map_err(|err| err.to_string())?;
        Ok(draft.clone())
    }

    pub fn mark_draft_sent(&self, draft_id: &str) -> Result<DraftDocument, String> {
        let mut draft = self.get_draft(draft_id)?;
        draft.status = DraftStatus::Sent;
        draft.updated_at = now_iso();
        self.save_draft(&draft)?;
        Ok(draft)
    }

    pub fn append_outbound_message(&self, draft: &DraftDocument) -> Result<(), String> {
        let detail = self.get_thread_detail(&draft.thread_id)?;
        let mut connection = self.connect()?;
        let transaction = connection.transaction().map_err(|err| err.to_string())?;
        let message_id = Uuid::new_v4().to_string();
        let headers = json!({
            "messageId": message_id,
            "inReplyTo": draft.in_reply_to,
            "references": draft.references,
        });

        transaction
            .execute(
                r#"
                INSERT INTO messages (
                    id,
                    thread_id,
                    account_id,
                    provider_message_id,
                    from_json,
                    to_json,
                    cc_json,
                    bcc_json,
                    subject,
                    received_at,
                    sanitized_html,
                    text,
                    headers_json,
                    is_outbound
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 1)
                "#,
                params![
                    format!("msg-{}", Uuid::new_v4()),
                    draft.thread_id,
                    draft.account_id,
                    message_id,
                    to_json(&json!({
                        "name": "You",
                        "email": detail.thread.participants.get(1).map(|participant| participant.email.clone()).unwrap_or_default(),
                    }))?,
                    to_json(&draft.to)?,
                    to_json(&draft.cc)?,
                    to_json(&draft.bcc)?,
                    draft.subject,
                    draft.updated_at,
                    draft.html,
                    draft.text,
                    to_json(&headers)?,
                ],
            )
            .map_err(|err| err.to_string())?;

        transaction
            .execute(
                r#"
                UPDATE threads
                SET unread = 0,
                    needs_reply = 0,
                    snippet = ?2,
                    last_message_at = ?3,
                    message_count = message_count + 1
                WHERE id = ?1
                "#,
                params![draft.thread_id, draft.text.lines().next().unwrap_or("Sent reply"), draft.updated_at],
            )
            .map_err(|err| err.to_string())?;

        transaction.commit().map_err(|err| err.to_string())
    }

    pub fn save_suggestion_batch(&self, batch: &AISuggestionBatch) -> Result<(), String> {
        let mut connection = self.connect()?;
        let transaction = connection.transaction().map_err(|err| err.to_string())?;
        transaction
            .execute(
                "INSERT INTO suggestion_batches (id, summary, created_at, account_id) VALUES (?1, ?2, ?3, ?4)",
                params![batch.id, batch.summary, batch.created_at, batch.account_id],
            )
            .map_err(|err| err.to_string())?;

        for suggestion in &batch.suggestions {
            transaction
                .execute(
                    r#"
                    INSERT INTO suggestions (
                        id,
                        batch_id,
                        account_id,
                        thread_id,
                        action,
                        summary,
                        reason,
                        confidence,
                        selected,
                        draft_reply_json
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                    "#,
                    params![
                        suggestion.id,
                        suggestion.batch_id,
                        suggestion.account_id,
                        suggestion.thread_id,
                        suggestion.action.as_str(),
                        suggestion.summary,
                        suggestion.reason,
                        suggestion.confidence,
                        i64::from(suggestion.selected),
                        suggestion
                            .draft_reply
                            .as_ref()
                            .map(|draft| to_json(draft))
                            .transpose()?,
                    ],
                )
                .map_err(|err| err.to_string())?;
        }

        transaction.commit().map_err(|err| err.to_string())
    }

    pub fn list_suggestion_batches(&self) -> Result<Vec<AISuggestionBatch>, String> {
        let connection = self.connect()?;
        let mut batch_statement = connection
            .prepare(
                r#"
                SELECT id, summary, created_at, account_id
                FROM suggestion_batches
                ORDER BY created_at DESC
                LIMIT 10
                "#,
            )
            .map_err(|err| err.to_string())?;

        let batch_rows = batch_statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            })
            .map_err(|err| err.to_string())?;

        let mut suggestion_statement = connection
            .prepare(
                r#"
                SELECT
                    id,
                    batch_id,
                    account_id,
                    thread_id,
                    action,
                    summary,
                    reason,
                    confidence,
                    selected,
                    draft_reply_json
                FROM suggestions
                WHERE batch_id = ?1
                ORDER BY confidence DESC, summary ASC
                "#,
            )
            .map_err(|err| err.to_string())?;

        let mut batches = Vec::new();
        for batch_row in batch_rows {
            let batch_row = batch_row.map_err(|err| err.to_string())?;
            let suggestions = suggestion_statement
                .query_map([batch_row.0.as_str()], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, String>(6)?,
                        row.get::<_, f64>(7)?,
                        row.get::<_, i64>(8)?,
                        row.get::<_, Option<String>>(9)?,
                    ))
                })
                .map_err(|err| err.to_string())?
                .map(|row| {
                    let row = row.map_err(|err| err.to_string())?;
                    Ok::<Suggestion, String>(Suggestion {
                        id: row.0,
                        batch_id: row.1,
                        account_id: row.2,
                        thread_id: row.3,
                        action: SuggestionAction::from_db(&row.4)?,
                        summary: row.5,
                        reason: row.6,
                        confidence: row.7,
                        selected: row.8 != 0,
                        draft_reply: row
                            .9
                            .as_ref()
                            .map(|raw| from_json(raw))
                            .transpose()?,
                    })
                })
                .collect::<Result<Vec<_>, _>>()?;

            batches.push(AISuggestionBatch {
                id: batch_row.0,
                summary: batch_row.1,
                created_at: batch_row.2,
                account_id: batch_row.3,
                suggestions,
            });
        }

        Ok(batches)
    }

    pub fn bootstrap_snapshot(&self) -> Result<crate::models::AppSnapshot, String> {
        Ok(crate::models::AppSnapshot {
            accounts: self.list_accounts()?,
            mailboxes: self.list_mailboxes()?,
            threads: self.list_threads(None)?,
            suggestion_batches: self.list_suggestion_batches()?,
        })
    }

    pub fn append_action_log(
        &self,
        account_id: Option<&str>,
        thread_id: Option<&str>,
        action: &str,
        detail: &Value,
    ) -> Result<ActionLogEntry, String> {
        let entry = ActionLogEntry {
            id: format!("log-{}", Uuid::new_v4()),
            account_id: account_id.map(ToOwned::to_owned),
            thread_id: thread_id.map(ToOwned::to_owned),
            action: action.to_string(),
            detail: detail.clone(),
            created_at: now_iso(),
        };

        let connection = self.connect()?;
        connection
            .execute(
                "INSERT INTO action_log (id, account_id, thread_id, action, detail_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    entry.id,
                    entry.account_id,
                    entry.thread_id,
                    entry.action,
                    to_json(&entry.detail)?,
                    entry.created_at,
                ],
            )
            .map_err(|err| err.to_string())?;
        Ok(entry)
    }

    pub fn find_mailbox_id(&self, account_id: &str, role: MailboxRole) -> Result<Option<String>, String> {
        let connection = self.connect()?;
        connection
            .query_row(
                "SELECT id FROM mailboxes WHERE account_id = ?1 AND role = ?2 LIMIT 1",
                params![account_id, role.as_str()],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|err| err.to_string())
    }

    pub fn apply_thread_action(
        &self,
        account: &MailAccount,
        thread_id: &str,
        action: &SuggestionAction,
    ) -> Result<(), String> {
        let connection = self.connect()?;
        match action {
            SuggestionAction::Archive => {
                let archive_mailbox_id = self
                    .find_mailbox_id(&account.id, MailboxRole::Archive)?
                    .ok_or_else(|| "Archive mailbox is not configured for this account.".to_string())?;
                connection
                    .execute(
                        "UPDATE threads SET archived = 1, unread = 0, mailbox_id = ?2 WHERE id = ?1",
                        params![thread_id, archive_mailbox_id],
                    )
                    .map_err(|err| err.to_string())?;
            }
            SuggestionAction::MarkRead => {
                connection
                    .execute("UPDATE threads SET unread = 0 WHERE id = ?1", [thread_id])
                    .map_err(|err| err.to_string())?;
            }
            SuggestionAction::MarkUnread => {
                connection
                    .execute("UPDATE threads SET unread = 1 WHERE id = ?1", [thread_id])
                    .map_err(|err| err.to_string())?;
            }
            SuggestionAction::Star => {
                connection
                    .execute(
                        "UPDATE threads SET starred = CASE starred WHEN 1 THEN 0 ELSE 1 END WHERE id = ?1",
                        [thread_id],
                    )
                    .map_err(|err| err.to_string())?;
            }
            SuggestionAction::MoveToInbox => {
                let inbox_mailbox_id = self
                    .find_mailbox_id(&account.id, MailboxRole::Inbox)?
                    .ok_or_else(|| "Inbox mailbox is not configured for this account.".to_string())?;
                connection
                    .execute(
                        "UPDATE threads SET archived = 0, mailbox_id = ?2 WHERE id = ?1",
                        params![thread_id, inbox_mailbox_id],
                    )
                    .map_err(|err| err.to_string())?;
            }
            SuggestionAction::DraftReply => {}
        }
        Ok(())
    }
}

fn to_json<T: Serialize>(value: &T) -> Result<String, String> {
    serde_json::to_string(value).map_err(|err| err.to_string())
}

fn from_json<T: DeserializeOwned>(value: &str) -> Result<T, String> {
    serde_json::from_str(value).map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{DraftStatus, EmailParticipant, ProviderCapabilities};
    use tempfile::tempdir;

    #[test]
    fn saves_and_loads_account_and_draft() {
        let directory = tempdir().expect("temp dir");
        let store = Store::from_path(directory.path().join("arx.sqlite3"));
        store.init().expect("init schema");

        let account = MailAccount {
            id: "acct-1".into(),
            provider: ProviderKind::Gmail,
            display_name: "Arx User".into(),
            email: "user@example.com".into(),
            capabilities: ProviderCapabilities {
                archive: true,
                star: true,
                move_to_inbox: true,
                send_html: true,
                thread_view: true,
                attachments_read: true,
            },
            connected_at: now_iso(),
            last_synced_at: None,
            archive_mailbox: Some("Archive".into()),
        };
        store
            .upsert_account(&account, &json!({"mode": "test"}))
            .expect("save account");

        let loaded = store.get_account("acct-1").expect("load account");
        assert_eq!(loaded.email, "user@example.com");

        let draft = DraftDocument {
            id: "draft-1".into(),
            thread_id: "thread-1".into(),
            account_id: "acct-1".into(),
            subject: "Re: hello".into(),
            to: vec![EmailParticipant {
                name: "Maya".into(),
                email: "maya@example.com".into(),
            }],
            cc: vec![],
            bcc: vec![],
            in_reply_to: None,
            references: vec![],
            tiptap_json: json!({"type": "doc", "content": [{"type": "paragraph"}]}),
            html: "<p>Hello</p>".into(),
            text: "Hello".into(),
            status: DraftStatus::Draft,
            updated_at: now_iso(),
        };

        store.save_draft(&draft).expect("save draft");
        let loaded_draft = store.get_draft("draft-1").expect("load draft");
        assert_eq!(loaded_draft.subject, "Re: hello");
    }
}
