import type { ReactNode } from "react";
import { Button } from "./Button";
import { cx } from "./format";
import { Icon } from "./Icon";
import { MetaList } from "./MetaList";
import type { MetaItem } from "./types";

export interface VerticalPreviewProps {
  src?: string;
  poster?: string;
  duration?: string;
  caption?: string;
  meta?: MetaItem[];
  downloadHref?: string;
  thumbnailHref?: string;
  className?: string;
  children?: ReactNode;
}

export function VerticalPreview({
  src,
  poster,
  duration,
  caption,
  meta = [],
  downloadHref,
  thumbnailHref,
  className,
  children,
}: VerticalPreviewProps) {
  return (
    <div className={cx("vcp-vp", className)}>
      <div className="vcp-vp-inner">
        <div className="vcp-vp-frame">
          {src ? (
            <video src={src} poster={poster} controls playsInline preload="metadata" />
          ) : (
            <div className="vcp-vp-placeholder">
              {duration ? <span className="vcp-vp-dur">{duration}</span> : null}
              <span className="vcp-vp-play">
                <Icon name="play" size={20} label="Play preview" />
              </span>
              {caption ? <span className="vcp-vp-caption">{caption}</span> : null}
            </div>
          )}
        </div>
        <div className="vcp-vp-side">
          <MetaList items={meta} />
          {downloadHref || thumbnailHref ? (
            <div className="vcp-row">
              {downloadHref ? (
                <Button icon="download" href={downloadHref} download>
                  Download MP4
                </Button>
              ) : null}
              {thumbnailHref ? (
                <Button variant="ghost" icon="download" href={thumbnailHref} download>
                  Thumbnail
                </Button>
              ) : null}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
