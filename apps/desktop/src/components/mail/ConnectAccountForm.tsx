import { useState, } from "react";
import type { ConnectAccountInput, ProviderKind, } from "../../types/mail";

interface ConnectAccountFormProps {
  busy: boolean;
  onSubmit: (input: ConnectAccountInput,) => Promise<void>;
}

const providerOptions: Array<{ value: ProviderKind; label: string; }> = [
  { value: "gmail", label: "Gmail", },
  { value: "outlook", label: "Outlook", },
  { value: "imap", label: "IMAP / SMTP", },
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

export function ConnectAccountForm({ busy, onSubmit, }: ConnectAccountFormProps,) {
  const [provider, setProvider,] = useState<ProviderKind>("gmail",);
  const [displayName, setDisplayName,] = useState("",);
  const [email, setEmail,] = useState("",);
  const [password, setPassword,] = useState("",);
  const [imapHost, setImapHost,] = useState("imap.example.com",);
  const [imapPort, setImapPort,] = useState("993",);
  const [smtpHost, setSmtpHost,] = useState("smtp.example.com",);
  const [smtpPort, setSmtpPort,] = useState("465",);
  const [username, setUsername,] = useState("",);
  const [archiveMailbox, setArchiveMailbox,] = useState("Archive",);

  const preset = provider === "imap" ? null : presetProviders[provider];

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
    <form className="arx-connect-form" onSubmit={handleSubmit}>
      <div className="arx-panel-header">
        <div>
          <p className="arx-eyebrow">Add inbox</p>
          <h2>Connect a mail account</h2>
        </div>
        <p className="arx-muted">
          Arx syncs real inbox mail over IMAP. Gmail and Outlook use preset server settings.
        </p>
      </div>

      <label className="arx-field">
        <span>Provider</span>
        <select value={provider} onChange={(event,) => setProvider(event.target.value as ProviderKind,)}>
          {providerOptions.map((option,) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ),)}
        </select>
      </label>

      <div className="arx-grid-two">
        <label className="arx-field">
          <span>Display name</span>
          <input value={displayName} onChange={(event,) => setDisplayName(event.target.value,)} placeholder="Jordan Lee" />
        </label>
        <label className="arx-field">
          <span>Email</span>
          <input value={email} onChange={(event,) => setEmail(event.target.value,)} placeholder="jordan@example.com" />
        </label>
      </div>

      {preset ? (
        <>
          <p className="arx-muted">{preset.helper}</p>
          <label className="arx-field">
            <span>{preset.passwordLabel}</span>
            <input type="password" value={password} onChange={(event,) => setPassword(event.target.value,)} />
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
              <input value={username} onChange={(event,) => setUsername(event.target.value,)} />
            </label>
            <label className="arx-field">
              <span>Password</span>
              <input type="password" value={password} onChange={(event,) => setPassword(event.target.value,)} />
            </label>
          </div>
          <label className="arx-field">
            <span>Archive mailbox</span>
            <input value={archiveMailbox} onChange={(event,) => setArchiveMailbox(event.target.value,)} placeholder="Archive" />
          </label>
        </>
      )}

      <button type="submit" className="arx-button arx-button-primary" disabled={busy}>
        {busy ? "Connecting..." : "Connect account"}
      </button>
    </form>
  );
}
