use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProviderKind {
    Gmail,
    Outlook,
    Imap,
}

impl ProviderKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Gmail => "gmail",
            Self::Outlook => "outlook",
            Self::Imap => "imap",
        }
    }

    pub fn from_db(value: &str) -> Result<Self, String> {
        match value {
            "gmail" => Ok(Self::Gmail),
            "outlook" => Ok(Self::Outlook),
            "imap" => Ok(Self::Imap),
            other => Err(format!("Unknown provider kind: {other}")),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    Openai,
    Anthropic,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MailboxRole {
    Inbox,
    Archive,
    Sent,
    Drafts,
    Custom,
}

impl MailboxRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Inbox => "inbox",
            Self::Archive => "archive",
            Self::Sent => "sent",
            Self::Drafts => "drafts",
            Self::Custom => "custom",
        }
    }

    pub fn from_db(value: &str) -> Result<Self, String> {
        match value {
            "inbox" => Ok(Self::Inbox),
            "archive" => Ok(Self::Archive),
            "sent" => Ok(Self::Sent),
            "drafts" => Ok(Self::Drafts),
            "custom" => Ok(Self::Custom),
            other => Err(format!("Unknown mailbox role: {other}")),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DraftStatus {
    Draft,
    Sent,
}

impl DraftStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Sent => "sent",
        }
    }

    pub fn from_db(value: &str) -> Result<Self, String> {
        match value {
            "draft" => Ok(Self::Draft),
            "sent" => Ok(Self::Sent),
            other => Err(format!("Unknown draft status: {other}")),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DraftRewriteTone {
    Shorter,
    Professional,
    Friendly,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SuggestionAction {
    Archive,
    MarkRead,
    MarkUnread,
    Star,
    MoveToInbox,
    DraftReply,
}

impl SuggestionAction {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Archive => "archive",
            Self::MarkRead => "markRead",
            Self::MarkUnread => "markUnread",
            Self::Star => "star",
            Self::MoveToInbox => "moveToInbox",
            Self::DraftReply => "draftReply",
        }
    }

    pub fn from_db(value: &str) -> Result<Self, String> {
        match value {
            "archive" => Ok(Self::Archive),
            "markRead" => Ok(Self::MarkRead),
            "markUnread" => Ok(Self::MarkUnread),
            "star" => Ok(Self::Star),
            "moveToInbox" => Ok(Self::MoveToInbox),
            "draftReply" => Ok(Self::DraftReply),
            other => Err(format!("Unknown suggestion action: {other}")),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailParticipant {
    pub name: String,
    pub email: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCapabilities {
    pub archive: bool,
    pub star: bool,
    pub move_to_inbox: bool,
    pub send_html: bool,
    pub thread_view: bool,
    pub attachments_read: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    pub provider: AiProvider,
    pub openai_api_key: String,
    pub anthropic_api_key: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MailAccount {
    pub id: String,
    pub provider: ProviderKind,
    pub display_name: String,
    pub email: String,
    pub capabilities: ProviderCapabilities,
    pub connected_at: String,
    pub last_synced_at: Option<String>,
    pub archive_mailbox: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Mailbox {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub role: MailboxRole,
    pub unread_count: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedThread {
    pub id: String,
    pub account_id: String,
    pub mailbox_id: String,
    pub provider_thread_id: String,
    pub subject: String,
    pub participants: Vec<EmailParticipant>,
    pub unread: bool,
    pub starred: bool,
    pub archived: bool,
    pub needs_reply: bool,
    pub snippet: String,
    pub last_message_at: String,
    pub message_count: i64,
    pub provider_metadata: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedMessage {
    pub id: String,
    pub thread_id: String,
    pub account_id: String,
    pub provider_message_id: String,
    pub from: EmailParticipant,
    pub to: Vec<EmailParticipant>,
    pub cc: Vec<EmailParticipant>,
    pub bcc: Vec<EmailParticipant>,
    pub subject: String,
    pub received_at: String,
    pub sanitized_html: String,
    pub text: String,
    pub headers: Value,
    pub is_outbound: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftDocument {
    pub id: String,
    pub thread_id: String,
    pub account_id: String,
    pub subject: String,
    pub to: Vec<EmailParticipant>,
    pub cc: Vec<EmailParticipant>,
    pub bcc: Vec<EmailParticipant>,
    pub in_reply_to: Option<String>,
    pub references: Vec<String>,
    pub tiptap_json: Value,
    pub html: String,
    pub text: String,
    pub status: DraftStatus,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Suggestion {
    pub id: String,
    pub batch_id: String,
    pub account_id: String,
    pub thread_id: String,
    pub action: SuggestionAction,
    pub summary: String,
    pub reason: String,
    pub confidence: f64,
    pub selected: bool,
    pub draft_reply: Option<DraftDocument>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AISuggestionBatch {
    pub id: String,
    pub summary: String,
    pub created_at: String,
    pub account_id: Option<String>,
    pub suggestions: Vec<Suggestion>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadDetail {
    pub thread: NormalizedThread,
    pub messages: Vec<NormalizedMessage>,
    pub draft: Option<DraftDocument>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    pub accounts: Vec<MailAccount>,
    pub mailboxes: Vec<Mailbox>,
    pub threads: Vec<NormalizedThread>,
    pub suggestion_batches: Vec<AISuggestionBatch>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImapConnectionInput {
    pub imap_host: String,
    pub imap_port: u16,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub username: String,
    pub password: String,
    pub archive_mailbox: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconnectImapSettings {
    pub imap_host: String,
    pub imap_port: u16,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub username: String,
    pub archive_mailbox: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountReconnectDraft {
    pub account_id: String,
    pub provider: ProviderKind,
    pub display_name: String,
    pub email: String,
    pub imap: Option<ReconnectImapSettings>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectAccountInput {
    pub provider: ProviderKind,
    pub display_name: String,
    pub email: String,
    pub imap: Option<ImapConnectionInput>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionRequest {
    pub account_id: Option<String>,
    pub thread_id: String,
    pub action: SuggestionAction,
    pub draft_reply: Option<DraftDocument>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionLogEntry {
    pub id: String,
    pub account_id: Option<String>,
    pub thread_id: Option<String>,
    pub action: String,
    pub detail: Value,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncDelta {
    pub mailboxes: Vec<Mailbox>,
    pub threads: Vec<NormalizedThread>,
    pub messages: Vec<NormalizedMessage>,
    pub next_cursor: String,
}

#[derive(Clone, Debug)]
pub struct ProviderConnection {
    pub account: MailAccount,
}
