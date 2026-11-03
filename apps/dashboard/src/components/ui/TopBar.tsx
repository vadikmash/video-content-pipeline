import Link from "next/link";
import type { ReactNode } from "react";
import { TopBarNav, type TopBarItem } from "./TopBarNav";

export interface TopBarProps {
  items: TopBarItem[];
  homeHref?: string;
  right?: ReactNode;
}

export function TopBar({ items, homeHref = "/", right }: TopBarProps) {
  return (
    <header className="vcp-top">
      <Link className="vcp-top-brand" href={homeHref}>
        <span className="vcp-top-mark">VCP</span>
        <span className="vcp-top-sub">pipeline</span>
      </Link>
      <TopBarNav items={items} />
      {right ? <div className="vcp-top-right">{right}</div> : null}
    </header>
  );
}
