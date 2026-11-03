"use client";

import type { Script } from "@vcp/core";
import { useState, useTransition } from "react";
import { saveScriptEdit } from "@/app/projects/[id]/actions";

export function ScriptEditor({
  projectId,
  script,
  editable,
}: {
  projectId: string;
  script: Script;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editable || !editing) {
    return (
      <>
        <p>
          <strong>Hook.</strong> {script.hook}
        </p>
        <ol>
          {script.beats.map((b) => (
            <li key={b.id}>
              {b.text} <span className="badge">{b.visual.kind}</span>
            </li>
          ))}
        </ol>
        <p>
          <strong>Outro.</strong> {script.outro}
        </p>
        <div className="small muted" style={{ marginBottom: 10 }}>
          ~{script.estimatedSeconds}s · {script.claims.length} claims · {script.provider}
        </div>
        {editable ? (
          <button type="button" onClick={() => setEditing(true)}>
            Edit script
          </button>
        ) : null}
      </>
    );
  }

  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          try {
            await saveScriptEdit(projectId, fd);
            setEditing(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          }
        });
      }}
    >
      <label>Hook</label>
      <textarea name="hook" defaultValue={script.hook} required rows={3} />

      {script.beats.map((b, i) => (
        <div key={b.id} style={{ marginTop: 10 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <label style={{ margin: 0 }}>
              Beat {i + 1} ({b.id})
            </label>
            <span className="badge">{b.visual.kind}</span>
          </div>
          <textarea name={`beat:${b.id}`} defaultValue={b.text} required rows={3} />
        </div>
      ))}

      <label>Outro</label>
      <textarea name="outro" defaultValue={script.outro} required rows={2} />

      {error ? (
        <div className="small" style={{ color: "var(--bad)", marginTop: 8 }}>
          {error}
        </div>
      ) : null}

      <div className="row" style={{ marginTop: 12 }}>
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Saving…" : "Save as new version"}
        </button>
        <button type="button" disabled={pending} onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
      <p className="small muted">
        Saves a new script version. Claims and visual intents are kept. Approve uses the latest version.
      </p>
    </form>
  );
}
