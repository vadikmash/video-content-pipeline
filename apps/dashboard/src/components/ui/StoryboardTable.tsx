import type { ReactNode } from "react";
import { cx } from "./format";
import { Icon } from "./Icon";
import { Tag } from "./Tag";

export interface StoryboardRow {
  beat: number;
  time: string;
  kind: string;
  visual: string;
  thumb?: string;
  assetStatus?: "ready" | "missing" | "failed";
  assetName?: string;
  attribution?: ReactNode;
}

function Thumb({ src, kind, status, title }: { src?: string; kind: string; status?: StoryboardRow["assetStatus"]; title?: string }) {
  const st = status ?? (src ? "ready" : "missing");
  return (
    <span className={cx("vcp-thumb", `vcp-thumb--${st}`)} title={title}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : st === "failed" ? (
        <Icon name="alert" size={14} label="Asset failed" />
      ) : st === "ready" ? (
        <span className="vcp-thumb-kind">{kind.slice(0, 3)}</span>
      ) : (
        <Icon name="pending" size={12} label="Asset pending" />
      )}
    </span>
  );
}

export function StoryboardTable({ rows, className }: { rows: StoryboardRow[]; className?: string }) {
  return (
    <div className={cx("vcp-sb", className)}>
      <table className="vcp-sb-table">
        <thead>
          <tr>
            {["Beat", "Time", "Visual", "Asset", "Attribution"].map((t) => (
              <th key={t} scope="col">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.beat} className={r.assetStatus === "failed" ? "is-failed" : undefined}>
              <td className="vcp-sb-beat">{String(r.beat).padStart(2, "0")}</td>
              <td className="vcp-sb-time">{r.time}</td>
              <td className="vcp-sb-visual">
                <Tag>{r.kind}</Tag>
                <span>{r.visual}</span>
              </td>
              <td className="vcp-sb-asset">
                <Thumb src={r.thumb} kind={r.kind} status={r.assetStatus} title={r.assetName} />
              </td>
              <td className="vcp-sb-attr">{r.attribution ?? <span className="vcp-faint">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
