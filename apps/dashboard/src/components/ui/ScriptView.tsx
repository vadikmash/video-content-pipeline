import { scriptText, type Script } from "@vcp/core";
import type { ReactNode } from "react";
import { cx, hostOf } from "./format";
import { ScriptBar } from "./ScriptBar";
import { StatusBadge } from "./StatusBadge";
import { Tag } from "./Tag";

export function scriptWords(script: Script): number {
  return scriptText(script).split(/\s+/).filter(Boolean).length;
}

/** `v3 · 72 words · ~32s` */
export function scriptMeta(script: Script): string {
  return [`v${script.version}`, `${scriptWords(script)} words`, `~${script.estimatedSeconds}s`].join(" · ");
}

/** Hook, beats, outro and claims; the part of the read view below the bar. */
export function ScriptBody({ script }: { script: Script }) {
  return (
    <>
      <div>
        <span className="vcp-kicker">Hook</span>
        <p className="vcp-script-hook">{script.hook}</p>
      </div>
      <div>
        <span className="vcp-kicker">Beats</span>
        <ol className="vcp-beats">
          {script.beats.map((b, k) => (
            <li key={b.id} className="vcp-beat">
              <span className="vcp-beat-n">{String(k + 1).padStart(2, "0")}</span>
              <p className="vcp-beat-text">{b.text}</p>
              <Tag className="vcp-beat-kind" title="Visual kind">
                {b.visual.kind}
              </Tag>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <span className="vcp-kicker">Outro</span>
        <p className="vcp-script-outro">{script.outro}</p>
      </div>
      {script.claims.length > 0 ? (
        <div>
          <span className="vcp-kicker">Claims</span>
          <ul className="vcp-claims">
            {script.claims.map((c, k) => (
              <li key={k}>
                <StatusBadge kind="claim" status="sourced" size="sm" />
                <span className="vcp-claim-text">
                  {c.text}{" "}
                  <span className={cx("vcp-mono vcp-claim-conf", c.confidence < 0.6 && "is-low")} title="Confidence">
                    {Math.round(c.confidence * 100)}%
                  </span>
                </span>
                <a className="vcp-claim-src" href={c.sourceUrl} target="_blank" rel="noreferrer">
                  {hostOf(c.sourceUrl)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

export function ScriptView({ script, actions }: { script: Script; actions?: ReactNode }) {
  return (
    <div className="vcp-script">
      <ScriptBar meta={scriptMeta(script)}>{actions}</ScriptBar>
      <ScriptBody script={script} />
    </div>
  );
}
