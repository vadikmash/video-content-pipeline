import type { ReactNode } from "react";
import { cx } from "./format";
import { Icon } from "./Icon";
import type { IconName } from "./types";

export interface TagProps {
  children: ReactNode;
  icon?: IconName;
  tone?: "waiting";
  title?: string;
  className?: string;
}

export function Tag({ children, icon, tone, title, className }: TagProps) {
  return (
    <span className={cx("vcp-tag", tone && `vcp-tag--${tone}`, className)} title={title}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}
