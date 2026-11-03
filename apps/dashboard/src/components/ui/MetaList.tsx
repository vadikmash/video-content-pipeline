import { Fragment } from "react";
import { CopyButton } from "./CopyButton";
import { cx } from "./format";
import type { MetaItem } from "./types";

export function MetaList({ items, className }: { items: MetaItem[]; className?: string }) {
  return (
    <dl className={cx("vcp-meta", className)}>
      {items.map((it) => (
        <Fragment key={it.label}>
          <dt>{it.label}</dt>
          <dd className={it.mono ? "is-mono" : undefined}>
            {it.value}
            {it.copy ? (
              <CopyButton text={typeof it.copy === "string" ? it.copy : String(it.value)} label={it.label} />
            ) : null}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}
