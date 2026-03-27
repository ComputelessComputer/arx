import { Archive, Inbox, MailOpen, MailPlus, Sparkles, Star, } from "lucide-react";
import type { ProviderCapabilities, ThreadDetail, } from "../../types/mail";

interface ThreadDetailPaneProps {
  capabilities: ProviderCapabilities | null;
  detail: null | ThreadDetail;
  onAction: (threadId: string, action: "archive" | "markRead" | "moveToInbox" | "star",) => Promise<void>;
  onReply: (threadId: string,) => Promise<void>;
}

export function ThreadDetailPane({ capabilities, detail, onAction, onReply, }: ThreadDetailPaneProps,) {
  if (!detail) {
    return (
      <section className="arx-panel arx-empty-detail">
        <p>Select a thread to review the conversation.</p>
      </section>
    );
  }

  return (
    <section className="arx-panel arx-thread-detail">
      <div className="arx-panel-header">
        <div>
          <p className="arx-eyebrow">Thread</p>
          <h2>{detail.thread.subject}</h2>
        </div>
        <div className="arx-action-row">
          {capabilities?.archive ? (
            <button type="button" className="arx-button" onClick={() => onAction(detail.thread.id, "archive",)}>
              <Archive size={16} />
              Archive
            </button>
          ) : null}
          {capabilities?.moveToInbox ? (
            <button type="button" className="arx-button" onClick={() => onAction(detail.thread.id, "moveToInbox",)}>
              <Inbox size={16} />
              Inbox
            </button>
          ) : null}
          <button type="button" className="arx-button" onClick={() => onAction(detail.thread.id, "markRead",)}>
            <MailOpen size={16} />
            Mark read
          </button>
          {capabilities?.star ? (
            <button type="button" className="arx-button" onClick={() => onAction(detail.thread.id, "star",)}>
              <Star size={16} />
              Toggle star
            </button>
          ) : null}
          <button type="button" className="arx-button arx-button-primary" onClick={() => onReply(detail.thread.id,)}>
            <MailPlus size={16} />
            Reply
          </button>
        </div>
      </div>

      <div className="arx-thread-summary">
        <span className="arx-pill">{detail.thread.participants.map((participant,) => participant.email,).join(", ")}</span>
        {detail.thread.needsReply ? (
          <span className="arx-pill arx-pill-strong">
            <Sparkles size={14} />
            Reply candidate
          </span>
        ) : null}
      </div>

      <div className="arx-message-stack">
        {detail.messages.map((message,) => (
          <article key={message.id} className="arx-message-card">
            <div className="arx-message-meta">
              <div>
                <strong>{message.from.name || message.from.email}</strong>
                <p>{message.from.email}</p>
              </div>
              <span>{new Date(message.receivedAt,).toLocaleString()}</span>
            </div>
            <div
              className="arx-message-body"
              dangerouslySetInnerHTML={{ __html: message.sanitizedHtml, }}
            />
          </article>
        ),)}
      </div>
    </section>
  );
}

