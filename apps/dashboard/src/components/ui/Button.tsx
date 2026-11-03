import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./format";
import { Icon } from "./Icon";
import type { IconName } from "./types";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: IconName;
  iconRight?: IconName;
  /** Renders a link instead of a button. External, `download` and `target` links use a plain `<a>`. */
  href?: string;
  download?: boolean;
  target?: string;
  block?: boolean;
  children?: ReactNode;
}

/** Defaults to `type="submit"` so it posts its form; pass `type="button"` for client-side toggles. */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  href,
  download,
  target,
  block,
  className,
  children,
  type = "submit",
  ...rest
}: ButtonProps) {
  const iconSize = size === "sm" ? 14 : 16;
  const cls = cx(
    "vcp-btn",
    `vcp-btn--${variant}`,
    `vcp-btn--${size}`,
    block && "vcp-btn--block",
    children == null && "vcp-btn--icon",
    className,
  );
  const inner = (
    <>
      {icon ? <Icon name={icon} size={iconSize} /> : null}
      {children != null ? <span>{children}</span> : null}
      {iconRight ? <Icon name={iconRight} size={iconSize} /> : null}
    </>
  );

  if (href) {
    const label = rest["aria-label"];
    if (download || target || /^https?:/.test(href)) {
      return (
        <a
          className={cls}
          href={href}
          download={download ? "" : undefined}
          target={target}
          rel={target === "_blank" ? "noreferrer" : undefined}
          aria-label={label}
        >
          {inner}
        </a>
      );
    }
    return (
      <Link className={cls} href={href} aria-label={label}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} {...rest}>
      {inner}
    </button>
  );
}
