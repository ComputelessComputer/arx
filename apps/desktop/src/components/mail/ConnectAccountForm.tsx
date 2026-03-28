import { useState, } from "react";
import { SharpSelectField, } from "./SharpSelectField";
import type { AccountReconnectDraft, ConnectAccountInput, ProviderKind, } from "../../types/mail";

interface ConnectAccountFormProps {
  busy: boolean;
  draft?: AccountReconnectDraft | null;
  onCancel?: () => void;
  onSubmit: (input: ConnectAccountInput,) => Promise<void>;
}

const providerOptions: Array<{ hint: string; value: ProviderKind; label: string; }> = [
  { value: "gmail", label: "Gmail", hint: "Preset", },
  { value: "outlook", label: "Outlook", hint: "Preset", },
  { value: "imap", label: "IMAP / SMTP", hint: "Manual", },
];

const presetProviders = {
  gmail: {
    helper: "Use a Google app password. OAuth is not wired yet.",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    passwordLabel: "App password",
  },
  outlook: {
    helper: "Connects over IMAP with your Microsoft credentials.",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    passwordLabel: "Password",
  },
} satisfies Record<Exclude<ProviderKind, "imap">, {
  helper: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  passwordLabel: string;
}>;

export function ConnectAccountForm({ busy, draft = null, onCancel, onSubmit, }: ConnectAccountFormProps,) {
  const [provider, setProvider,] = useState<ProviderKind>(draft?.provider ?? "gmail",);
  const [displayName, setDisplayName,] = useState(draft?.displayName ?? "",);
  const [email, setEmail,] = useState(draft?.email ?? "",);
  const [password, setPassword,] = useState("",);
  const [imapHost, setImapHost,] = useState(draft?.imap?.imapHost ?? "imap.example.com",);
  const [imapPort, setImapPort,] = useState(String(draft?.imap?.imapPort ?? 993),);
  const [smtpHost, setSmtpHost,] = useState(draft?.imap?.smtpHost ?? "smtp.example.com",);
  const [smtpPort, setSmtpPort,] = useState(String(draft?.imap?.smtpPort ?? 465),);
  const [username, setUsername,] = useState(draft?.imap?.username ?? "",);
  const [archiveMailbox, setArchiveMailbox,] = useState(draft?.imap?.archiveMailbox ?? "Archive",);

  const preset = provider === "imap" ? null : presetProviders[provider];
  const isFirstAccountSetup = !draft && !onCancel;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>,) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const resolvedImap = provider === "imap"
      ? {
        imapHost: imapHost.trim(),
        imapPort: Number(imapPort,),
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort,),
        username: username.trim(),
        password,
        archiveMailbox: archiveMailbox.trim() || null,
      }
      : (() => {
        const presetConfig = presetProviders[provider];
        return {
          imapHost: presetConfig.imapHost,
          imapPort: presetConfig.imapPort,
          smtpHost: presetConfig.smtpHost,
          smtpPort: presetConfig.smtpPort,
          username: trimmedEmail,
          password,
          archiveMailbox: null,
        };
      })();

    await onSubmit({
      provider,
      displayName: displayName.trim(),
      email: trimmedEmail,
      imap: resolvedImap,
    },);
  };

  return (
    <form className="arx-connect-form" onSubmit={handleSubmit} autoComplete="off">
      <div className="arx-panel-header">
        <div className="arx-panel-header-copy">
          {draft ? <p className="arx-eyebrow">Reconnect inbox</p> : null}
          <h2>{draft ? "Reconnect account" : isFirstAccountSetup ? "Connect your first email" : "Connect a mail account"}</h2>
        </div>
      </div>

      <SharpSelectField
        label="Provider"
        options={providerOptions}
        value={provider}
        onChange={setProvider}
      />

      <div className="arx-grid-two">
        <label className="arx-field">
          <span>Display name</span>
          <input
            autoComplete="off"
            value={displayName}
            onChange={(event,) => setDisplayName(event.target.value,)}
            placeholder="Jordan Lee"
          />
        </label>
        <label className="arx-field">
          <span>Email</span>
          <input
            autoComplete="off"
            value={email}
            onChange={(event,) => setEmail(event.target.value,)}
            placeholder="jordan@example.com"
          />
        </label>
      </div>

      {preset ? (
        <>
          <p className="arx-muted">{preset.helper}</p>
          <label className="arx-field">
            <span>{preset.passwordLabel}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event,) => setPassword(event.target.value,)}
            />
          </label>
        </>
      ) : (
        <>
          <div className="arx-grid-two">
            <label className="arx-field">
              <span>IMAP host</span>
              <input value={imapHost} onChange={(event,) => setImapHost(event.target.value,)} />
            </label>
            <label className="arx-field">
              <span>IMAP port</span>
              <input value={imapPort} onChange={(event,) => setImapPort(event.target.value,)} inputMode="numeric" />
            </label>
          </div>
          <div className="arx-grid-two">
            <label className="arx-field">
              <span>SMTP host</span>
              <input value={smtpHost} onChange={(event,) => setSmtpHost(event.target.value,)} />
            </label>
            <label className="arx-field">
              <span>SMTP port</span>
              <input value={smtpPort} onChange={(event,) => setSmtpPort(event.target.value,)} inputMode="numeric" />
            </label>
          </div>
          <div className="arx-grid-two">
            <label className="arx-field">
              <span>Username</span>
              <input autoComplete="off" value={username} onChange={(event,) => setUsername(event.target.value,)} />
            </label>
            <label className="arx-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event,) => setPassword(event.target.value,)}
              />
            </label>
          </div>
          <label className="arx-field">
            <span>Archive mailbox</span>
            <input value={archiveMailbox} onChange={(event,) => setArchiveMailbox(event.target.value,)} placeholder="Archive" />
          </label>
        </>
      )}

      <div className="arx-form-actions">
        <button type="submit" className="arx-button arx-button-primary" disabled={busy}>
          {busy ? (draft ? "Reconnecting..." : "Connecting...") : (draft ? "Reconnect account" : "Connect account")}
        </button>
        {onCancel ? (
          <button type="button" className="arx-button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
