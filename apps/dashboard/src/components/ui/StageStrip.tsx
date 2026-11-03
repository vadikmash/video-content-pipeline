import { cx } from "./format";
import { currentIndex, isComplete } from "./stages";
import { stageWord } from "./StatusBadge";
import type { StageRun } from "./types";

export interface StageStripProps {
  stages: StageRun[];
  showLabel?: boolean;
  className?: string;
}

export function StageStrip({ stages, showLabel = true, className }: StageStripProps) {
  const ci = currentIndex(stages);
  const cur = stages[ci]!;
  const complete = isComplete(stages);
  return (
    <div
      className={cx("vcp-strip", className)}
      role="img"
      aria-label={`Stage ${ci + 1} of ${stages.length}: ${cur.label}, ${stageWord(cur.status)}`}
    >
      <div className="vcp-strip-bar">
        {stages.map((s, i) => (
          <span
            key={s.key}
            title={`${s.label} · ${stageWord(s.status)}`}
            className={cx(
              "vcp-strip-seg",
              `vcp-st-${s.status}`,
              s.gate && "vcp-strip-seg--gate",
              i === ci && !complete && "is-current",
            )}
          />
        ))}
      </div>
      {showLabel ? (
        <span className="vcp-strip-label">
          <span className="vcp-mono">
            {complete ? stages.length : ci + 1}/{stages.length}
          </span>{" "}
          <span className={cx("vcp-strip-word", `vcp-st-${cur.status}`)}>{complete ? "Published" : cur.label}</span>
        </span>
      ) : null}
    </div>
  );
}
