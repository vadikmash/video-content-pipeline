import type { IconName } from "./types";
import { cx } from "./format";

type Shape = ["path" | "circle", Record<string, string | number>];

const ICONS: Record<IconName, Shape[]> = {
  check: [["path", { d: "M5 12.5l4.5 4.5L19 7.5" }]],
  x: [["path", { d: "M6.5 6.5l11 11M17.5 6.5l-11 11" }]],
  pause: [["path", { d: "M9 6.5v11M15 6.5v11" }]],
  pending: [["circle", { cx: 12, cy: 12, r: 6 }]],
  running: [
    ["circle", { cx: 12, cy: 12, r: 6 }],
    ["path", { d: "M12 6a6 6 0 0 1 0 12z", fill: "currentColor", stroke: "none" }],
  ],
  dot: [["circle", { cx: 12, cy: 12, r: 3.5, fill: "currentColor", stroke: "none" }]],
  star: [["path", { d: "M12 4.5l2.3 4.7 5.2.7-3.8 3.6.9 5.1L12 16.2l-4.6 2.4.9-5.1-3.8-3.6 5.2-.7z" }]],
  play: [["path", { d: "M8 5.5v13l10.5-6.5z", fill: "currentColor" }]],
  download: [["path", { d: "M12 4v11M7 10.5l5 5 5-5M5 20h14" }]],
  external: [["path", { d: "M14 4.5h5.5V10M19.5 4.5L11 13M18 14.5v5H4.5V6h5" }]],
  chevron: [["path", { d: "M6.5 9.5l5.5 5.5 5.5-5.5" }]],
  plus: [["path", { d: "M12 5v14M5 12h14" }]],
  search: [
    ["circle", { cx: 11, cy: 11, r: 6.5 }],
    ["path", { d: "M16 16l4 4" }],
  ],
  restore: [["path", { d: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5V9H9" }]],
  log: [["path", { d: "M6.5 3.5h8l4 4v13h-12zM14.5 3.5v4h4M9.5 12.5h6M9.5 16h6" }]],
  alert: [["path", { d: "M12 4l9 16H3zM12 10v4.5M12 17.2v.3" }]],
  clock: [
    ["circle", { cx: 12, cy: 12, r: 8 }],
    ["path", { d: "M12 8v4.5l3 2" }],
  ],
  copy: [["path", { d: "M9 9h10.5v10.5H9zM15 9V4.5H4.5V15H9" }]],
  arrow: [["path", { d: "M5 12h14M13 6l6 6-6 6" }]],
  web: [
    ["circle", { cx: 12, cy: 12, r: 8 }],
    ["path", { d: "M4 12h16M12 4c2.4 2.4 3.5 5 3.5 8s-1.1 5.6-3.5 8c-2.4-2.4-3.5-5-3.5-8s1.1-5.6 3.5-8z" }],
  ],
  edit: [["path", { d: "M4.5 19.5l1-4L15 6l3 3-9.5 9.5zM13 8l3 3" }]],
};

export interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  /** Set when the icon stands alone; otherwise it is hidden from assistive tech. */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 16, stroke = 2, label, className }: IconProps) {
  return (
    <svg
      className={cx("vcp-icon", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {ICONS[name].map(([tag, attrs], i) => (tag === "circle" ? <circle key={i} {...attrs} /> : <path key={i} {...attrs} />))}
    </svg>
  );
}
