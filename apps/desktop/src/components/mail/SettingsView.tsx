import { Check, ChevronDown, X, } from "lucide-react";
import { useEffect, useRef, useState, } from "react";
import { ConnectAccountForm, } from "./ConnectAccountForm";
import type {
  AiProvider,
  AiSettings,
  ConnectAccountInput,
  MailAccount,
} from "../../types/mail";

interface SettingsViewProps {
  open: boolean;
  busy: boolean;
  accounts: MailAccount[];
  aiSettings: AiSettings;
  onAiSettingsChange: (settings: AiSettings,) => void;
  onSaveAiSettings: () => Promise<void>;
  onConnectAccount: (input: ConnectAccountInput,) => Promise<void>;
  onClose: () => void;
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

function SharpSelectField<T extends string,>(
  {
    label,
    options,
    value,
    onChange,
  }: {
    label: string;
    options: Array<{ hint: string; label: string; value: T; }>;
    value: T;
    onChange: (value: T,) => void;
  },
) {
  const [open, setOpen,] = useState(false,);
  const rootRef = useRef<HTMLDivElement>(null,);
  const selected = options.find((option,) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent,) => {
      if (!rootRef.current?.contains(event.target as Node,)) {
        setOpen(false,);
      }
    };

    const handleEscape = (event: KeyboardEvent,) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false,);
      }
    };

    window.addEventListener("mousedown", handlePointerDown,);
    window.addEventListener("keydown", handleEscape,);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown,);
      window.removeEventListener("keydown", handleEscape,);
    };
  }, [open,],);

  return (
    <div ref={rootRef} className="arx-sharp-select">
      <label className="arx-sharp-select-label">{label}</label>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current,) => !current)}
        className={`arx-sharp-select-trigger ${open ? "arx-sharp-select-trigger-open" : ""}`}
      >
        <span className="arx-sharp-select-copy">
          <span className="arx-sharp-select-hint">{selected.hint}</span>
          <span className="arx-sharp-select-value">{selected.label}</span>
        </span>
        <ChevronDown className={`arx-sharp-select-icon ${open ? "arx-sharp-select-icon-open" : ""}`} size={16} />
      </button>
      {open ? (
        <div role="listbox" aria-label={label} className="arx-sharp-select-menu">
          {options.map((option,) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value,);
                  setOpen(false,);
                }}
                className={`arx-sharp-select-option ${isSelected ? "arx-sharp-select-option-selected" : ""}`}
              >
                <span className="arx-sharp-select-copy">
                  <span className={`arx-sharp-select-hint ${isSelected ? "arx-sharp-select-hint-selected" : ""}`}>{option.hint}</span>
                  <span className="arx-sharp-select-value">{option.label}</span>
                </span>
                <Check size={16} className={isSelected ? "arx-sharp-select-check" : "arx-sharp-select-check-hidden"} />
              </button>
            );
          },)}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsView(
  {
    open,
    busy,
    accounts,
    aiSettings,
    onAiSettingsChange,
    onSaveAiSettings,
    onConnectAccount,
    onClose,
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
          <section className="arx-settings-section">
            <div className="arx-section-header">
              <div>
                <p className="arx-eyebrow">AI Filter</p>
                <h3>API keys</h3>
              </div>
              <button type="button" className="arx-button arx-button-primary" onClick={() => void onSaveAiSettings()} disabled={busy}>
                {busy ? "Saving..." : "Save"}
              </button>
            </div>

            <p className="arx-muted">
              Add the key Arx should use when you switch to the filtered mail view.
            </p>

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

          <section className="arx-settings-section">
            <div className="arx-section-header">
              <div>
                <p className="arx-eyebrow">Mail</p>
                <h3>Connected accounts</h3>
              </div>
            </div>

            {accounts.length > 0 ? (
              <div className="arx-settings-list">
                {accounts.map((account,) => (
                  <div key={account.id} className="arx-settings-list-item">
                    <div>
                      <strong>{account.displayName || account.email}</strong>
                      <p>{account.email}</p>
                    </div>
                    <span className="arx-status-chip arx-status-chip-ready">
                      <Check size={12} />
                      Connected
                    </span>
                  </div>
                ),)}
              </div>
            ) : (
              <div className="arx-empty-block">
                <p>No mail account connected yet.</p>
              </div>
            )}

            <ConnectAccountForm busy={busy} onSubmit={onConnectAccount} />
          </section>
        </div>
      </section>
    </div>
  );
}
