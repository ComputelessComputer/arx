import { useDeferredValue, useRef, useState, startTransition, } from "react";
import { Inbox, RefreshCcw, ShieldCheck, } from "lucide-react";
import { AiQueue, } from "./components/mail/AiQueue";
import { ComposerPanel, } from "./components/mail/ComposerPanel";
import { ConnectAccountForm, } from "./components/mail/ConnectAccountForm";
import { ThreadDetailPane, } from "./components/mail/ThreadDetailPane";
import { ThreadList, } from "./components/mail/ThreadList";
import { useMountEffect, } from "./hooks/useMountEffect";
import {
  applyActions,
  bootstrapApp,
  connectAccount,
  generateSuggestionBatch,
  getThreadDetail,
  prepareReplyDraft,
  rewriteDraftText,
  saveDraft,
  sendDraft,
  syncAccount,
} from "./lib/api";
import { buildDraftPatch, textToDoc, } from "./lib/emailEditor";
import type {
  ActionRequest,
  AppSnapshot,
  ConnectAccountInput,
  DraftDocument,
  DraftRewriteTone,
  Mailbox,
  ThreadDetail,
} from "./types/mail";

const EMPTY_SNAPSHOT: AppSnapshot = {
  accounts: [],
  mailboxes: [],
  threads: [],
  suggestionBatches: [],
};

function pickInitialMailbox(mailboxes: Mailbox[], accountId: string,) {
  return mailboxes.find((mailbox,) => mailbox.accountId === accountId && mailbox.role === "inbox",)
    ?? mailboxes.find((mailbox,) => mailbox.accountId === accountId,)
    ?? null;
}

export default function App() {
  const [snapshot, setSnapshot,] = useState<AppSnapshot>(EMPTY_SNAPSHOT,);
  const [selectedAccountId, setSelectedAccountId,] = useState<null | string>(null,);
  const [selectedMailboxId, setSelectedMailboxId,] = useState<null | string>(null,);
  const [selectedThreadId, setSelectedThreadId,] = useState<null | string>(null,);
  const [threadDetail, setThreadDetail,] = useState<null | ThreadDetail>(null,);
  const [search, setSearch,] = useState("",);
  const [busy, setBusy,] = useState(false,);
  const [error, setError,] = useState<null | string>(null,);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null,);
  const deferredSearch = useDeferredValue(search,);

  const selectedAccount = snapshot.accounts.find((account,) => account.id === selectedAccountId,) ?? null;
  const selectedMailbox = snapshot.mailboxes.find((mailbox,) => mailbox.id === selectedMailboxId,) ?? null;

  const visibleMailboxes = selectedAccountId
    ? snapshot.mailboxes.filter((mailbox,) => mailbox.accountId === selectedAccountId,)
    : [];

  const visibleThreads = snapshot.threads
    .filter((thread,) => (selectedAccountId ? thread.accountId === selectedAccountId : true),)
    .filter((thread,) => (selectedMailboxId ? thread.mailboxId === selectedMailboxId : true),)
    .filter((thread,) => {
      if (!deferredSearch.trim()) return true;
      const query = deferredSearch.trim().toLowerCase();
      return thread.subject.toLowerCase().includes(query,)
        || thread.snippet.toLowerCase().includes(query,)
        || thread.participants.some((participant,) => participant.email.toLowerCase().includes(query,));
    },)
    .sort((left, right,) => {
      const unreadSort = Number(right.unread) - Number(left.unread);
      if (unreadSort !== 0) return unreadSort;
      return right.lastMessageAt.localeCompare(left.lastMessageAt,);
    },);

  const reloadSnapshot = async (preferred?: {
    accountId?: null | string;
    mailboxId?: null | string;
    threadId?: null | string;
  },) => {
    const nextSnapshot = await bootstrapApp();
    const nextAccountId = preferred?.accountId
      ?? selectedAccountId
      ?? nextSnapshot.accounts[0]?.id
      ?? null;
    const nextMailboxId = nextAccountId
      ? preferred?.mailboxId
        ?? pickInitialMailbox(nextSnapshot.mailboxes, nextAccountId,)?.id
        ?? null
      : null;
    const nextThreadId = preferred?.threadId
      ?? nextSnapshot.threads.find((thread,) =>
        thread.accountId === nextAccountId && (!nextMailboxId || thread.mailboxId === nextMailboxId)
      )?.id
      ?? null;

    startTransition(() => {
      setSnapshot(nextSnapshot,);
      setSelectedAccountId(nextAccountId,);
      setSelectedMailboxId(nextMailboxId,);
      setSelectedThreadId(nextThreadId,);
    },);

    if (nextThreadId) {
      const detail = await getThreadDetail(nextThreadId,);
      setThreadDetail(detail,);
      return;
    }

    setThreadDetail(null,);
  };

  const withBusy = async <T,>(task: () => Promise<T>,) => {
    setBusy(true,);
    setError(null,);

    try {
      return await task();
    } catch (taskError) {
      const message = taskError instanceof Error ? taskError.message : "Something went wrong.";
      setError(message,);
      throw taskError;
    } finally {
      setBusy(false,);
    }
  };

  useMountEffect(() => {
    void withBusy(() => reloadSnapshot(),).catch(() => undefined);
  });

  const scheduleDraftSave = (draft: DraftDocument,) => {
    setThreadDetail((current,) => (current ? { ...current, draft, } : current),);

    if (saveTimer.current) {
      clearTimeout(saveTimer.current,);
    }

    saveTimer.current = setTimeout(() => {
      void saveDraft(draft,)
        .then((saved,) => {
          setThreadDetail((current,) => (current ? { ...current, draft: saved, } : current),);
        },)
        .catch((saveError,) => {
          setError(saveError instanceof Error ? saveError.message : "Draft autosave failed.",);
        },);
    }, 350,);
  };

  const handleConnectAccount = async (input: ConnectAccountInput,) => {
    await withBusy(async () => {
      const account = await connectAccount(input,);
      await reloadSnapshot({ accountId: account.id, },);
    },);
  };

  const handleSelectThread = async (threadId: string,) => {
    setSelectedThreadId(threadId,);
    await withBusy(async () => {
      const detail = await getThreadDetail(threadId,);
      setThreadDetail(detail,);
    },);
  };

  const handleThreadAction = async (threadId: string, action: ActionRequest["action"],) => {
    await withBusy(async () => {
      await applyActions([{
        accountId: selectedAccountId,
        threadId,
        action,
        draftReply: null,
      },],);
      await reloadSnapshot({ accountId: selectedAccountId, mailboxId: selectedMailboxId, threadId, },);
    },);
  };

  const handleOpenReply = async (threadId: string,) => {
    await withBusy(async () => {
      const draft = await prepareReplyDraft(threadId,);
      setThreadDetail((current,) => (current ? { ...current, draft, } : current),);
    },);
  };

  const handleRewriteDraft = async (tone: DraftRewriteTone,) => {
    const draft = threadDetail?.draft;
    if (!draft) return;

    await withBusy(async () => {
      const rewritten = await rewriteDraftText(draft.text, tone,);
      scheduleDraftSave(buildDraftPatch(draft, {
        tiptapJson: textToDoc(rewritten,),
      },),);
    },);
  };

  const handleSendDraft = async () => {
    const draft = threadDetail?.draft;
    if (!draft) return;

    await withBusy(async () => {
      const saved = await saveDraft(draft,);
      await sendDraft(saved.id,);
      await reloadSnapshot({
        accountId: selectedAccountId,
        mailboxId: selectedMailboxId,
        threadId: threadDetail.thread.id,
      },);
    },);
  };

  const handleGenerateBatch = async () => {
    await withBusy(async () => {
      await generateSuggestionBatch(selectedAccountId ?? undefined,);
      await reloadSnapshot({
        accountId: selectedAccountId,
        mailboxId: selectedMailboxId,
        threadId: selectedThreadId,
      },);
    },);
  };

  const handleApplySelectedSuggestions = async (suggestionIds: string[],) => {
    const latestBatch = snapshot.suggestionBatches[0];
    if (!latestBatch) return;

    const selectedSuggestions = latestBatch.suggestions.filter((suggestion,) => suggestionIds.includes(suggestion.id,));
    await withBusy(async () => {
      await applyActions(
        selectedSuggestions.map((suggestion,) => ({
          accountId: suggestion.accountId,
          threadId: suggestion.threadId,
          action: suggestion.action,
          draftReply: suggestion.draftReply,
        }),),
      );
      await reloadSnapshot({
        accountId: selectedAccountId,
        mailboxId: selectedMailboxId,
        threadId: selectedThreadId,
      },);
    },);
  };

  const handleSyncAccount = async () => {
    if (!selectedAccountId) return;

    await withBusy(async () => {
      await syncAccount(selectedAccountId,);
      await reloadSnapshot({
        accountId: selectedAccountId,
        mailboxId: selectedMailboxId,
        threadId: selectedThreadId,
      },);
    },);
  };

  const accountStatus = selectedAccount
    ? `${selectedAccount.provider.toUpperCase()} • ${selectedAccount.email}`
    : "No account connected";

  return (
    <main className="arx-app-shell">
      <aside className="arx-sidebar">
        <div className="arx-brand-block">
          <div>
            <p className="arx-eyebrow">Arx</p>
            <h1>AI inbox control room</h1>
          </div>
          <p className="arx-muted">
            Tauri desktop shell, normalized mail cache, explicit AI review queue, and a Tiptap reply surface.
          </p>
        </div>

        <div className="arx-panel arx-sidebar-panel">
          <div className="arx-panel-header">
            <div>
              <p className="arx-eyebrow">Account</p>
              <h2>{accountStatus}</h2>
            </div>
            <button type="button" className="arx-button" onClick={() => void handleSyncAccount()} disabled={!selectedAccountId || busy}>
              <RefreshCcw size={16} />
              Sync
            </button>
          </div>

          <div className="arx-account-list">
            {snapshot.accounts.map((account,) => (
              <button
                key={account.id}
                type="button"
                className={`arx-account-card ${selectedAccountId === account.id ? "arx-account-card-active" : ""}`}
                onClick={() => {
                  const nextMailbox = pickInitialMailbox(snapshot.mailboxes, account.id,);
                  setSelectedAccountId(account.id,);
                  setSelectedMailboxId(nextMailbox?.id ?? null,);
                  void reloadSnapshot({ accountId: account.id, mailboxId: nextMailbox?.id ?? null, },);
                }}
              >
                <div>
                  <strong>{account.displayName}</strong>
                  <p>{account.email}</p>
                </div>
                <ShieldCheck size={16} />
              </button>
            ),)}
          </div>

          {visibleMailboxes.length > 0 ? (
            <div className="arx-mailbox-list">
              {visibleMailboxes.map((mailbox,) => (
                <button
                  key={mailbox.id}
                  type="button"
                  className={`arx-mailbox-item ${selectedMailbox?.id === mailbox.id ? "arx-mailbox-item-active" : ""}`}
                  onClick={() => setSelectedMailboxId(mailbox.id,)}
                >
                  <span>{mailbox.name}</span>
                  <span className="arx-pill">{mailbox.unreadCount}</span>
                </button>
              ),)}
            </div>
          ) : null}
        </div>

        <ConnectAccountForm busy={busy} onSubmit={handleConnectAccount} />
      </aside>

      <section className="arx-main-grid">
        <header className="arx-toolbar">
          <div className="arx-search">
            <Inbox size={16} />
            <input
              value={search}
              onChange={(event,) => setSearch(event.target.value,)}
              placeholder="Search subjects, snippets, or participants"
            />
          </div>
          {error ? <p className="arx-error-banner">{error}</p> : null}
        </header>

        <div className="arx-content-grid">
          <ThreadList threads={visibleThreads} selectedThreadId={selectedThreadId} onSelect={(threadId,) => void handleSelectThread(threadId,)} />
          <ThreadDetailPane
            capabilities={selectedAccount?.capabilities ?? null}
            detail={threadDetail}
            onAction={handleThreadAction}
            onReply={handleOpenReply}
          />
          <div className="arx-right-rail">
            <AiQueue
              batches={snapshot.suggestionBatches}
              busy={busy}
              onGenerate={handleGenerateBatch}
              onApply={handleApplySelectedSuggestions}
            />
            <ComposerPanel
              draft={threadDetail?.draft ?? null}
              busy={busy}
              onChange={scheduleDraftSave}
              onRewrite={handleRewriteDraft}
              onSend={handleSendDraft}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
