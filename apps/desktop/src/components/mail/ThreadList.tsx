import { Check, Circle, MailOpen, Settings2, Sparkles, } from "lucide-react";
import type { NormalizedThread, } from "../../types/mail";

interface OnboardingStep {
  complete: boolean;
  description: string;
  title: string;
}

interface ThreadListProps {
  accountEmailsById: Record<string, string>;
  emptyMessage: string;
  onboardingSteps?: OnboardingStep[];
  onOpenSettings?: () => void;
  threads: NormalizedThread[];
}

function formatParticipants(thread: NormalizedThread,) {
  const names = thread.participants
    .map((participant,) => participant.name || participant.email,)
    .filter(Boolean,);

  return names.join(", ") || "Unknown sender";
}

function formatTime(value: string,) {
  return new Date(value,).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },);
}

export function ThreadList(
  {
    accountEmailsById,
    emptyMessage,
    onboardingSteps,
    onOpenSettings,
    threads,
  }: ThreadListProps,
) {
  if (threads.length === 0) {
    return (
      <section className="arx-list-panel">
        <div className="arx-empty-block">
          {onboardingSteps?.length && onOpenSettings ? (
            <div className="arx-onboarding-card">
              <div className="arx-onboarding-header">
                <div>
                  <p className="arx-eyebrow">Getting started</p>
                  <h2>Set up Arx</h2>
                </div>

                <button type="button" className="arx-button arx-button-primary" onClick={onOpenSettings}>
                  <Settings2 size={14} />
                  Open settings
                </button>
              </div>

              <p className="arx-muted">
                Connect your first inbox, then add an AI key if you want filtered mail.
              </p>

              <div className="arx-checklist">
                {onboardingSteps.map((step,) => (
                  <div key={step.title} className={`arx-checklist-item ${step.complete ? "arx-checklist-item-complete" : ""}`}>
                    <span className="arx-checklist-icon" aria-hidden="true">
                      {step.complete ? <Check size={14} /> : <Circle size={14} />}
                    </span>

                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.description}</p>
                    </div>
                  </div>
                ),)}
              </div>
            </div>
          ) : (
            <p>{emptyMessage}</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="arx-list-panel">
      <div className="arx-thread-list">
        {threads.map((thread,) => (
          <article key={thread.id} className={`arx-thread-row ${thread.unread ? "arx-thread-row-unread" : ""}`}>
            <div className="arx-thread-row-top">
              <strong>{formatParticipants(thread,)}</strong>
              <span>{formatTime(thread.lastMessageAt,)}</span>
            </div>

            <div className="arx-thread-row-body">
              <p className="arx-thread-subject">{thread.subject}</p>
              <p className="arx-thread-snippet">{thread.snippet}</p>
            </div>

            <div className="arx-thread-row-bottom">
              <span className="arx-chip">{accountEmailsById[thread.accountId] ?? "Unknown inbox"}</span>
              {thread.unread ? (
                <span className="arx-chip">
                  <MailOpen size={12} />
                  Unread
                </span>
              ) : null}
              {thread.needsReply ? (
                <span className="arx-chip arx-chip-strong">
                  <Sparkles size={12} />
                  Filtered
                </span>
              ) : null}
            </div>
          </article>
        ),)}
      </div>
    </section>
  );
}
