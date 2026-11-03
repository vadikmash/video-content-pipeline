import type { ReactNode } from "react";
import { cx } from "./format";
import { Icon } from "./Icon";
import type { IconName } from "./types";

export interface EmptyStateProps {
  title: ReactNode;
  icon?: IconName;
  compact?: boolean;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({ title, icon, compact, action, className, children }: EmptyStateProps) {
  return (
    <div className={cx("vcp-empty", compact && "vcp-empty--compact", className)}>
      {icon ? (
        <span className="vcp-empty-icon">
          <Icon name={icon} size={compact ? 16 : 20} />
        </span>
      ) : null}
      <div className="vcp-empty-text">
        <p className="vcp-empty-title">{title}</p>
        {children ? <p className="vcp-empty-body">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}
