use crate::models::{
    ActionLogEntry, ActionRequest, ConnectAccountInput, DraftDocument, EmailParticipant, MailAccount,
    Mailbox, MailboxRole, NormalizedMessage, NormalizedThread, ProviderCapabilities, ProviderConnection,
    ProviderKind, SuggestionAction, SyncDelta, ThreadDetail,
};
use crate::security;
use crate::store::{now_iso, Store};
use serde_json::json;
use uuid::Uuid;

#[allow(dead_code)]
pub trait MailProviderAdapter {
    fn provider_kind(&self) -> ProviderKind;
    fn connect(&self, store: &Store, input: &ConnectAccountInput) -> Result<ProviderConnection, String>;
    fn refresh_auth(&self, account: &MailAccount) -> Result<(), String>;
    fn list_mailboxes(&self, account: &MailAccount) -> Result<Vec<Mailbox>, String>;
    fn sync_delta(&self, account: &MailAccount, cursor: Option<&str>) -> Result<SyncDelta, String>;
    fn list_threads(&self, store: &Store, account_id: &str) -> Result<Vec<NormalizedThread>, String>;
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

    fn connect(&self, store: &Store, input: &ConnectAccountInput) -> Result<ProviderConnection, String> {
        connect_account_impl(store, self, input)
    }

    fn refresh_auth(&self, account: &MailAccount) -> Result<(), String> {
        refresh_auth_impl(account)
    }

    fn list_mailboxes(&self, account: &MailAccount) -> Result<Vec<Mailbox>, String> {
        Ok(default_mailboxes(account, true))
    }

    fn sync_delta(&self, account: &MailAccount, cursor: Option<&str>) -> Result<SyncDelta, String> {
        build_demo_sync(self.provider_kind(), account, cursor)
    }

    fn list_threads(&self, store: &Store, account_id: &str) -> Result<Vec<NormalizedThread>, String> {
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

    fn get_capabilities(&self, _: Option<&ConnectAccountInput>) -> ProviderCapabilities {
        ProviderCapabilities {
            archive: true,
            star: true,
            move_to_inbox: true,
            send_html: true,
            thread_view: true,
            attachments_read: true,
        }
    }
}

impl MailProviderAdapter for OutlookAdapter {
    fn provider_kind(&self) -> ProviderKind {
        ProviderKind::Outlook
    }

    fn connect(&self, store: &Store, input: &ConnectAccountInput) -> Result<ProviderConnection, String> {
        connect_account_impl(store, self, input)
    }

    fn refresh_auth(&self, account: &MailAccount) -> Result<(), String> {
        refresh_auth_impl(account)
    }

    fn list_mailboxes(&self, account: &MailAccount) -> Result<Vec<Mailbox>, String> {
        Ok(default_mailboxes(account, true))
    }

    fn sync_delta(&self, account: &MailAccount, cursor: Option<&str>) -> Result<SyncDelta, String> {
        build_demo_sync(self.provider_kind(), account, cursor)
    }

    fn list_threads(&self, store: &Store, account_id: &str) -> Result<Vec<NormalizedThread>, String> {
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

    fn get_capabilities(&self, _: Option<&ConnectAccountInput>) -> ProviderCapabilities {
        ProviderCapabilities {
            archive: true,
            star: true,
            move_to_inbox: true,
            send_html: true,
            thread_view: true,
            attachments_read: true,
        }
    }
}

impl MailProviderAdapter for ImapAdapter {
    fn provider_kind(&self) -> ProviderKind {
        ProviderKind::Imap
    }

    fn connect(&self, store: &Store, input: &ConnectAccountInput) -> Result<ProviderConnection, String> {
        connect_account_impl(store, self, input)
    }

    fn refresh_auth(&self, account: &MailAccount) -> Result<(), String> {
        refresh_auth_impl(account)
    }

    fn list_mailboxes(&self, account: &MailAccount) -> Result<Vec<Mailbox>, String> {
        Ok(default_mailboxes(account, account.archive_mailbox.is_some()))
    }

    fn sync_delta(&self, account: &MailAccount, cursor: Option<&str>) -> Result<SyncDelta, String> {
        build_demo_sync(self.provider_kind(), account, cursor)
    }

    fn list_threads(&self, store: &Store, account_id: &str) -> Result<Vec<NormalizedThread>, String> {
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
        let archive_enabled = input
            .and_then(|item| item.imap.as_ref())
            .and_then(|imap| imap.archive_mailbox.as_ref())
            .map(|mailbox| !mailbox.trim().is_empty())
            .unwrap_or(false);

        ProviderCapabilities {
            archive: archive_enabled,
            star: true,
            move_to_inbox: true,
            send_html: true,
            thread_view: true,
            attachments_read: true,
        }
    }
}

fn connect_account_impl<A: MailProviderAdapter>(
    store: &Store,
    adapter: &A,
    input: &ConnectAccountInput,
) -> Result<ProviderConnection, String> {
    let capabilities = adapter.get_capabilities(Some(input));
    let email = input.email.trim().to_lowercase();
    let account = MailAccount {
        id: format!("{}-{}", adapter.provider_kind().as_str(), sanitize_id(&email)),
        provider: adapter.provider_kind(),
        display_name: input.display_name.trim().to_string(),
        email: email.clone(),
        capabilities,
        connected_at: now_iso(),
        last_synced_at: None,
        archive_mailbox: input
            .imap
            .as_ref()
            .and_then(|imap| imap.archive_mailbox.clone()),
    };
    let settings = if let Some(imap) = &input.imap {
        json!({
            "imapHost": imap.imap_host,
            "imapPort": imap.imap_port,
            "smtpHost": imap.smtp_host,
            "smtpPort": imap.smtp_port,
            "username": imap.username,
            "archiveMailbox": imap.archive_mailbox,
        })
    } else {
        json!({
            "oauth": true,
            "provider": adapter.provider_kind().as_str(),
        })
    };
    let secret = if let Some(imap) = &input.imap {
        json!({
            "password": imap.password,
        })
    } else {
        json!({
            "status": "oauth-pending",
            "provider": adapter.provider_kind().as_str(),
        })
    };

    store.upsert_account(&account, &settings)?;
    security::store_account_secret(&account.id, &secret)?;

    Ok(ProviderConnection {
        account,
    })
}

fn refresh_auth_impl(account: &MailAccount) -> Result<(), String> {
    security::read_account_secret(&account.id).map(|_| ())
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

fn build_demo_sync(
    provider: ProviderKind,
    account: &MailAccount,
    cursor: Option<&str>,
) -> Result<SyncDelta, String> {
    let mailboxes = default_mailboxes(account, account.capabilities.archive);
    let inbox_id = mailbox_id(&account.id, MailboxRole::Inbox);
    let archive_id = mailbox_id(&account.id, MailboxRole::Archive);
    let cursor_value = cursor.and_then(|value| value.parse::<u32>().ok()).unwrap_or(0);
    let next_cursor = cursor_value + 1;
    let provider_label = provider.as_str().to_uppercase();

    let mut threads = vec![
        build_thread(
            account,
            &inbox_id,
            &format!("{} weekly digest", provider_label),
            &EmailParticipant {
                name: format!("{provider_label} Updates"),
                email: format!("digest@{}.example", provider.as_str()),
            },
            "A low-signal summary email that is a good archive candidate.",
            false,
            false,
            true,
            1,
            json!({"category": "digest", "provider": provider.as_str(), "cursor": next_cursor}),
        ),
        build_thread(
            account,
            &inbox_id,
            "Can you send the revised proposal by Friday?",
            &EmailParticipant {
                name: "Maya Patel".to_string(),
                email: "maya@contoso.example".to_string(),
            },
            "A teammate asked for a revised proposal and expects a reply this week.",
            true,
            false,
            false,
            2,
            json!({"category": "needsReply", "provider": provider.as_str()}),
        ),
        build_thread(
            account,
            &inbox_id,
            "Receipt for your March subscription",
            &EmailParticipant {
                name: "Billing".to_string(),
                email: "billing@example-payments.test".to_string(),
            },
            "This message is informational and can usually be archived after review.",
            false,
            false,
            false,
            1,
            json!({"category": "receipt", "provider": provider.as_str()}),
        ),
    ];

    if cursor_value > 0 {
        threads.push(build_thread(
            account,
            &inbox_id,
            &format!("Follow-up from sync cycle #{next_cursor}"),
            &EmailParticipant {
                name: "Elena Ruiz".to_string(),
                email: "elena@northstar.example".to_string(),
            },
            "A fresh thread added during incremental sync so the local cache keeps changing.",
            true,
            false,
            false,
            1,
            json!({"category": "incremental", "provider": provider.as_str(), "cursor": next_cursor}),
        ));
    }

    let mut messages = Vec::new();
    for thread in &threads {
        let sender = thread
            .participants
            .first()
            .cloned()
            .unwrap_or(EmailParticipant {
                name: "Unknown".to_string(),
                email: "unknown@example.com".to_string(),
            });
        let inbound = build_message(account, thread, &sender, false, &thread.snippet);
        messages.push(inbound.clone());

        if thread.needs_reply {
            messages.push(build_message(
                account,
                thread,
                &EmailParticipant {
                    name: account.display_name.clone(),
                    email: account.email.clone(),
                },
                true,
                "Quick note: I saw this and will send the update tomorrow morning.",
            ));
        }

        if thread.archived && account.capabilities.archive {
            messages.push(build_message(
                account,
                &NormalizedThread {
                    mailbox_id: archive_id.clone(),
                    ..thread.clone()
                },
                &sender,
                false,
                &thread.snippet,
            ));
        }
    }

    Ok(SyncDelta {
        mailboxes,
        threads,
        messages,
        next_cursor: next_cursor.to_string(),
    })
}

fn build_thread(
    account: &MailAccount,
    mailbox_id: &str,
    subject: &str,
    sender: &EmailParticipant,
    body: &str,
    unread: bool,
    starred: bool,
    archived: bool,
    message_count: i64,
    provider_metadata: serde_json::Value,
) -> NormalizedThread {
    let id = format!("thread-{}", Uuid::new_v4());
    NormalizedThread {
        id: id.clone(),
        account_id: account.id.clone(),
        mailbox_id: mailbox_id.to_string(),
        provider_thread_id: id,
        subject: subject.to_string(),
        participants: vec![sender.clone(), EmailParticipant {
            name: account.display_name.clone(),
            email: account.email.clone(),
        }],
        unread,
        starred,
        archived,
        needs_reply: subject.contains('?') || body.to_lowercase().contains("reply"),
        snippet: body.to_string(),
        last_message_at: now_iso(),
        message_count,
        provider_metadata,
    }
}

fn build_message(
    account: &MailAccount,
    thread: &NormalizedThread,
    sender: &EmailParticipant,
    is_outbound: bool,
    body: &str,
) -> NormalizedMessage {
    let received_at = now_iso();
    let html = format!(
        "<p>{}</p><p>{}</p>",
        if is_outbound {
            "Outgoing message"
        } else {
            &thread.subject
        },
        body.replace('\n', "<br />")
    );
    NormalizedMessage {
        id: format!("message-{}", Uuid::new_v4()),
        thread_id: thread.id.clone(),
        account_id: account.id.clone(),
        provider_message_id: format!("provider-msg-{}", Uuid::new_v4()),
        from: sender.clone(),
        to: vec![EmailParticipant {
            name: account.display_name.clone(),
            email: account.email.clone(),
        }],
        cc: vec![],
        bcc: vec![],
        subject: thread.subject.clone(),
        received_at,
        sanitized_html: html,
        text: body.to_string(),
        headers: json!({
            "provider": account.provider.as_str(),
            "thread": thread.provider_thread_id,
        }),
        is_outbound,
    }
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
        .map(|character| if character.is_ascii_alphanumeric() { character } else { '-' })
        .collect()
}

fn mailbox_id(account_id: &str, role: MailboxRole) -> String {
    format!("{account_id}-{}", role.as_str())
}
