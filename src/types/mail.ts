import type { JSONContent, } from "@tiptap/core";

export type ProviderKind = "gmail" | "outlook" | "imap";
export type MailboxRole = "inbox" | "archive" | "sent" | "drafts" | "custom";
export type DraftStatus = "draft" | "sent";
export type DraftRewriteTone = "shorter" | "professional" | "friendly";
export type SuggestionAction =
  | "archive"
  | "markRead"
  | "markUnread"
  | "star"
  | "moveToInbox"
  | "draftReply";

export interface EmailParticipant {
  name: string;
  email: string;
}

export interface ProviderCapabilities {
  archive: boolean;
  star: boolean;
  moveToInbox: boolean;
  sendHtml: boolean;
  threadView: boolean;
  attachmentsRead: boolean;
}

export interface MailAccount {
  id: string;
  provider: ProviderKind;
  displayName: string;
  email: string;
  capabilities: ProviderCapabilities;
  connectedAt: string;
  lastSyncedAt: null | string;
  archiveMailbox: null | string;
}

export interface Mailbox {
  id: string;
  accountId: string;
  name: string;
  role: MailboxRole;
  unreadCount: number;
}

export interface NormalizedThread {
  id: string;
  accountId: string;
  mailboxId: string;
  providerThreadId: string;
  subject: string;
  participants: EmailParticipant[];
  unread: boolean;
  starred: boolean;
  archived: boolean;
  needsReply: boolean;
  snippet: string;
  lastMessageAt: string;
  messageCount: number;
  providerMetadata: Record<string, unknown>;
}

export interface NormalizedMessage {
  id: string;
  threadId: string;
  accountId: string;
  providerMessageId: string;
  from: EmailParticipant;
  to: EmailParticipant[];
  cc: EmailParticipant[];
  bcc: EmailParticipant[];
  subject: string;
  receivedAt: string;
  sanitizedHtml: string;
  text: string;
  headers: Record<string, unknown>;
  isOutbound: boolean;
}

export interface DraftDocument {
  id: string;
  threadId: string;
  accountId: string;
  subject: string;
  to: EmailParticipant[];
  cc: EmailParticipant[];
  bcc: EmailParticipant[];
  inReplyTo: null | string;
  references: string[];
  tiptapJson: JSONContent;
  html: string;
  text: string;
  status: DraftStatus;
  updatedAt: string;
}

export interface Suggestion {
  id: string;
  batchId: string;
  accountId: string;
  threadId: string;
  action: SuggestionAction;
  summary: string;
  reason: string;
  confidence: number;
  selected: boolean;
  draftReply: DraftDocument | null;
}

export interface AISuggestionBatch {
  id: string;
  summary: string;
  createdAt: string;
  accountId: null | string;
  suggestions: Suggestion[];
}

export interface ThreadDetail {
  thread: NormalizedThread;
  messages: NormalizedMessage[];
  draft: DraftDocument | null;
}

export interface AppSnapshot {
  accounts: MailAccount[];
  mailboxes: Mailbox[];
  threads: NormalizedThread[];
  suggestionBatches: AISuggestionBatch[];
}

export interface ImapConnectionInput {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  archiveMailbox: null | string;
}

export interface ConnectAccountInput {
  provider: ProviderKind;
  displayName: string;
  email: string;
  imap: ImapConnectionInput | null;
}

export interface ActionRequest {
  accountId: null | string;
  threadId: string;
  action: SuggestionAction;
  draftReply: DraftDocument | null;
}

