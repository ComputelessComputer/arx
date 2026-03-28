import { Check, PencilLine, Plus, RefreshCcw, Trash2, X, } from "lucide-react";
import { useEffect, useState, } from "react";
import { ConnectAccountForm, } from "./ConnectAccountForm";
import { SharpSelectField, } from "./SharpSelectField";
import { useNativeContextMenu, } from "../../hooks/useNativeContextMenu";
import type {
  AccountReconnectDraft,
  AiProvider,
  AiSettings,
  ConnectAccountInput,
  MailAccount,
} from "../../types/mail";

interface SettingsViewProps {
  accountChecks: Record<string, {
    message?: string;
    state: "checking" | "error" | "healthy";
  }>;
  open: boolean;
  busy: boolean;
  aiSettingsSaving: boolean;
  accounts: MailAccount[];
  aiSettings: AiSettings;
  error: null | string;
  removingAccountId: null | string;
  renamingAccountId: null | string;
  reconnectDraft: AccountReconnectDraft | null;
  accountFormKey: string;
  showAccountForm: boolean;
  onAiSettingsChange: (settings: AiSettings,) => void;
  onCancelConnectAccount: () => void;
  onCheckAccount: (accountId: string,) => Promise<void>;
  onConnectAccount: (input: ConnectAccountInput,) => Promise<void>;
  onClose: () => void;
  onOpenConnectAccount: () => void;
  onRemoveAccount: (account: MailAccount,) => Promise<void>;
  onRenameAccount: (accountId: string, displayName: string,) => Promise<void>;
  onReconnectAccount: (accountId: string,) => Promise<void>;
}

const providers: Array<{ label: string; value: AiProvider; }> = [
  {
    value: "openai",
    label: "OpenAI",
  },
  {
    value: "anthropic",
    label: "Anthropic",
  },
];

const aiProviderPlaceholders: Record<AiProvider, string> = {
  openai: "sk-...",
  anthropic: "sk-ant-...",
};

function isConfigured(provider: AiProvider, settings: AiSettings,) {
  if (provider === "openai") {
    return settings.openaiApiKey.trim().length > 0;
  }

  return settings.anthropicApiKey.trim().length > 0;
}

function getAiProviderKey(settings: AiSettings, provider: AiProvider,) {
  if (provider === "openai") {
    return settings.openaiApiKey;
  }

  return settings.anthropicApiKey;
}

function formatAccountDate(value: string,) {
  return new Date(value,).toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  },);
}

function getAccountHealth(
  account: MailAccount,
  checks: Record<string, { message?: string; state: "checking" | "error" | "healthy"; }>,
) {
  const state = checks[account.id];
  if (state?.state === "checking") {
    return {
      detail: null,
      message: null,
      summary: "Checking connection...",
      tone: "checking" as const,
    };
  }

  if (state?.state === "error") {
    return {
      detail: null,
      message: state.message ?? "Arx could not reach this inbox.",
      summary: "Needs reconnect",
      tone: "error" as const,
    };
  }

  if (state?.state === "healthy" || account.lastSyncedAt) {
    return {
      detail: null,
      message: null,
      summary: null,
      tone: "healthy" as const,
    };
  }

  return {
    detail: null,
    message: null,
    summary: null,
    tone: "healthy" as const,
  };
}

function ConnectedAccountRow(
  {
    account,
    busy,
    health,
    isChecking,
    isRemoving,
    isRenaming,
    onCheckAccount,
    onRemoveAccount,
    onReconnectAccount,
    onRenameAccount,
  }: {
    account: MailAccount;
    busy: boolean;
    health: ReturnType<typeof getAccountHealth>;
    isChecking: boolean;
    isRemoving: boolean;
    isRenaming: boolean;
    onCheckAccount: (accountId: string,) => Promise<void>;
    onRemoveAccount: (account: MailAccount,) => Promise<void>;
    onReconnectAccount: (accountId: string,) => Promise<void>;
    onRenameAccount: (accountId: string, displayName: string,) => Promise<void>;
  },
) {
  const [draftName, setDraftName,] = useState(account.displayName,);
  const [editing, setEditing,] = useState(false,);
  const hasNameChange = draftName.trim() !== account.displayName.trim();
  const checkDisabled = busy || isChecking || isRemoving || isRenaming;
  const reconnectDisabled = busy || isRemoving || isRenaming;
  const removeDisabled = busy || isRemoving || isRenaming;
  const editDisabled = busy;
  const checkLabel = isChecking
    ? "Checking connection"
    : health.tone === "error"
      ? "Check again"
      : "Check now";

  const handleStartEditing = () => {
    setDraftName(account.displayName,);
    setEditing(true,);
  };

  const handleCancelEditing = () => {
    setDraftName(account.displayName,);
    setEditing(false,);
  };

  const handleSaveName = async (event: React.FormEvent<HTMLFormElement>,) => {
    event.preventDefault();
    try {
      await onRenameAccount(account.id, draftName,);
      setEditing(false,);
    } catch {
      return;
    }
  };

  const showContextMenu = useNativeContextMenu([
    {
      id: `check-${account.id}`,
      text: health.tone === "error" ? "Check again" : "Check now",
      action: () => void onCheckAccount(account.id,),
      disabled: checkDisabled,
    },
    {
      id: `reconnect-${account.id}`,
      text: "Reconnect account",
      action: () => void onReconnectAccount(account.id,),
      disabled: reconnectDisabled,
    },
    {
      id: `edit-${account.id}`,
      text: "Edit name",
      action: handleStartEditing,
      disabled: editDisabled,
    },
    { separator: true, },
    {
      id: `remove-${account.id}`,
      text: isRemoving ? "Removing..." : "Remove account",
      action: () => void onRemoveAccount(account,),
      disabled: removeDisabled,
    },
  ]);

  return (
    <div
      className="arx-settings-list-item"
      onContextMenu={editing ? undefined : showContextMenu}
    >
      <div className={`arx-settings-account-row ${editing ? "arx-settings-account-row-editing" : ""}`}>
        <div className="arx-settings-list-copy">
          {editing ? (
            <form className="arx-account-name-form" onSubmit={handleSaveName}>
              <input
                className="arx-account-name-input"
                value={draftName}
                onChange={(event,) => setDraftName(event.target.value,)}
                placeholder={account.email}
                autoFocus
              />
              <div className="arx-account-name-actions">
                <button
                  type="submit"
                  className="arx-button arx-button-primary"
                  disabled={busy || isRenaming || !hasNameChange}
                >
                  {isRenaming ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="arx-button"
                  onClick={handleCancelEditing}
                  disabled={isRenaming}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="arx-account-name-row">
              <strong>{account.displayName || account.email}</strong>
            </div>
          )}
          <p>{account.email}</p>
          {health.summary || health.detail ? (
            <div className="arx-account-status-row">
              {health.summary ? (
                <span className={`arx-account-status arx-account-status-${health.tone}`}>{health.summary}</span>
              ) : null}
              {health.detail ? <span className="arx-account-status-detail">{health.detail}</span> : null}
            </div>
          ) : null}
          {health.message ? <p className="arx-account-error">{health.message}</p> : null}
        </div>
        {editing ? null : (
          <div className="arx-account-row-actions">
            <button
              type="button"
              className={`arx-icon-button arx-account-action-button arx-account-sync-button ${health.tone === "error" ? "arx-account-action-button-danger" : ""}`}
              onClick={() => void onCheckAccount(account.id,)}
              disabled={checkDisabled}
              aria-label={checkLabel}
              title={checkLabel}
            >
              {isChecking || health.tone === "error" ? (
                <RefreshCcw size={15} className={isChecking ? "arx-sync-icon-spinning" : undefined} />
              ) : (
                <span className="arx-account-sync-icon-stack" aria-hidden="true">
                  <Check size={15} className="arx-account-sync-icon-default" />
                  <RefreshCcw size={15} className="arx-account-sync-icon-hover" />
                </span>
              )}
            </button>
            <button
              type="button"
              className="arx-icon-button arx-account-action-button arx-account-action-button-danger"
              onClick={() => void onRemoveAccount(account,)}
              disabled={removeDisabled}
              aria-label={isRemoving ? "Removing account" : "Remove account"}
              title={isRemoving ? "Removing account" : "Remove account"}
            >
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              className="arx-icon-button arx-account-action-button"
              onClick={handleStartEditing}
              disabled={editDisabled}
              aria-label="Edit account name"
              title="Edit account name"
            >
              <PencilLine size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsView(
  {
    open,
    busy,
    aiSettingsSaving,
    accounts,
    accountChecks,
    aiSettings,
    error,
    removingAccountId,
    renamingAccountId,
    reconnectDraft,
    accountFormKey,
    showAccountForm,
    onAiSettingsChange,
    onCancelConnectAccount,
    onCheckAccount,
    onConnectAccount,
    onClose,
    onOpenConnectAccount,
    onRemoveAccount,
    onRenameAccount,
    onReconnectAccount,
  }: SettingsViewProps,
) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent,) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown,);
    return () => window.removeEventListener("keydown", handleKeyDown,);
  }, [open, onClose]);

  if (!open) return null;

  const selectedAiKey = getAiProviderKey(aiSettings, aiSettings.provider,);
  const latestSyncedAt = accounts
    .map((account,) => account.lastSyncedAt)
    .filter((value,) => typeof value === "string")
    .map((value,) => ({ raw: value, timestamp: Date.parse(value), }))
    .filter((value,) => !Number.isNaN(value.timestamp,))
    .sort((left, right,) => right.timestamp - left.timestamp)[0]?.raw ?? null;
  const accountsHeaderMeta = latestSyncedAt ? `Last synced ${formatAccountDate(latestSyncedAt,)}` : null;

  return (
    <div className="arx-settings-view" role="dialog" aria-modal="true" aria-label="Settings">
      <section className="arx-settings-shell">
        <header className="arx-settings-header">
          <div />
          <div />
          <button type="button" className="arx-icon-button" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </header>

        <div className="arx-settings-content">
          {error ? <p className="arx-error-banner">{error}</p> : null}

          <section className="arx-settings-section">
            {accounts.length > 0 ? (
              <>
                <div className="arx-section-header">
                  <div>
                    <h3>Accounts</h3>
                  </div>
                  {accountsHeaderMeta ? <p className="arx-section-header-meta">{accountsHeaderMeta}</p> : null}
                </div>

                <div className="arx-settings-list">
                  {accounts.map((account,) => {
                    const health = getAccountHealth(account, accountChecks,);
                    const isChecking = accountChecks[account.id]?.state === "checking";

                    return (
                      <ConnectedAccountRow
                        key={account.id}
                        account={account}
                        busy={busy}
                        health={health}
                        isChecking={isChecking}
                        isRemoving={removingAccountId === account.id}
                        isRenaming={renamingAccountId === account.id}
                        onCheckAccount={onCheckAccount}
                        onRemoveAccount={onRemoveAccount}
                        onReconnectAccount={onReconnectAccount}
                        onRenameAccount={onRenameAccount}
                      />
                    );
                  },)}
                  {!showAccountForm ? (
                    <div className="arx-settings-list-item arx-settings-list-item-action">
                      <button
                        type="button"
                        className="arx-settings-list-row-button"
                        onClick={onOpenConnectAccount}
                        disabled={busy}
                      >
                        <Plus size={16} />
                        Add account
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {showAccountForm ? (
              <ConnectAccountForm
                key={accountFormKey}
                busy={busy}
                draft={reconnectDraft}
                onCancel={accounts.length > 0 ? onCancelConnectAccount : undefined}
                onSubmit={onConnectAccount}
              />
            ) : null}
          </section>

          <section className="arx-settings-section">
            <div className="arx-section-header">
              <div>
                <h3>AI</h3>
              </div>
              {aiSettingsSaving ? (
                <span role="status" aria-live="polite" className="arx-status-chip">
                  Saving...
                </span>
              ) : null}
            </div>

            <div className="arx-provider-config-panel">
              <SharpSelectField
                label="Provider"
                options={providers.map((provider,) => ({
                  hint: isConfigured(provider.value, aiSettings,) ? "Saved" : "Add key",
                  label: provider.label,
                  value: provider.value,
                }))}
                value={aiSettings.provider}
                onChange={(provider,) => onAiSettingsChange({
                  ...aiSettings,
                  provider,
                },)}
              />

              <label className="arx-field">
                <span>API key</span>
                <input
                  type="password"
                  value={selectedAiKey}
                  onChange={(event,) => onAiSettingsChange(
                    aiSettings.provider === "openai"
                      ? {
                        ...aiSettings,
                        openaiApiKey: event.target.value,
                      }
                      : {
                        ...aiSettings,
                        anthropicApiKey: event.target.value,
                      },
                  )}
                  placeholder={aiProviderPlaceholders[aiSettings.provider]}
                />
              </label>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
