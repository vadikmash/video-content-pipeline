import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./format";
import { Icon } from "./Icon";
import type { IconName, Tone } from "./types";

const TONE_ICON: Partial<Record<Tone, IconName>> = { done: "check", failed: "alert", waiting: "pause", running: "running" };

export interface NoticeProps {
  tone?: Tone;
  title?: ReactNode;
  icon?: IconName;
  role?: string;
  /** Dismissing navigates here, e.g. the same URL without the params that raised the notice. */
  dismissHref?: string;
  /** Control on the right, e.g. a retry form. */
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Notice({ tone = "neutral", title, icon, role = "status", dismissHref, action, className, children }: NoticeProps) {
  return (
    <div className={cx("vcp-notice", `vcp-tone-${tone}`, className)} role={role}>
      <Icon name={icon ?? TONE_ICON[tone] ?? "dot"} size={16} />
      <div className="vcp-notice-body">
        {title ? <strong>{title}</strong> : null}
        {children ? <span>{children}</span> : null}
      </div>
      {action ? <div className="vcp-notice-action">{action}</div> : null}
      {dismissHref ? (
        <Link className="vcp-notice-x" href={dismissHref} aria-label="Dismiss" scroll={false}>
          <Icon name="x" size={14} />
        </Link>
      ) : null}
    </div>
  );
}
