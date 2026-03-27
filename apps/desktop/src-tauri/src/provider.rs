use crate::models::{
    ActionLogEntry, ActionRequest, ConnectAccountInput, DraftDocument, EmailParticipant,
    MailAccount, Mailbox, MailboxRole, NormalizedMessage, NormalizedThread, ProviderCapabilities,
    ProviderConnection, ProviderKind, SuggestionAction, SyncDelta, ThreadDetail,
};
use crate::security;
use crate::store::{now_iso, Store};
use chrono::{TimeZone, Utc};
use imap::types::Flag;
use mailparse::{addrparse_header, parse_mail, MailAddr, MailAddrList, MailHeaderMap, ParsedMail};
use native_tls::TlsConnector;
use serde::Deserialize;
use serde_json::json;
use std::collections::BTreeMap;
use uuid::Uuid;

#[allow(dead_code)]
pub trait MailProviderAdapter {
    fn provider_kind(&self) -> ProviderKind;
    fn connect(
        &self,
        store: &Store,
        input: &ConnectAccountInput,
    ) -> Result<ProviderConnection, String>;
    fn refresh_auth(&self, account: &MailAccount) -> Result<(), String>;
    fn list_mailboxes(&self, account: &MailAccount) -> Result<Vec<Mailbox>, String>;
    fn sync_delta(
        &self,
        store: &Store,
        account: &MailAccount,
        cursor: Option<&str>,
    ) -> Result<SyncDelta, String>;
    fn list_threads(
        &self,
        store: &Store,
        account_id: &str,
    ) -> Result<Vec<NormalizedThread>, String>;
    fn get_thread(&self, store: &Store, thread_id: &str) -> Result<ThreadDetail, String>;
    fn apply_actions(
        &self,
        store: &Store,
        account: &MailAccount,
        actions: &[ActionRequest],
    ) -> Result<Vec<ActionLogEntry>, String>;
    fn save_draft(&self, store: &Store, draft: &DraftDocument) -> Result<DraftDocument, String>;
    fn send(&self, store: &Store, draft: &DraftDocument) -> Result<ActionLogEntry, String>;
    fn get_capabilities(&self, input: Option<&ConnectAccountInput>) -> ProviderCapabilities;
}

pub fn adapter_for(provider: &ProviderKind) -> Box<dyn MailProviderAdapter> {
    match provider {
        ProviderKind::Gmail => Box::new(GmailAdapter),
        ProviderKind::Outlook => Box::new(OutlookAdapter),
        ProviderKind::Imap => Box::new(ImapAdapter),
    }
}

struct GmailAdapter;
struct OutlookAdapter;
struct ImapAdapter;

impl MailProviderAdapter for GmailAdapter {
    fn provider_kind(&self) -> ProviderKind {
        ProviderKind::Gmail
    }

    fn connect(
        &self,
        store: &Store,
        input: &ConnectAccountInput,
    ) -> Result<ProviderConnection, String> {
        connect_account_impl(store, self, input)
    }

    fn refresh_auth(&self, account: &MailAccount) -> Result<(), String> {
        refresh_auth_impl(account)
    }

    fn list_mailboxes(&self, account: &MailAccount) -> Result<Vec<Mailbox>, String> {
        Ok(default_mailboxes(account, false))
    }

    fn sync_delta(
        &self,
        store: &Store,
        account: &MailAccount,
        cursor: Option<&str>,
    ) -> Result<SyncDelta, String> {
        sync_imap_account(store, account, cursor)
    }

    fn list_threads(
        &self,
        store: &Store,
        account_id: &str,
    ) -> Result<Vec<NormalizedThread>, String> {
        store.list_threads(Some(account_id))
    }

    fn get_thread(&self, store: &Store, thread_id: &str) -> Result<ThreadDetail, String> {
        store.get_thread_detail(thread_id)
    }

    fn apply_actions(
        &self,
        store: &Store,
        account: &MailAccount,
        actions: &[ActionRequest],
    ) -> Result<Vec<ActionLogEntry>, String> {
        apply_actions_impl(store, account, actions)
    }

    fn save_draft(&self, store: &Store, draft: &DraftDocument) -> Result<DraftDocument, String> {
        store.save_draft(draft)
    }

    fn send(&self, store: &Store, draft: &DraftDocument) -> Result<ActionLogEntry, String> {
        send_impl(store, draft)
    }

    fn get_capabilities(&self, input: Option<&ConnectAccountInput>) -> ProviderCapabilities {
        let _ = input;
        read_only_capabilities()
    }
}

impl MailProviderAdapter for OutlookAdapter {
    fn provider_kind(&self) -> ProviderKind {
        ProviderKind::Outlook
    }

    fn connect(
        &self,
        store: &Store,
        input: &ConnectAccountInput,
    ) -> Result<ProviderConnection, String> {
        connect_account_impl(store, self, input)
    }

    fn refresh_auth(&self, account: &MailAccount) -> Result<(), String> {
        refresh_auth_impl(account)
    }

    fn list_mailboxes(&self, account: &MailAccount) -> Result<Vec<Mailbox>, String> {
        Ok(default_mailboxes(account, false))
    }

    fn sync_delta(
        &self,
        store: &Store,
        account: &MailAccount,
        cursor: Option<&str>,
    ) -> Result<SyncDelta, String> {
        sync_imap_account(store, account, cursor)
    }

    fn list_threads(
        &self,
        store: &Store,
        account_id: &str,
    ) -> Result<Vec<NormalizedThread>, String> {
        store.list_threads(Some(account_id))
    }

    fn get_thread(&self, store: &Store, thread_id: &str) -> Result<ThreadDetail, String> {
        store.get_thread_detail(thread_id)
    }

    fn apply_actions(
        &self,
        store: &Store,
        account: &MailAccount,
        actions: &[ActionRequest],
    ) -> Result<Vec<ActionLogEntry>, String> {
        apply_actions_impl(store, account, actions)
    }

    fn save_draft(&self, store: &Store, draft: &DraftDocument) -> Result<DraftDocument, String> {
        store.save_draft(draft)
    }

    fn send(&self, store: &Store, draft: &DraftDocument) -> Result<ActionLogEntry, String> {
        send_impl(store, draft)
    }

    fn get_capabilities(&self, input: Option<&ConnectAccountInput>) -> ProviderCapabilities {
        let _ = input;
        read_only_capabilities()
    }
}

impl MailProviderAdapter for ImapAdapter {
    fn provider_kind(&self) -> ProviderKind {
        ProviderKind::Imap
    }

    fn connect(
        &self,
        store: &Store,
        input: &ConnectAccountInput,
    ) -> Result<ProviderConnection, String> {
        connect_account_impl(store, self, input)
    }

    fn refresh_auth(&self, account: &MailAccount) -> Result<(), String> {
        refresh_auth_impl(account)
    }

    fn list_mailboxes(&self, account: &MailAccount) -> Result<Vec<Mailbox>, String> {
        Ok(default_mailboxes(account, false))
    }

    fn sync_delta(
        &self,
        store: &Store,
        account: &MailAccount,
        cursor: Option<&str>,
    ) -> Result<SyncDelta, String> {
        sync_imap_account(store, account, cursor)
    }

    fn list_threads(
        &self,
        store: &Store,
        account_id: &str,
    ) -> Result<Vec<NormalizedThread>, String> {
        store.list_threads(Some(account_id))
    }

    fn get_thread(&self, store: &Store, thread_id: &str) -> Result<ThreadDetail, String> {
        store.get_thread_detail(thread_id)
    }

    fn apply_actions(
        &self,
        store: &Store,
        account: &MailAccount,
        actions: &[ActionRequest],
    ) -> Result<Vec<ActionLogEntry>, String> {
        apply_actions_impl(store, account, actions)
    }

    fn save_draft(&self, store: &Store, draft: &DraftDocument) -> Result<DraftDocument, String> {
        store.save_draft(draft)
    }

    fn send(&self, store: &Store, draft: &DraftDocument) -> Result<ActionLogEntry, String> {
        send_impl(store, draft)
    }

    fn get_capabilities(&self, input: Option<&ConnectAccountInput>) -> ProviderCapabilities {
        let _ = input;
        read_only_capabilities()
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredImapSettings {
    imap_host: String,
    imap_port: u16,
    #[allow(dead_code)]
    smtp_host: String,
    #[allow(dead_code)]
    smtp_port: u16,
    username: String,
    archive_mailbox: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StoredImapSecret {
    password: String,
}

struct SyncThreadBuilder {
    provider_thread_id: String,
    subject: String,
    participants: Vec<EmailParticipant>,
    unread: bool,
    starred: bool,
    needs_reply: bool,
    snippet: String,
    last_message_at: String,
    messages: Vec<NormalizedMessage>,
}

fn connect_account_impl<A: MailProviderAdapter>(
    store: &Store,
    adapter: &A,
    input: &ConnectAccountInput,
) -> Result<ProviderConnection, String> {
    let imap = input
        .imap
        .as_ref()
        .ok_or_else(|| "Mail credentials are required to connect this account.".to_string())?;
    let email = input.email.trim().to_lowercase();
    if email.is_empty() {
        return Err("Email is required.".to_string());
    }
    if imap.imap_host.trim().is_empty() || imap.username.trim().is_empty() {
        return Err("IMAP host and username are required.".to_string());
    }
    if imap.imap_port == 0 {
        return Err("IMAP port must be greater than 0.".to_string());
    }
    if imap.password.trim().is_empty() {
        return Err("Password is required.".to_string());
    }

    let archive_mailbox = imap
        .archive_mailbox
        .as_ref()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let account = MailAccount {
        id: format!(
            "{}-{}",
            adapter.provider_kind().as_str(),
            sanitize_id(&email)
        ),
        provider: adapter.provider_kind(),
        display_name: input.display_name.trim().to_string(),
        email: email.clone(),
        capabilities: adapter.get_capabilities(Some(input)),
        connected_at: now_iso(),
        last_synced_at: None,
        archive_mailbox: archive_mailbox.clone(),
    };
    let settings = json!({
        "imapHost": imap.imap_host.trim(),
        "imapPort": imap.imap_port,
        "smtpHost": imap.smtp_host.trim(),
        "smtpPort": imap.smtp_port,
        "username": imap.username.trim(),
        "archiveMailbox": archive_mailbox,
    });
    let secret = json!({
        "password": imap.password,
    });

    store.upsert_account(&account, &settings)?;
    security::store_account_secret(&account.id, &secret)?;

    Ok(ProviderConnection { account })
}

fn refresh_auth_impl(account: &MailAccount) -> Result<(), String> {
    security::read_account_secret(&account.id).map(|_| ())
}

fn read_only_capabilities() -> ProviderCapabilities {
    ProviderCapabilities {
        archive: false,
        star: false,
        move_to_inbox: false,
        send_html: false,
        thread_view: true,
        attachments_read: false,
    }
}

fn default_mailboxes(account: &MailAccount, include_archive: bool) -> Vec<Mailbox> {
    let mut mailboxes = vec![
        Mailbox {
            id: mailbox_id(&account.id, MailboxRole::Inbox),
            account_id: account.id.clone(),
            name: "Inbox".to_string(),
            role: MailboxRole::Inbox,
            unread_count: 0,
        },
        Mailbox {
            id: mailbox_id(&account.id, MailboxRole::Sent),
            account_id: account.id.clone(),
            name: "Sent".to_string(),
            role: MailboxRole::Sent,
            unread_count: 0,
        },
    ];

    if include_archive {
        mailboxes.push(Mailbox {
            id: mailbox_id(&account.id, MailboxRole::Archive),
            account_id: account.id.clone(),
            name: account
                .archive_mailbox
                .clone()
                .unwrap_or_else(|| "Archive".to_string()),
            role: MailboxRole::Archive,
            unread_count: 0,
        });
    }

    mailboxes
}

fn load_imap_settings(
    store: &Store,
    account: &MailAccount,
) -> Result<(StoredImapSettings, StoredImapSecret), String> {
    let settings =
        serde_json::from_value::<StoredImapSettings>(store.get_account_settings(&account.id)?)
            .map_err(|_| {
                format!(
                    "This account is missing IMAP settings. Reconnect {} to enable real sync.",
                    account.email
                )
            })?;
    let secret =
        serde_json::from_str::<StoredImapSecret>(&security::read_account_secret(&account.id)?)
            .map_err(|_| {
                format!(
                    "This account is missing mail credentials. Reconnect {} to enable real sync.",
                    account.email
                )
            })?;
    Ok((settings, secret))
}

fn sync_imap_account(
    store: &Store,
    account: &MailAccount,
    _cursor: Option<&str>,
) -> Result<SyncDelta, String> {
    let (settings, secret) = load_imap_settings(store, account)?;
    let tls = TlsConnector::builder()
        .build()
        .map_err(|err| format!("Failed to build TLS connector: {err}"))?;
    let client = imap::connect(
        (settings.imap_host.as_str(), settings.imap_port),
        settings.imap_host.as_str(),
        &tls,
    )
    .map_err(|err| format!("Failed to connect to {}: {err}", settings.imap_host))?;
    let mut session = client
        .login(settings.username.as_str(), secret.password.as_str())
        .map_err(|(err, _)| format!("IMAP login failed for {}: {err}", settings.username))?;

    let sync_result = sync_selected_inbox(account, &settings, &mut session);
    let _ = session.logout();
    sync_result
}

fn sync_selected_inbox<T: std::io::Read + std::io::Write>(
    account: &MailAccount,
    settings: &StoredImapSettings,
    session: &mut imap::Session<T>,
) -> Result<SyncDelta, String> {
    let include_archive = settings
        .archive_mailbox
        .as_ref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let mailboxes = default_mailboxes(account, include_archive);
    let inbox_id = mailbox_id(&account.id, MailboxRole::Inbox);
    let status = session
        .select("INBOX")
        .map_err(|err| format!("Failed to select INBOX: {err}"))?;
    if status.exists == 0 {
        return Ok(SyncDelta {
            mailboxes,
            threads: vec![],
            messages: vec![],
            next_cursor: "0".to_string(),
        });
    }

    let start = status.exists.saturating_sub(49).max(1);
    let range = format!("{start}:{}", status.exists);
    let fetched = session
        .fetch(range, "(UID FLAGS BODY.PEEK[])")
        .map_err(|err| format!("Failed to fetch inbox messages: {err}"))?;

    let mut max_uid = 0u32;
    let mut builders = BTreeMap::<String, SyncThreadBuilder>::new();

    for item in fetched.iter() {
        let uid = item
            .uid
            .ok_or_else(|| "IMAP response did not include a message UID.".to_string())?;
        max_uid = max_uid.max(uid);

        let body = item
            .body()
            .ok_or_else(|| format!("IMAP message {uid} did not include a body payload."))?;
        let parsed =
            parse_mail(body).map_err(|err| format!("Failed to parse message {uid}: {err}"))?;
        let subject =
            header_value(&parsed, "Subject").unwrap_or_else(|| "(no subject)".to_string());
        let provider_message_id = header_value(&parsed, "Message-ID")
            .map(|value| normalize_message_id(&value))
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| format!("<uid-{uid}@arx.local>"));
        let references = parse_message_ids(header_value(&parsed, "References"));
        let in_reply_to = parse_message_ids(header_value(&parsed, "In-Reply-To"));
        let conversation_key = references
            .first()
            .cloned()
            .or_else(|| in_reply_to.first().cloned())
            .unwrap_or_else(|| provider_message_id.clone());
        let thread_id = stable_thread_id(account, &conversation_key);
        let from = parse_header_participants(&parsed, "From")
            .into_iter()
            .next()
            .unwrap_or_else(|| EmailParticipant {
                name: String::new(),
                email: "unknown@example.com".to_string(),
            });
        let to = parse_header_participants(&parsed, "To");
        let cc = parse_header_participants(&parsed, "Cc");
        let bcc = parse_header_participants(&parsed, "Bcc");
        let text = extract_message_text(&parsed);
        let received_at = parse_received_at(&parsed).unwrap_or_else(now_iso);
        let is_outbound = from.email.eq_ignore_ascii_case(&account.email);
        let unread = !has_seen_flag(item.flags());
        let starred = has_flagged_flag(item.flags());
        let message = NormalizedMessage {
            id: stable_message_id(account, uid),
            thread_id: thread_id.clone(),
            account_id: account.id.clone(),
            provider_message_id: provider_message_id.clone(),
            from: from.clone(),
            to: to.clone(),
            cc: cc.clone(),
            bcc: bcc.clone(),
            subject: subject.clone(),
            received_at: received_at.clone(),
            sanitized_html: text_to_html(&text),
            text: text.clone(),
            headers: json!({
                "provider": account.provider.as_str(),
                "uid": uid,
                "messageId": provider_message_id,
                "references": references,
                "inReplyTo": in_reply_to,
            }),
            is_outbound,
        };

        let snippet = build_snippet(&text);
        let builder = builders
            .entry(thread_id)
            .or_insert_with(|| SyncThreadBuilder {
                provider_thread_id: conversation_key.clone(),
                subject: subject.clone(),
                participants: vec![],
                unread: false,
                starred: false,
                needs_reply: false,
                snippet: snippet.clone(),
                last_message_at: received_at.clone(),
                messages: vec![],
            });

        merge_participant(&mut builder.participants, from.clone());
        for participant in to.iter().chain(cc.iter()) {
            merge_participant(&mut builder.participants, participant.clone());
        }
        builder.unread |= unread;
        builder.starred |= starred;
        if builder.last_message_at <= received_at {
            builder.subject = subject;
            builder.snippet = snippet;
            builder.last_message_at = received_at;
            builder.needs_reply = !is_outbound && message_needs_reply(&builder.subject, &text);
        }
        builder.messages.push(message);
    }

    let mut messages = Vec::new();
    let mut threads = Vec::new();
    for (thread_id, mut builder) in builders {
        builder
            .messages
            .sort_by(|left, right| left.received_at.cmp(&right.received_at));
        messages.extend(builder.messages.iter().cloned());
        threads.push(NormalizedThread {
            id: thread_id,
            account_id: account.id.clone(),
            mailbox_id: inbox_id.clone(),
            provider_thread_id: builder.provider_thread_id,
            subject: builder.subject,
            participants: builder.participants,
            unread: builder.unread,
            starred: builder.starred,
            archived: false,
            needs_reply: builder.needs_reply,
            snippet: builder.snippet,
            last_message_at: builder.last_message_at,
            message_count: builder.messages.len() as i64,
            provider_metadata: json!({
                "provider": account.provider.as_str(),
            }),
        });
    }

    Ok(SyncDelta {
        mailboxes,
        threads,
        messages,
        next_cursor: max_uid.to_string(),
    })
}

fn parse_received_at(parsed: &ParsedMail<'_>) -> Option<String> {
    let value = header_value(parsed, "Date")?;
    let timestamp = mailparse::dateparse(&value).ok()?;
    Utc.timestamp_opt(timestamp, 0)
        .single()
        .map(|value| value.to_rfc3339())
}

fn header_value(parsed: &ParsedMail<'_>, name: &str) -> Option<String> {
    parsed
        .headers
        .get_first_header(name)
        .map(|header| header.get_value())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn parse_message_ids(value: Option<String>) -> Vec<String> {
    value
        .unwrap_or_default()
        .split_whitespace()
        .map(normalize_message_id)
        .filter(|value| !value.is_empty())
        .collect()
}

fn normalize_message_id(value: &str) -> String {
    let trimmed = value.trim().trim_matches(',');
    let trimmed = trimmed.trim_start_matches('<').trim_end_matches('>');
    if trimmed.is_empty() {
        String::new()
    } else {
        format!("<{trimmed}>")
    }
}

fn parse_header_participants(parsed: &ParsedMail<'_>, name: &str) -> Vec<EmailParticipant> {
    let Some(header) = parsed.headers.get_first_header(name) else {
        return vec![];
    };
    let Ok(addresses) = addrparse_header(header) else {
        return vec![];
    };
    flatten_mail_addrs(addresses)
}

fn flatten_mail_addrs(addresses: MailAddrList) -> Vec<EmailParticipant> {
    let mut participants = Vec::new();
    for address in addresses.iter() {
        match address {
            MailAddr::Single(info) => participants.push(EmailParticipant {
                name: info.display_name.clone().unwrap_or_default(),
                email: info.addr.clone(),
            }),
            MailAddr::Group(group) => {
                for info in &group.addrs {
                    participants.push(EmailParticipant {
                        name: info.display_name.clone().unwrap_or_default(),
                        email: info.addr.clone(),
                    });
                }
            }
        }
    }
    participants
}

fn extract_message_text(parsed: &ParsedMail<'_>) -> String {
    if let Some(text) = find_first_body_part(parsed, "text/plain") {
        return text;
    }

    if let Some(html) = find_first_body_part(parsed, "text/html") {
        let stripped = strip_html_tags(&html);
        if !stripped.trim().is_empty() {
            return stripped;
        }
    }

    parsed.get_body().unwrap_or_default()
}

fn find_first_body_part(parsed: &ParsedMail<'_>, mime_type: &str) -> Option<String> {
    if parsed.ctype.mimetype.eq_ignore_ascii_case(mime_type) {
        return parsed.get_body().ok();
    }

    for part in &parsed.subparts {
        if let Some(body) = find_first_body_part(part, mime_type) {
            return Some(body);
        }
    }

    None
}

fn strip_html_tags(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut in_tag = false;
    for character in value.chars() {
        match character {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(character),
            _ => {}
        }
    }
    output
}

fn text_to_html(value: &str) -> String {
    let escaped = escape_html(value).replace("\r\n", "\n");
    let paragraphs = escaped
        .split("\n\n")
        .map(|paragraph| format!("<p>{}</p>", paragraph.replace('\n', "<br />")))
        .collect::<Vec<_>>();
    if paragraphs.is_empty() {
        "<p></p>".to_string()
    } else {
        paragraphs.join("")
    }
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn build_snippet(value: &str) -> String {
    let collapsed = value
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    let snippet = collapsed.trim();
    if snippet.len() <= 180 {
        snippet.to_string()
    } else {
        format!("{}…", &snippet[..180])
    }
}

fn message_needs_reply(subject: &str, body: &str) -> bool {
    let lower_body = body.to_lowercase();
    subject.contains('?')
        || lower_body.contains('?')
        || lower_body.contains("can you")
        || lower_body.contains("could you")
        || lower_body.contains("let me know")
        || lower_body.contains("reply")
}

fn merge_participant(participants: &mut Vec<EmailParticipant>, next: EmailParticipant) {
    if next.email.trim().is_empty() {
        return;
    }
    if participants
        .iter()
        .any(|participant| participant.email.eq_ignore_ascii_case(&next.email))
    {
        return;
    }
    participants.push(next);
}

fn has_seen_flag(flags: &[Flag<'_>]) -> bool {
    flags.iter().any(|flag| matches!(flag, Flag::Seen))
}

fn has_flagged_flag(flags: &[Flag<'_>]) -> bool {
    flags.iter().any(|flag| matches!(flag, Flag::Flagged))
}

fn stable_thread_id(account: &MailAccount, provider_thread_id: &str) -> String {
    let namespace = Uuid::new_v5(&Uuid::NAMESPACE_OID, account.id.as_bytes());
    format!(
        "thread-{}",
        Uuid::new_v5(&namespace, provider_thread_id.as_bytes())
    )
}

fn stable_message_id(account: &MailAccount, uid: u32) -> String {
    let namespace = Uuid::new_v5(&Uuid::NAMESPACE_OID, account.id.as_bytes());
    format!(
        "message-{}",
        Uuid::new_v5(&namespace, uid.to_string().as_bytes())
    )
}

fn apply_actions_impl(
    store: &Store,
    account: &MailAccount,
    actions: &[ActionRequest],
) -> Result<Vec<ActionLogEntry>, String> {
    let mut entries = Vec::new();
    for action in actions {
        store.apply_thread_action(account, &action.thread_id, &action.action)?;
        if let SuggestionAction::DraftReply = action.action {
            if let Some(draft) = &action.draft_reply {
                store.save_draft(draft)?;
            }
        }

        entries.push(store.append_action_log(
            Some(&account.id),
            Some(&action.thread_id),
            action.action.as_str(),
            &json!({
                "draftReply": action.draft_reply.is_some(),
            }),
        )?);
    }
    Ok(entries)
}

fn send_impl(store: &Store, draft: &DraftDocument) -> Result<ActionLogEntry, String> {
    store.mark_draft_sent(&draft.id)?;
    store.append_outbound_message(draft)?;
    store.append_action_log(
        Some(&draft.account_id),
        Some(&draft.thread_id),
        "send",
        &json!({
            "draftId": draft.id,
            "subject": draft.subject,
        }),
    )
}

fn sanitize_id(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect()
}

fn mailbox_id(account_id: &str, role: MailboxRole) -> String {
    format!("{account_id}-{}", role.as_str())
}
