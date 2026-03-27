import { invoke, } from "@tauri-apps/api/core";
import type {
  ActionRequest,
  AppSnapshot,
  ConnectAccountInput,
  DraftDocument,
  DraftRewriteTone,
  MailAccount,
  ThreadDetail,
} from "../types/mail";

export function bootstrapApp() {
  return invoke<AppSnapshot>("bootstrap_app");
}

export function connectAccount(input: ConnectAccountInput,) {
  return invoke<MailAccount>("connect_account", { input, });
}

export function syncAccount(accountId: string,) {
  return invoke<void>("sync_account", { accountId, });
}

export function getThreadDetail(threadId: string,) {
  return invoke<ThreadDetail>("get_thread_detail", { threadId, });
}

export function prepareReplyDraft(threadId: string,) {
  return invoke<DraftDocument>("prepare_reply_draft", { threadId, });
}

export function saveDraft(draft: DraftDocument,) {
  return invoke<DraftDocument>("save_draft_command", { draft, });
}

export function sendDraft(draftId: string,) {
  return invoke<void>("send_draft_command", { draftId, });
}

export function generateSuggestionBatch(accountId?: string,) {
  return invoke<void>("generate_ai_suggestion_batch", { accountId, });
}

export function applyActions(actions: ActionRequest[],) {
  return invoke<void>("apply_actions_command", { actions, });
}

export function rewriteDraftText(text: string, tone: DraftRewriteTone,) {
  return invoke<string>("rewrite_draft_text_command", { text, tone, });
}

