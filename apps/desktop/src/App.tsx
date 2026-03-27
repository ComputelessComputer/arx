import { useDeferredValue, useRef, useState, } from "react";
import { Check, ListFilter, RefreshCcw, Settings2, } from "lucide-react";
import { SettingsView, } from "./components/mail/SettingsView";
import { ThreadList, } from "./components/mail/ThreadList";
import { useMountEffect, } from "./hooks/useMountEffect";
import {
  bootstrapApp,
  connectAccount,
  loadAiSettings,
  saveAiSettings,
  syncAccount,
} from "./lib/api";
import type {
  AiSettings,
  AppSnapshot,
  ConnectAccountInput,
  MailAccount,
} from "./types/mail";

const EMPTY_SNAPSHOT: AppSnapshot = {
  accounts: [],
  mailboxes: [],
  threads: [],
  suggestionBatches: [],
};

const EMPTY_AI_SETTINGS: AiSettings = {
  provider: "openai",
  openaiApiKey: "",
  anthropicApiKey: "",
};

type InboxFilter = "all" | "filtered" | "unread";

const filterOptions: Array<{ label: string; value: InboxFilter; }> = [
  { value: "all", label: "All", },
  { value: "unread", label: "Unread", },
  { value: "filtered", label: "Filtered", },
];

const BACKGROUND_SYNC_INTERVAL_MS = 60_000;
const BACKGROUND_SYNC_STALE_AFTER_MS = 45_000;

function hasActiveAiKey(settings: AiSettings,) {
  if (settings.provider === "anthropic") {
    return settings.anthropicApiKey.trim().length > 0;
  }

  return settings.openaiApiKey.trim().length > 0;
}

function getErrorMessage(error: unknown, fallback: string,) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

function shouldSyncInBackground(snapshot: AppSnapshot,) {
  if (snapshot.accounts.length === 0) return false;

  return snapshot.accounts.some((account,) => {
    if (!account.lastSyncedAt) return true;
    const lastSyncedAt = Date.parse(account.lastSyncedAt,);
    if (Number.isNaN(lastSyncedAt,)) return true;
    return Date.now() - lastSyncedAt >= BACKGROUND_SYNC_STALE_AFTER_MS;
  },);
}

export default function App() {
  const showWindowBar = navigator.userAgent.includes("Mac",);
  const [snapshot, setSnapshot,] = useState<AppSnapshot>(EMPTY_SNAPSHOT,);
  const [aiSettings, setAiSettings,] = useState<AiSettings>(EMPTY_AI_SETTINGS,);
  const [search, setSearch,] = useState("",);
  const [filter, setFilter,] = useState<InboxFilter>("all",);
  const [busy, setBusy,] = useState(false,);
  const [syncing, setSyncing,] = useState(false,);
  const [error, setError,] = useState<null | string>(null,);
  const [settingsOpen, setSettingsOpen,] = useState(false,);
  const [filterMenuOpen, setFilterMenuOpen,] = useState(false,);
  const deferredSearch = useDeferredValue(search,);
  const filterMenuRef = useRef<HTMLDivElement>(null,);
  const filterMenuOpenRef = useRef(false,);
  const snapshotRef = useRef<AppSnapshot>(EMPTY_SNAPSHOT,);
  const syncingRef = useRef(false,);

  filterMenuOpenRef.current = filterMenuOpen;
  snapshotRef.current = snapshot;

  const aiReady = hasActiveAiKey(aiSettings,);
  const showOnboarding = snapshot.accounts.length === 0;
  const onboardingSteps = [
    {
      complete: snapshot.accounts.length > 0,
      title: "Connect your first inbox",
      description: "Add Gmail, Outlook, or IMAP in Settings.",
    },
    {
      complete: aiReady,
      title: "Add an AI key",
      description: "Optional. Unlocks the Filtered view.",
    },
  ];
  const accountEmailsById = Object.fromEntries(snapshot.accounts.map((account,) => [account.id, account.email],),);
  const inboxMailboxIds = new Set(
    snapshot.mailboxes
      .filter((mailbox,) => mailbox.role === "inbox",)
      .map((mailbox,) => mailbox.id,),
  );

  const visibleThreads = snapshot.threads
    .filter((thread,) => inboxMailboxIds.has(thread.mailboxId,),)
    .filter((thread,) => {
      if (filter === "unread") return thread.unread;
      if (filter === "filtered") return thread.needsReply;
      return true;
    },)
    .filter((thread,) => {
      if (!deferredSearch.trim()) return true;
      const query = deferredSearch.trim().toLowerCase();
      return thread.subject.toLowerCase().includes(query,)
        || thread.snippet.toLowerCase().includes(query,)
        || thread.participants.some((participant,) => {
          const name = participant.name.toLowerCase();
          const email = participant.email.toLowerCase();
          return name.includes(query,) || email.includes(query,);
        },);
    },)
    .sort((left, right,) => {
      const unreadSort = Number(right.unread) - Number(left.unread);
      if (unreadSort !== 0) return unreadSort;
      return right.lastMessageAt.localeCompare(left.lastMessageAt,);
    },);

  const withBusy = async <T,>(task: () => Promise<T>,) => {
    setBusy(true,);
    setError(null,);

    try {
      return await task();
    } catch (taskError) {
      const message = getErrorMessage(taskError, "Something went wrong.",);
      setError(message,);
      throw taskError;
    } finally {
      setBusy(false,);
    }
  };

  const reload = async () => {
    const [nextSnapshot, nextAiSettings,] = await Promise.all([bootstrapApp(), loadAiSettings(),]);
    setSnapshot(nextSnapshot,);
    setAiSettings(nextAiSettings,);
    if (filter === "filtered" && !hasActiveAiKey(nextAiSettings,)) {
      setFilter("all",);
    }

    return { nextAiSettings, nextSnapshot, };
  };

  const runSync = async (
    {
      accounts = snapshotRef.current.accounts,
      silent = false,
    }: {
      accounts?: MailAccount[];
      silent?: boolean;
    } = {},
  ) => {
    if (syncingRef.current || accounts.length === 0) return false;

    syncingRef.current = true;
    setSyncing(true,);
    if (!silent) {
      setError(null,);
    }

    try {
      for (const account of accounts) {
        await syncAccount(account.id,);
      }
      await reload();
      return true;
    } catch (taskError) {
      if (silent) {
        console.error("Background sync failed:", taskError,);
      } else {
        setError(getErrorMessage(taskError, "Something went wrong.",),);
      }
      return false;
    } finally {
      syncingRef.current = false;
      setSyncing(false,);
    }
  };

  useMountEffect(() => {
    void (async () => {
      const result = await withBusy(reload,).catch(() => null);
      if (result && shouldSyncInBackground(result.nextSnapshot,)) {
        void runSync({ accounts: result.nextSnapshot.accounts, silent: true, });
      }
    })();
  });

  useMountEffect(() => {
    const handleKeyDown = (event: KeyboardEvent,) => {
      if (
        !event.metaKey
        || event.ctrlKey
        || event.altKey
        || event.shiftKey
        || event.key !== ","
      ) {
        return;
      }

      event.preventDefault();
      setSettingsOpen(true,);
    };

    window.addEventListener("keydown", handleKeyDown,);
    return () => window.removeEventListener("keydown", handleKeyDown,);
  });

  useMountEffect(() => {
    const handlePointerDown = (event: MouseEvent,) => {
      if (
        filterMenuOpenRef.current
        && !filterMenuRef.current?.contains(event.target as Node,)
      ) {
        setFilterMenuOpen(false,);
      }
    };

    const handleEscape = (event: KeyboardEvent,) => {
      if (event.key === "Escape" && filterMenuOpenRef.current) {
        setFilterMenuOpen(false,);
      }
    };

    window.addEventListener("mousedown", handlePointerDown,);
    window.addEventListener("keydown", handleEscape,);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown,);
      window.removeEventListener("keydown", handleEscape,);
    };
  });

  useMountEffect(() => {
    const maybeSyncInBackground = () => {
      if (document.visibilityState === "hidden") return;
      const nextSnapshot = snapshotRef.current;
      if (!shouldSyncInBackground(nextSnapshot,)) return;
      void runSync({ silent: true, });
    };

    const intervalId = window.setInterval(maybeSyncInBackground, BACKGROUND_SYNC_INTERVAL_MS,);
    window.addEventListener("focus", maybeSyncInBackground,);
    window.addEventListener("online", maybeSyncInBackground,);
    document.addEventListener("visibilitychange", maybeSyncInBackground,);

    return () => {
      window.clearInterval(intervalId,);
      window.removeEventListener("focus", maybeSyncInBackground,);
      window.removeEventListener("online", maybeSyncInBackground,);
      document.removeEventListener("visibilitychange", maybeSyncInBackground,);
    };
  });

  const handleConnectAccount = async (input: ConnectAccountInput,) => {
    await withBusy(async () => {
      await connectAccount(input,);
      await reload();
    },);
  };

  const handleSaveAiSettings = async () => {
    await withBusy(async () => {
      const saved = await saveAiSettings(aiSettings,);
      setAiSettings(saved,);
      if (filter === "filtered" && !hasActiveAiKey(saved,)) {
        setFilter("all",);
      }
      setSettingsOpen(false,);
    },);
  };

  const handleSync = async () => {
    await runSync();
  };

  const emptyMessage = snapshot.accounts.length === 0
    ? "Open settings to connect an account."
    : filter === "filtered"
      ? "No filtered mail matches this view."
      : "No received mail matches this view.";
  const activeFilterLabel = filterOptions.find((option,) => option.value === filter,)?.label ?? "All";
  const handleHomeWheel = (event: React.WheelEvent<HTMLDivElement>,) => {
    const element = event.currentTarget;
    const maxScrollTop = element.scrollHeight - element.clientHeight;

    if (
      (event.deltaY < 0 && element.scrollTop <= 0)
      || (event.deltaY > 0 && element.scrollTop >= maxScrollTop - 1)
    ) {
      event.preventDefault();
    }
  };

  return (
    <>
      <main className={`arx-app ${showWindowBar ? "arx-app-mac" : ""}`}>
        {showWindowBar ? (
          <div className="arx-window-bar" data-tauri-drag-region>
            <div className="arx-window-bar-spacer" />
            <div className="arx-window-bar-center" />
            <div className="arx-window-bar-actions">
              <div ref={filterMenuRef} className="arx-window-menu">
                <button
                  type="button"
                  className={`arx-icon-button ${filter !== "all" ? "arx-icon-button-active" : ""}`}
                  onClick={() => setFilterMenuOpen((current,) => !current)}
                  aria-haspopup="menu"
                  aria-expanded={filterMenuOpen}
                  aria-label={`Filter: ${activeFilterLabel}`}
                  title={`Filter: ${activeFilterLabel}`}
                >
                  <ListFilter size={16} />
                </button>
                {filterMenuOpen ? (
                  <div className="arx-window-menu-popover" role="menu" aria-label="Filter mail">
                    {filterOptions.map((option,) => {
                      const disabled = option.value === "filtered" && !aiReady;
                      const selected = option.value === filter;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          className={`arx-window-menu-item ${selected ? "arx-window-menu-item-selected" : ""}`}
                          disabled={disabled}
                          onClick={() => {
                            if (disabled) return;
                            setFilter(option.value,);
                            setFilterMenuOpen(false,);
                          }}
                        >
                          <span>{option.label}</span>
                          {selected ? <Check size={14} /> : null}
                        </button>
                      );
                    },)}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="arx-icon-button"
                onClick={() => void handleSync()}
                disabled={syncing || snapshot.accounts.length === 0}
                aria-label="Sync"
                title="Sync"
              >
                <RefreshCcw size={16} className={syncing ? "arx-sync-icon-spinning" : ""} />
              </button>
              <button
                type="button"
                className="arx-icon-button"
                onClick={() => setSettingsOpen(true,)}
                aria-keyshortcuts="Meta+,"
                aria-label="Settings"
                title="Settings"
              >
                <Settings2 size={16} />
              </button>
            </div>
          </div>
        ) : null}

        <div className="arx-home-shell" onWheelCapture={handleHomeWheel}>
          <section className="arx-search-sticky">
            <div className="arx-search-field">
              <input
                value={search}
                onChange={(event,) => setSearch(event.target.value,)}
                placeholder="Subject, snippet, or sender"
              />
            </div>

            {!aiReady && !showOnboarding ? (
              <div className="arx-inline-note arx-inline-note-action">
                <p>Add an AI key to unlock filtered mail.</p>
                <button
                  type="button"
                  className="arx-button arx-button-primary"
                  onClick={() => setSettingsOpen(true,)}
                >
                  Add API key
                </button>
              </div>
            ) : null}
          </section>

          <div className="arx-home-content">
            {error ? <p className="arx-error-banner">{error}</p> : null}

            <ThreadList
              accountEmailsById={accountEmailsById}
              emptyMessage={emptyMessage}
              onboardingSteps={showOnboarding ? onboardingSteps : undefined}
              onOpenSettings={showOnboarding ? () => setSettingsOpen(true,) : undefined}
              threads={visibleThreads}
            />
          </div>
        </div>
      </main>

      <SettingsView
        open={settingsOpen}
        busy={busy}
        accounts={snapshot.accounts}
        aiSettings={aiSettings}
        onAiSettingsChange={setAiSettings}
        onSaveAiSettings={handleSaveAiSettings}
        onConnectAccount={handleConnectAccount}
        onClose={() => setSettingsOpen(false,)}
      />
    </>
  );
}
