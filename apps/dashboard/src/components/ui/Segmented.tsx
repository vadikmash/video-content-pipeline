import Link from "next/link";
import { cx } from "./format";

export interface SegmentedOption {
  value: string;
  label: string;
  count?: number;
  href: string;
}

/** A single-choice filter made of links, so the choice lives in the URL. */
export function Segmented({
  options,
  value,
  label,
  className,
}: {
  options: SegmentedOption[];
  value: string;
  label?: string;
  className?: string;
}) {
  return (
    <nav className={cx("vcp-segmented", className)} aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Link
            key={o.value}
            href={o.href}
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={cx("vcp-segmented-opt", on && "is-active")}
          >
            <span>{o.label}</span>
            {o.count != null ? <span className="vcp-segmented-count">{o.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
