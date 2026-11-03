import { cx } from "./format";
import { Icon } from "./Icon";
import { stageIcon, stageWord } from "./StatusBadge";
import type { StageRun } from "./types";

export interface StageRailProps {
  stages: StageRun[];
  className?: string;
}

export function StageRail({ stages, className }: StageRailProps) {
  return (
    <ol className={cx("vcp-rail", className)} aria-label="Pipeline stages">
      {stages.map((s) => {
        const meta = [s.provider, s.duration, s.attempt && s.attempt > 1 ? `attempt ${s.attempt}` : undefined].filter(
          Boolean,
        );
        return (
          <li key={s.key} className={cx("vcp-rail-step", `vcp-st-${s.status}`, s.gate && "vcp-rail-step--gate")}>
            <span className="vcp-rail-node">
              <Icon
                name={stageIcon(s.status)}
                size={12}
                stroke={2.5}
                className={s.status === "running" ? "vcp-spin" : undefined}
              />
            </span>
            <div className="vcp-rail-main">
              <div className="vcp-rail-title">
                <span className="vcp-rail-label">{s.label}</span>
                <span className="vcp-sr">, {stageWord(s.status)}</span>
                {s.gate ? <span className="vcp-rail-gate">Gate</span> : null}
                {s.status === "waiting" ? (
                  <span className="vcp-rail-paused" aria-hidden>
                    Paused for you
                  </span>
                ) : null}
                {s.status === "running" ? (
                  <span className="vcp-rail-running" aria-hidden>
                    Running
                  </span>
                ) : null}
              </div>
              {meta.length > 0 ? <div className="vcp-rail-meta">{meta.join(" · ")}</div> : null}
              {s.error ? (
                <div className="vcp-rail-error">
                  <Icon name="alert" size={12} />
                  <span>{s.error}</span>
                </div>
              ) : null}
            </div>
            {s.logsHref ? (
              <a
                className="vcp-rail-logs"
                href={s.logsHref}
                target="_blank"
                rel="noreferrer"
                aria-label={`Run logs for ${s.label}`}
              >
                <Icon name="log" size={14} />
                <span>Logs</span>
              </a>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
