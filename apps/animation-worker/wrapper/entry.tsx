/**
 * Trusted wrapper copied next to the authored module in each job. It registers
 * one visual-only composition in the 1080x1920 design space; draft output is
 * produced with the renderer's `scale`, so authored coordinates never change.
 */
import React from "react";
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from "remotion";
import type { SequenceProps } from "@vcp/motion";
import Authored from "./sequence";

type Input = Omit<SequenceProps, "frame" | "width" | "height">;

const Visual: React.FC<{ sequence: Input }> = ({ sequence }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <Authored {...sequence} frame={frame} width={1080} height={1920} />
    </AbsoluteFill>
  );
};

const placeholder: Input = {
  fps: 30, durationInFrames: 1, seed: 0, cues: {}, beats: [],
  style: { id: "none", palette: {}, notes: "" }, poses: { start: {}, end: {} },
};

registerRoot(() => (
  <Composition
    id="AuthoredSequence"
    component={Visual}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={1}
    defaultProps={{ sequence: placeholder }}
    calculateMetadata={({ props }) => ({ fps: props.sequence.fps, durationInFrames: props.sequence.durationInFrames })}
  />
));
