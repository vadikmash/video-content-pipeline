"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/** The idea row's meta line plus its "Why" expander; the row itself stays a server component. */
export function IdeaWhy({
  tags,
  label,
  detail,
  defaultOpen = false,
}: {
  tags: ReactNode;
  label?: string;
  detail?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <div className="vcp-idea-meta">
        {tags}
        {detail && label ? (
          <button type="button" className="vcp-link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name="chevron" size={14} className={open ? "is-flipped" : undefined} />
            {label}
          </button>
        ) : null}
      </div>
      {open && detail ? <div className="vcp-idea-detail">{detail}</div> : null}
    </>
  );
}
