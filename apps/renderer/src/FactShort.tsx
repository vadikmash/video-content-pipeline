import React from "react";
import {
  AbsoluteFill,
  Audio,
  Freeze,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { captionChunks, captionFontSize, chunkAt } from "./captions";
import { CAPTION_FONT } from "./fonts";
import { ProcessVisual } from "./ProcessVisual";
import { musicVolume, speechSpans } from "./music";
import type { FactShortProps, SceneProp, WordProp } from "./props";

const BG = "#0f172a";
const ACCENT = "#fbbf24";
const TEXT = "#f8fafc";
const FONT = "Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif";

export const FactShort: React.FC<FactShortProps> = (props) => {
  const { fps } = useVideoConfig();
  const toFrames = (s: number) => Math.max(0, Math.round(s * fps));
  const closingStart = Math.max(0, props.durationSec - 2.5);
  const frame = useCurrentFrame();
  const spans = React.useMemo(() => speechSpans(props.words), [props.words]);
  const timeline = visualTimeline(props.scenes, fps, toFrames(props.durationSec));
  const showDiagram = timeline.some(({ start, end, scene }) => frame >= start && frame < end && scene.diagram);

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: FONT, color: TEXT }}>
      {props.musicUrl ? (
        <Audio
          src={props.musicUrl}
          loop
          // Absolute composition time: with loop, the volume callback's frame restarts every iteration.
          volume={musicVolume(frame / fps, spans, props.durationSec)}
        />
      ) : null}
      {props.audioUrl ? <Audio src={props.audioUrl} /> : null}

      {timeline.map(({ scene, start, end, beatId }) => (
        <Sequence
          key={beatId}
          from={start}
          durationInFrames={end - start}
          name={`${beatId}:${scene.kind}`}
        >
          <Scene scene={scene} />
        </Sequence>
      ))}

      <Sequence from={0} durationInFrames={toFrames(2.5)} name="title">
        <TitleCard title={props.title} />
      </Sequence>

      <Captions words={props.words} showDiagram={showDiagram} />

      <Sequence from={toFrames(closingStart)} name="closing">
        <ClosingCard sources={props.sources} synthetic={props.containsSyntheticMedia} />
      </Sequence>
    </AbsoluteFill>
  );
};

function visualTimeline(scenes: SceneProp[], fps: number, duration: number) {
  const sorted = [...scenes].sort((a, b) => a.start - b.start);
  const hasVisual = (scene: SceneProp) => scene.diagram || scene.asset?.kind === "image" || scene.asset?.kind === "video";
  const still = sorted.find((scene) => scene.asset?.kind === "image");
  const firstVisual = sorted.find(hasVisual);
  let previousVisual: SceneProp | undefined;
  const intervals = sorted.flatMap((scene, index) => {
    // The visual remains on screen through pauses. The last beat also covers the source card.
    const start = index === 0 ? 0 : Math.max(0, Math.round(scene.start * fps));
    const next = sorted[index + 1];
    const end = next ? Math.min(duration, Math.round(next.start * fps)) : duration;
    if (end <= start) return [];
    const visual = hasVisual(scene) ? scene : (scene.beatId === "outro" ? still : undefined) ?? previousVisual ?? firstVisual ?? scene;
    if (hasVisual(scene)) previousVisual = scene;
    return [{ scene: visual, start, end, beatId: scene.beatId }];
  });
  return intervals.length ? intervals : [{
    scene: { beatId: "visual", kind: "type" as const, start: 0, end: duration / fps, text: "" },
    start: 0, end: duration, beatId: "visual",
  }];
}

const Scene: React.FC<{ scene: SceneProp }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const asset = scene.asset;

  if (asset?.kind === "video") {
    const lastFrame = asset.durationSec === undefined ? null : Math.max(0, Math.floor(asset.durationSec * fps) - 1);
    const video = <OffthreadVideo src={asset.url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
    return (
      <AbsoluteFill>
        {lastFrame !== null && frame > lastFrame ? <Freeze frame={lastFrame}>{video}</Freeze> : video}
        <Vignette />
        {asset.attribution ? <Attribution text={asset.attribution} /> : null}
      </AbsoluteFill>
    );
  }

  // A stock search can resolve to a generated still when it finds no footage.
  if (asset?.kind === "image") {
    const scale = interpolate(frame, [0, durationInFrames], [1, 1.12], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill>
        <Img src={asset.url} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
        <Vignette />
      </AbsoluteFill>
    );
  }

  if (scene.diagram) return <ProcessVisual diagram={scene.diagram} />;
  return <Backdrop />;
};

/** Animated editorial texture when the storyboard has no usable media. */
const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const x = 50 + 18 * Math.sin(t / 7);
  const y = 42 + 12 * Math.cos(t / 9);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at ${x}% ${y}%, #275769 0%, ${BG} 72%)` }}>
      <AbsoluteFill style={{
        backgroundImage: "radial-gradient(#b5dbe870 2px, transparent 2px)",
        backgroundSize: "38px 38px",
        backgroundPosition: `${(frame * 0.7) % 38}px ${(frame * 0.4) % 38}px`,
      }} />
      {[0, 1, 2].map((index) => (
        <div key={index} style={{
          position: "absolute", width: 570 + index * 112, height: 570 + index * 112,
          border: `3px solid ${index === 1 ? "#fbbf2455" : "#9bdbff66"}`, borderRadius: "48%",
          left: 70 + index * 84, top: 425 + index * 60,
          transform: `rotate(${index * 34 + frame / 16}deg) scaleX(1.2)`,
        }} />
      ))}
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

/**
 * Big centred captions, one word at a time as it is said: white Impact with a
 * black outline. No highlight, no motion; each word replaces the last.
 */
const Captions: React.FC<{ words: WordProp[]; showDiagram: boolean }> = ({ words, showDiagram }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const chunks = React.useMemo(() => captionChunks(words), [words]);
  const chunk = chunkAt(chunks, frame / fps);
  if (!chunk) return null;
  const fontSize = captionFontSize(chunk.text, width - 140, 170, 90);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 80px", paddingTop: showDiagram ? 920 : 0 }}>
      <div
        style={{
          fontFamily: CAPTION_FONT,
          fontSize,
          lineHeight: 1.1,
          color: "#ffffff",
          textAlign: "center",
          whiteSpace: "nowrap",
          WebkitTextStroke: `${Math.round(fontSize * 0.11)}px #000000`,
          paintOrder: "stroke fill",
          textShadow: "0 8px 24px rgba(0,0,0,0.55)",
        }}
      >
        {chunk.text}
      </div>
    </AbsoluteFill>
  );
};

const ClosingCard: React.FC<{ sources: string[]; synthetic: boolean }> = ({ sources, synthetic }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", opacity, padding: "0 96px 220px" }}>
      <div style={{ backgroundColor: "#081827dd", borderRadius: 28, padding: "32px 46px", width: "100%", textAlign: "center" }}>
      <div style={{ fontSize: 44, fontWeight: 800, marginBottom: 32, color: ACCENT }}>Sources</div>
      {sources.slice(0, 4).map((s) => (
        <div key={s} style={{ fontSize: 30, opacity: 0.85, marginBottom: 12, wordBreak: "break-all", textAlign: "center" }}>
          {s.replace(/^https?:\/\//, "")}
        </div>
      ))}
      {synthetic ? (
        <div style={{ marginTop: 48, fontSize: 28, opacity: 0.7 }}>Contains AI-generated imagery</div>
      ) : null}
      </div>
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
    <div style={{ fontSize: 25, backgroundColor: "#081827b0", borderRadius: 12, padding: "7px 12px" }}>{text}</div>
  </AbsoluteFill>
);
