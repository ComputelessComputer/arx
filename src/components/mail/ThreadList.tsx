import { Archive, Inbox, Sparkles, Star, } from "lucide-react";
import type { NormalizedThread, } from "../../types/mail";

interface ThreadListProps {
  threads: NormalizedThread[];
  selectedThreadId: null | string;
  onSelect: (threadId: string,) => void;
}

export function ThreadList({ threads, selectedThreadId, onSelect, }: ThreadListProps,) {
  return (
    <div className="arx-thread-list">
      {threads.length === 0 ? (
        <div className="arx-empty-state arx-panel">
          <p>No threads in this view yet.</p>
        </div>
      ) : null}

      {threads.map((thread,) => (
        <button
          key={thread.id}
          type="button"
          className={`arx-thread-card ${selectedThreadId === thread.id ? "arx-thread-card-active" : ""}`}
          onClick={() => onSelect(thread.id,)}
        >
          <div className="arx-thread-card-topline">
            <div className="arx-thread-card-icons">
              {thread.archived ? <Archive size={14} /> : <Inbox size={14} />}
              {thread.starred ? <Star size={14} className="fill-current" /> : null}
              {thread.needsReply ? <Sparkles size={14} /> : null}
            </div>
            <span>{new Date(thread.lastMessageAt,).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            },)}</span>
          </div>
          <div className="arx-thread-card-content">
            <strong>{thread.subject}</strong>
            <p>{thread.participants.map((participant,) => participant.name || participant.email,).join(", ")}</p>
            <p>{thread.snippet}</p>
          </div>
          <div className="arx-thread-card-flags">
            {thread.unread ? <span className="arx-pill arx-pill-strong">Unread</span> : null}
            {thread.needsReply ? <span className="arx-pill">Needs reply</span> : null}
            <span className="arx-pill">{thread.messageCount} messages</span>
          </div>
        </button>
      ),)}
    </div>
  );
}

