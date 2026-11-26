import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { VectorAnimation } from "@vcp/core/animation";

type Node = VectorAnimation["nodes"][number];
type Track = VectorAnimation["tracks"][number];

export function motionValue(
  track: Track,
  frame: number,
  fps: number,
  sceneStart: number,
): number {
  // Quantize absolute times before subtracting the scene start to match Sequence rounding.
  const frames = new Map(
    track.keyframes.map((keyframe) => [
      Math.round(keyframe.time * fps) - Math.round(sceneStart * fps),
      keyframe.value,
    ]),
  );
  const entries = [...frames];
  if (entries.length === 1) return entries[0]![1];
  return interpolate(
    frame,
    entries.map(([time]) => time),
    entries.map(([, value]) => value),
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
}

export function VectorScene({
  plan,
  sceneStart,
}: {
  plan: VectorAnimation;
  sceneStart: number;
}) {
  function draw(parentId: string | null): React.ReactNode {
    return plan.nodes
      .filter((node) => node.parentId === parentId)
      .map((node) => (
        <AnimatedNode
          key={node.id}
          node={node}
          tracks={plan.tracks.filter((track) => track.nodeId === node.id)}
          sceneStart={sceneStart}
        >
          {node.shape.kind === "group" ? draw(node.id) : null}
        </AnimatedNode>
      ));
  }
  return (
    <AbsoluteFill>
      <svg
        viewBox="0 0 1080 1920"
        width="100%"
        height="100%"
        role="img"
        aria-label={plan.description}
      >
        <defs>
          <radialGradient id="vector-background" cx="50%" cy="40%" r="75%">
            <stop stopColor="#183c50" />
            <stop offset="1" stopColor="#071522" />
          </radialGradient>
        </defs>
        <rect width="1080" height="1920" fill="url(#vector-background)" />
        {draw(null)}
      </svg>
    </AbsoluteFill>
  );
}

function AnimatedNode({
  node,
  tracks,
  sceneStart,
  children,
}: React.PropsWithChildren<{
  node: Node;
  tracks: Track[];
  sceneStart: number;
}>) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const values = { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, draw: 1 };
  for (const track of tracks)
    values[track.property] = motionValue(track, frame, fps, sceneStart);
  const shape = node.shape;
  return (
    <g
      transform={`translate(${node.x + values.x} ${node.y + values.y}) rotate(${values.rotate}) scale(${values.scale})`}
      opacity={values.opacity}
      fill={node.fill}
      stroke={node.stroke}
      strokeWidth={node.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shape.kind === "group" ? children : null}
      {shape.kind === "ellipse" ? (
        <ellipse rx={shape.rx} ry={shape.ry} />
      ) : null}
      {shape.kind === "rect" ? (
        <rect
          x={-shape.width / 2}
          y={-shape.height / 2}
          width={shape.width}
          height={shape.height}
          rx={shape.radius}
        />
      ) : null}
      {shape.kind === "path" ? (
        <path
          d={shape.d}
          pathLength={1}
          strokeDasharray={values.draw < 1 ? 1 : undefined}
          strokeDashoffset={values.draw < 1 ? 1 - values.draw : undefined}
        />
      ) : null}
      {shape.kind === "text" ? (
        <text
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontWeight="600"
          fontSize={shape.fontSize}
        >
          {shape.text}
        </text>
      ) : null}
    </g>
  );
}
