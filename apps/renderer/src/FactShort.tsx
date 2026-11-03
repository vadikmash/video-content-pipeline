import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { FactShortProps, SceneProp, WordProp } from "./props";

const BG = "#0f172a";
const ACCENT = "#fbbf24";
const TEXT = "#f8fafc";
const FONT = "Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif";

export const FactShort: React.FC<FactShortProps> = (props) => {
  const { fps } = useVideoConfig();
  const toFrames = (s: number) => Math.max(0, Math.round(s * fps));
  const closingStart = Math.max(0, props.durationSec - 2.5);

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: FONT, color: TEXT }}>
      {props.audioUrl ? <Audio src={props.audioUrl} /> : null}

      {props.scenes.map((scene) => (
        <Sequence
          key={scene.beatId}
          from={toFrames(scene.start)}
          durationInFrames={Math.max(1, toFrames(scene.end) - toFrames(scene.start))}
          name={`${scene.beatId}:${scene.kind}`}
        >
          <Scene scene={scene} />
        </Sequence>
      ))}

      <Sequence from={0} durationInFrames={toFrames(2.5)} name="title">
        <TitleCard title={props.title} />
      </Sequence>

      <Captions words={props.words} />

      <Sequence from={toFrames(closingStart)} name="closing">
        <ClosingCard sources={props.sources} synthetic={props.containsSyntheticMedia} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------

const Scene: React.FC<{ scene: SceneProp }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const asset = scene.asset;

  if ((scene.kind === "stock" || scene.kind === "clip") && asset?.kind === "video") {
    return (
      <AbsoluteFill>
        <OffthreadVideo src={asset.url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <Vignette />
        {asset.attribution ? <Attribution text={asset.attribution} /> : null}
      </AbsoluteFill>
    );
  }

  if (scene.kind === "still" && asset?.kind === "image") {
    const scale = interpolate(frame, [0, durationInFrames], [1, 1.12], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill>
        <Img src={asset.url} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
        <Vignette />
      </AbsoluteFill>
    );
  }

  if (scene.kind === "diagram") {
    return (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: 760, height: 760, border: `6px dashed ${ACCENT}`, borderRadius: 32, opacity: 0.6 }} />
      </AbsoluteFill>
    );
  }

  // kinetic typography (default)
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(frame, [0, 8], [40, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 96 }}>
      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          lineHeight: 1.15,
          textAlign: "center",
          opacity,
          transform: `translateY(${y}px)`,
        }}
      >
        {scene.text}
      </div>
    </AbsoluteFill>
  );
};

const TitleCard: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(frame, [0, 10, durationInFrames - 12, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 220, opacity }}>
      <div
        style={{
          background: ACCENT,
          color: BG,
          padding: "20px 40px",
          borderRadius: 20,
          fontSize: 56,
          fontWeight: 900,
          maxWidth: 900,
          textAlign: "center",
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  );
};

const Captions: React.FC<{ words: WordProp[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const idx = words.findIndex((w) => t >= w.start && t < w.end);
  if (idx < 0) return null;
  const windowStart = Math.max(0, idx - 3);
  const slice = words.slice(windowStart, windowStart + 7);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 360 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 14,
          maxWidth: 940,
          fontSize: 54,
          fontWeight: 700,
          textShadow: "0 4px 24px rgba(0,0,0,0.8)",
        }}
      >
        {slice.map((w, i) => {
          const active = windowStart + i === idx;
          return (
            <span key={`${w.start}-${i}`} style={{ color: active ? ACCENT : TEXT, opacity: active ? 1 : 0.85 }}>
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const ClosingCard: React.FC<{ sources: string[]; synthetic: boolean }> = ({ sources, synthetic }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", backgroundColor: BG, opacity, padding: 96 }}>
      <div style={{ fontSize: 44, fontWeight: 800, marginBottom: 32, color: ACCENT }}>Sources</div>
      {sources.slice(0, 4).map((s) => (
        <div key={s} style={{ fontSize: 30, opacity: 0.85, marginBottom: 12, wordBreak: "break-all", textAlign: "center" }}>
          {s.replace(/^https?:\/\//, "")}
        </div>
      ))}
      {synthetic ? (
        <div style={{ marginTop: 48, fontSize: 28, opacity: 0.7 }}>Contains AI-generated imagery</div>
      ) : null}
    </AbsoluteFill>
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.65) 100%)" }}
  />
);

const Attribution: React.FC<{ text: string }> = ({ text }) => (
  <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: 40 }}>
    <div style={{ fontSize: 22, opacity: 0.6 }}>{text}</div>
  </AbsoluteFill>
);
