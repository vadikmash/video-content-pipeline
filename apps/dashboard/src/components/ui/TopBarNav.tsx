"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./format";

export interface TopBarItem {
  key: string;
  label: string;
  href: string;
  count?: number;
  /** Amber count of things waiting on the operator. */
  attention?: number;
}

/** Client only for `usePathname`: the root layout does not re-render on navigation. */
export function TopBarNav({ items }: { items: TopBarItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="vcp-top-nav" aria-label="Main">
      {items.map((it) => {
        const on = pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.key}
            href={it.href}
            className={cx("vcp-top-link", on && "is-active")}
            aria-current={on ? "page" : undefined}
          >
            {it.label}
            {it.attention ? (
              <span className="vcp-top-attn" title={`${it.attention} waiting on you`}>
                {it.attention}
              </span>
            ) : it.count != null ? (
              <span className="vcp-top-count">{it.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
