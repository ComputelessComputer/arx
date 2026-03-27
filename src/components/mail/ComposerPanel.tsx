import { Send, Sparkles, } from "lucide-react";
import { ComposerEditor, } from "../editor/ComposerEditor";
import {
  buildDraftPatch,
  parseRecipientField,
  participantsToField,
  textToDoc,
} from "../../lib/emailEditor";
import type { DraftDocument, DraftRewriteTone, } from "../../types/mail";

interface ComposerPanelProps {
  draft: DraftDocument | null;
  busy: boolean;
  onChange: (draft: DraftDocument,) => void;
  onRewrite: (tone: DraftRewriteTone,) => Promise<void>;
  onSend: () => Promise<void>;
}

const rewriteActions: Array<{ tone: DraftRewriteTone; label: string; }> = [
  { tone: "shorter", label: "Shorter", },
  { tone: "professional", label: "Professional", },
  { tone: "friendly", label: "Friendlier", },
];

export function ComposerPanel({ draft, busy, onChange, onRewrite, onSend, }: ComposerPanelProps,) {
  if (!draft) {
    return (
      <section className="arx-panel arx-empty-state">
        <p>Open a reply draft to edit a response in Tiptap.</p>
      </section>
    );
  }

  return (
    <section className="arx-panel arx-composer-panel">
      <div className="arx-panel-header">
        <div>
          <p className="arx-eyebrow">Composer</p>
          <h2>{draft.subject}</h2>
        </div>
        <div className="arx-action-row">
          {rewriteActions.map((action,) => (
            <button
              key={action.tone}
              type="button"
              className="arx-button"
              onClick={() => void onRewrite(action.tone,)}
              disabled={busy}
            >
              <Sparkles size={16} />
              {action.label}
            </button>
          ),)}
          <button type="button" className="arx-button arx-button-primary" onClick={() => void onSend()} disabled={busy}>
            <Send size={16} />
            Send
          </button>
        </div>
      </div>

      <div className="arx-field-stack">
        <label className="arx-field">
          <span>To</span>
          <input
            value={participantsToField(draft.to,)}
            onChange={(event,) => onChange(buildDraftPatch(draft, { to: parseRecipientField(event.target.value,), },),)}
          />
        </label>
        <label className="arx-field">
          <span>Subject</span>
          <input value={draft.subject} onChange={(event,) => onChange(buildDraftPatch(draft, { subject: event.target.value, },),)} />
        </label>
      </div>

      <ComposerEditor
        key={draft.id}
        content={draft.tiptapJson}
        onChange={(doc,) => onChange(buildDraftPatch(draft, { tiptapJson: doc, },),)}
      />

      <div className="arx-draft-preview">
        <div>
          <p className="arx-eyebrow">Plaintext preview</p>
          <pre>{draft.text || textToDoc("",).content?.toString() || ""}</pre>
        </div>
        <div>
          <p className="arx-eyebrow">HTML preview</p>
          <div className="arx-html-preview" dangerouslySetInnerHTML={{ __html: draft.html, }} />
        </div>
      </div>
    </section>
  );
}

