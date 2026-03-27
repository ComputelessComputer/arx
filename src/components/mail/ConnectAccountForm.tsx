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

export function ConnectAccountForm({ busy, onSubmit, }: ConnectAccountFormProps,) {
  const [provider, setProvider,] = useState<ProviderKind>("gmail",);
  const [displayName, setDisplayName,] = useState("",);
  const [email, setEmail,] = useState("",);
  const [imapHost, setImapHost,] = useState("imap.example.com",);
  const [imapPort, setImapPort,] = useState("993",);
  const [smtpHost, setSmtpHost,] = useState("smtp.example.com",);
  const [smtpPort, setSmtpPort,] = useState("465",);
  const [username, setUsername,] = useState("",);
  const [password, setPassword,] = useState("",);
  const [archiveMailbox, setArchiveMailbox,] = useState("Archive",);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>,) => {
    event.preventDefault();

    await onSubmit({
      provider,
      displayName: displayName.trim(),
      email: email.trim(),
      imap: provider === "imap"
        ? {
          imapHost: imapHost.trim(),
          imapPort: Number(imapPort,),
          smtpHost: smtpHost.trim(),
          smtpPort: Number(smtpPort,),
          username: username.trim(),
          password,
          archiveMailbox: archiveMailbox.trim() || null,
        }
        : null,
    },);
  };

  return (
    <form className="arx-panel arx-connect-form" onSubmit={handleSubmit}>
      <div className="arx-panel-header">
        <div>
          <p className="arx-eyebrow">Connect</p>
          <h2>Bring an account into Arx</h2>
        </div>
        <p className="arx-muted">
          The current build wires a real local cache and provider adapters, with connection auth left as the next step.
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

      {provider === "imap" ? (
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
      ) : null}

      <button type="submit" className="arx-button arx-button-primary" disabled={busy}>
        {busy ? "Connecting..." : "Connect account"}
      </button>
    </form>
  );
}

