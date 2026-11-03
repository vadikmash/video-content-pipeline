"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { cx, mediaTime } from "./format";
import { Icon } from "./Icon";

export interface AudioPlayerProps {
  src?: string;
  /** Seconds. */
  duration: number;
  title?: string;
  meta?: ReactNode;
  /** Varies the drawn waveform; it is decorative and does not reflect the real signal. */
  seed?: number;
  className?: string;
}

function waveBars(seed: number): number[] {
  const bars: number[] = [];
  let s = seed;
  for (let i = 0; i < 64; i++) {
    s = (s * 9301 + 49297) % 233280;
    bars.push(0.18 + 0.5 * Math.abs(Math.sin(i * 0.37)) + 0.32 * (s / 233280));
  }
  return bars;
}

export function AudioPlayer({ src, duration, title = "Narration", meta, seed = 7, className }: AudioPlayerProps) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const bars = useMemo(() => waveBars(seed), [seed]);
  const progress = duration ? pos / duration : 0;

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }

  function seekTo(t: number) {
    const clamped = Math.max(0, Math.min(duration, t));
    if (ref.current) ref.current.currentTime = clamped;
    setPos(clamped);
  }

  function onWaveClick(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    seekTo(((e.clientX - r.left) / r.width) * duration);
  }

  function onWaveKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") seekTo(pos + 5);
    else if (e.key === "ArrowLeft") seekTo(pos - 5);
    else return;
    e.preventDefault();
  }

  return (
    <div className={cx("vcp-audio", className)}>
      {src ? (
        <audio
          ref={ref}
          src={src}
          preload="metadata"
          onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      ) : null}
      <button
        type="button"
        className="vcp-audio-play"
        aria-label={playing ? "Pause narration" : "Play narration"}
        onClick={toggle}
        disabled={!src}
      >
        <Icon name={playing ? "pause" : "play"} size={16} stroke={2.5} />
      </button>
      <div className="vcp-audio-body">
        <div className="vcp-audio-head">
          <span className="vcp-audio-title">{title}</span>
          <span className="vcp-mono vcp-muted">
            {mediaTime(pos)} / {mediaTime(duration)}
          </span>
        </div>
        <div
          className="vcp-wave"
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={mediaTime(pos)}
          onClick={onWaveClick}
          onKeyDown={onWaveKey}
        >
          {bars.map((b, k) => (
            <span
              key={k}
              className={k / bars.length < progress ? "is-played" : undefined}
              style={{ height: `${Math.round(b * 100)}%` }}
            />
          ))}
        </div>
        {meta ? <div className="vcp-audio-meta">{meta}</div> : null}
      </div>
    </div>
  );
}
