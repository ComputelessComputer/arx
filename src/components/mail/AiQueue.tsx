import { CheckCircle2, Sparkles, } from "lucide-react";
import { useState, } from "react";
import type { AISuggestionBatch, } from "../../types/mail";

interface AiQueueProps {
  batches: AISuggestionBatch[];
  busy: boolean;
  onGenerate: () => Promise<void>;
  onApply: (suggestionIds: string[],) => Promise<void>;
}

export function AiQueue({ batches, busy, onGenerate, onApply, }: AiQueueProps,) {
  const latestBatch = batches[0] ?? null;
  const [selectedIds, setSelectedIds,] = useState<string[]>([],);

  const toggleSuggestion = (suggestionId: string,) => {
    setSelectedIds((current,) =>
      current.includes(suggestionId,)
        ? current.filter((entry,) => entry !== suggestionId)
        : [...current, suggestionId,]
    );
  };

  return (
    <section className="arx-panel arx-ai-queue">
      <div className="arx-panel-header">
        <div>
          <p className="arx-eyebrow">AI Review Queue</p>
          <h2>Suggest, then confirm</h2>
        </div>
        <button type="button" className="arx-button arx-button-primary" onClick={() => void onGenerate()} disabled={busy}>
          <Sparkles size={16} />
          {busy ? "Refreshing..." : "Generate batch"}
        </button>
      </div>

      {!latestBatch ? (
        <div className="arx-empty-state">
          <p>No suggestion batch yet. Generate one after syncing an account.</p>
        </div>
      ) : (
        <>
          <div className="arx-batch-summary">
            <strong>{latestBatch.summary}</strong>
            <span>{new Date(latestBatch.createdAt,).toLocaleString()}</span>
          </div>
          <div className="arx-suggestion-list">
            {latestBatch.suggestions.map((suggestion,) => (
              <label key={suggestion.id} className="arx-suggestion-card">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(suggestion.id,)}
                  onChange={() => toggleSuggestion(suggestion.id,)}
                />
                <div>
                  <div className="arx-suggestion-topline">
                    <strong>{suggestion.summary}</strong>
                    <span>{Math.round(suggestion.confidence * 100,)}%</span>
                  </div>
                  <p>{suggestion.reason}</p>
                  <span className="arx-pill">{suggestion.action}</span>
                </div>
              </label>
            ),)}
          </div>
          <button
            type="button"
            className="arx-button"
            disabled={selectedIds.length === 0 || busy}
            onClick={() => void onApply(selectedIds,).then(() => setSelectedIds([],))}
          >
            <CheckCircle2 size={16} />
            Apply selected
          </button>
        </>
      )}
    </section>
  );
}

