"use client";

import { useEffect, useState } from "react";
import { cx } from "./format";

const WORD = { live: "Live", paused: "Paused", idle: "Not polling" } as const;

export interface LiveIndicatorProps {
  state?: keyof typeof WORD;
  /** Server render time in ms; each poll re-renders the page and resets it. */
  updatedAt?: number;
  className?: string;
}

export function LiveIndicator({ state = "live", updatedAt, className }: LiveIndicatorProps) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [updatedAt]);
  const ago = updatedAt != null && now != null ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;
  return (
    <span className={cx("vcp-live", `vcp-live--${state}`, className)} role="status">
      <span className="vcp-live-dot" aria-hidden />
      <span>{WORD[state]}</span>
      {ago != null ? <span className="vcp-live-ago">updated {ago}s ago</span> : null}
    </span>
  );
}
