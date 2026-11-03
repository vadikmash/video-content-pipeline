"use client";

import type { Script } from "@vcp/core";
import { useState, useTransition, type ReactNode } from "react";
import { saveScriptEdit } from "@/app/projects/[id]/actions";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ScriptBar } from "@/components/ui/ScriptBar";
import { Tag } from "@/components/ui/Tag";

/** The script panel body: `children` is the read view; "Edit script" swaps in a form that saves a new version. */
export function ScriptEditor({
  projectId,
  script,
  meta,
  editable,
  children,
}: {
  projectId: string;
  script: Script;
  meta: string;
  editable: boolean;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = script.version + 1;

  if (!editable || !editing) {
    return (
      <div className="vcp-script">
        <ScriptBar meta={meta}>
          {editable ? (
            <Button type="button" size="sm" icon="edit" onClick={() => setEditing(true)}>
              Edit script
            </Button>
          ) : null}
        </ScriptBar>
        {children}
      </div>
    );
  }

  return (
    <form
      className="vcp-script vcp-script--editing"
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
      <ScriptBar meta={`Editing v${script.version} → saves as v${next}`}>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" disabled={pending}>
          {pending ? "Saving…" : `Save v${next}`}
        </Button>
      </ScriptBar>

      {error ? (
        <Notice tone="failed" title="Couldn't save" role="alert">
          {error}
        </Notice>
      ) : null}

      <label className="vcp-field">
        <span className="vcp-kicker">Hook</span>
        <textarea className="vcp-input vcp-textarea" name="hook" defaultValue={script.hook} required rows={2} />
      </label>

      <div>
        <span className="vcp-kicker">Beats</span>
        <ol className="vcp-beats">
          {script.beats.map((b, k) => (
            <li key={b.id} className="vcp-beat vcp-beat--edit">
              <span className="vcp-beat-n">{String(k + 1).padStart(2, "0")}</span>
              <textarea
                className="vcp-input vcp-textarea"
                name={`beat:${b.id}`}
                aria-label={`Beat ${k + 1}`}
                defaultValue={b.text}
                required
                rows={2}
              />
              <Tag className="vcp-beat-kind" title="Visual kind; kept on save">
                {b.visual.kind}
              </Tag>
            </li>
          ))}
        </ol>
      </div>

      <label className="vcp-field">
        <span className="vcp-kicker">Outro</span>
        <textarea className="vcp-input vcp-textarea" name="outro" defaultValue={script.outro} required rows={1} />
      </label>

      <p className="vcp-field-hint">Claims and visual intents are kept. Approve uses the latest version.</p>
    </form>
  );
}
