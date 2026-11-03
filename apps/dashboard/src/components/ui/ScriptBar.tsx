import type { ReactNode } from "react";

/** The script's top line: mono summary on the left, actions on the right. Shared by read and edit modes. */
export function ScriptBar({ meta, children }: { meta: string; children?: ReactNode }) {
  return (
    <div className="vcp-script-bar">
      <span className="vcp-mono vcp-muted">{meta}</span>
      {children ? <div className="vcp-row">{children}</div> : null}
    </div>
  );
}
