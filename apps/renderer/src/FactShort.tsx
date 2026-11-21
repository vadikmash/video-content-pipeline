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
  useDelayRender,
} from "remotion";
import { captionChunks, captionLines, chunkAt } from "./captions";
import { CAPTION_FONT, captionFontReady } from "./fonts";
import { visualTimeline, visualSequences } from "./visual-timeline";
import { ProcessVisual } from "./ProcessVisual";
import { musicVolume, speechSpans } from "./music";
import { CAPTION_LAYOUT, type FactShortProps, type SceneProp, type WordProp } from "./props";

const BG = "#0f172a";
const TEXT = "#f8fafc";
const FONT = "Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif";

export const FactShort: React.FC<FactShortProps> = (props) => {
  const { fps } = useVideoConfig();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  React.useEffect(() => {
    const handle = delayRender("Load caption font");
    let active = true;
    void captionFontReady.then(() => {
      if (active) continueRender(handle);
    }).catch((error) => {
      if (active) cancelRender(error);
    });
    return () => {
      active = false;
      continueRender(handle);
    };
  }, [delayRender, continueRender, cancelRender]);
  const toFrames = (s: number) => Math.max(0, Math.round(s * fps));
  const frame = useCurrentFrame();
  const spans = React.useMemo(() => speechSpans(props.words), [props.words]);
  const timeline = visualTimeline(props.scenes, fps, toFrames(props.durationSec));

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

      {visualSequences(timeline).map(({ scene, start, end, beatId }) => (
        <Sequence
          key={beatId}
          from={start}
          durationInFrames={end - start}
          name={`${beatId}:${scene.kind}`}
        >
          <Scene scene={scene} />
        </Sequence>
      ))}

      <Captions words={props.words} timeline={timeline} />
    </AbsoluteFill>
  );
};


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

const Captions: React.FC<{ words: WordProp[]; timeline: ReturnType<typeof visualTimeline> }> = ({ words, timeline }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;
  const chunks = React.useMemo(() => captionChunks(words), [words]);
  const chunk = chunkAt(chunks, time);
  if (!chunk) return null;
  const interval = timeline.find(({ start, end }) => frame >= start && frame < end);
  const position = interval?.captionPosition ?? "bottom";
  const lines = captionLines(chunk.words);
  const top = height * (position.startsWith("top") ? CAPTION_LAYOUT.top : CAPTION_LAYOUT.bottom);
  return (
    <div style={{
      position: "absolute", top, left: width / 12, right: width / 12,
      transform: "translateY(-50%)", display: "flex", flexDirection: "column",
      alignItems: "center", gap: 12, color: "#f8fafc",
      fontFamily: CAPTION_FONT, fontWeight: 700, fontSize: CAPTION_LAYOUT.fontSize, lineHeight: 1.38,
      textAlign: "center",
    }}>
      {lines.map((line, index) => (
        <div key={index} style={{
          maxWidth: "100%", boxSizing: "border-box", overflowWrap: "anywhere",
          padding: "6px 22px", borderRadius: 18, background: "rgba(5, 13, 25, 0.78)",
          textShadow: "0 2px 5px rgba(0,0,0,0.25)",
        }}>
          {line.map((word) => word.text).join(" ")}
        </div>
      ))}
    </div>
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
