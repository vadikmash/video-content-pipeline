import type { ReactNode } from "react";
import { cx } from "./format";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";
import type { RunStatus } from "./types";

export interface PanelProps {
  title: ReactNode;
  meta?: ReactNode;
  status?: RunStatus;
  actions?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  id?: string;
  className?: string;
  children?: ReactNode;
}

export function Panel({ title, meta, status, actions, collapsible, defaultOpen, id, className, children }: PanelProps) {
  const head = (
    <>
      <div className="vcp-panel-titles">
        <h2 className="vcp-panel-title">{title}</h2>
        {meta ? <span className="vcp-panel-meta">{meta}</span> : null}
      </div>
      {status ? <StatusBadge status={status} size="sm" /> : null}
      {actions ? <div className="vcp-panel-actions">{actions}</div> : null}
    </>
  );
  if (collapsible) {
    return (
      <details className={cx("vcp-panel", className)} id={id} open={defaultOpen}>
        <summary className="vcp-panel-head">
          <Icon name="chevron" size={16} className="vcp-panel-chev" />
          {head}
        </summary>
        <div className="vcp-panel-body">{children}</div>
      </details>
    );
  }
  return (
    <section className={cx("vcp-panel", className)} id={id}>
      <div className="vcp-panel-head">{head}</div>
      <div className="vcp-panel-body">{children}</div>
    </section>
  );
}
