import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { OrbitalFreefall } from "./OrbitalFreefall";
import { LunarEclipse } from "./LunarEclipse";
import type { SceneProp } from "./props";

type Diagram = NonNullable<SceneProp["diagram"]>;
type Point = readonly [x: number, y: number];

const BLUE = "#63c6ff";
const PALE = "#b8abd5";
const ACTIVE = "#fbbf24";

export const ProcessVisual: React.FC<{ diagram: Diagram }> = ({ diagram }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  if (diagram.kind === "lunar-eclipse") return <LunarEclipse focus={diagram.focus} language={diagram.language} />;
  if (diagram.kind === "orbital-freefall") return <OrbitalFreefall focus={diagram.focus} language={diagram.language} />;
  if (diagram.kind === "octopus-circulation") {
    return <OctopusCirculation focus={diagram.focus} phase={frame / fps} />;
  }

  const { steps } = diagram;
  const stepFrames = durationInFrames / steps.length;
  const active = Math.min(steps.length - 1, Math.floor(frame / stepFrames));
  return (
    <DiagramField width={1080} contentHeight={(steps.length - 1) * 200 + 124}>
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <Arrow from={[540, (index - 1) * 200 + 124]} to={[540, index * 200 - 8]}
            color={index <= active ? ACTIVE : "#537086"} phase={frame / fps} lit={index === active} /> : null}
          <DiagramNode x={540} y={index * 200} width={1040} label={step.label}
            color={index === active ? ACTIVE : "#8daac0"} active={index === active} />
        </React.Fragment>
      ))}
    </DiagramField>
  );
};

function DiagramField({ children, contentHeight = 724, width = 900 }: React.PropsWithChildren<{ contentHeight?: number; width?: number }>) {
  const { height } = useVideoConfig();
  return (
    <AbsoluteFill style={{
      background: "radial-gradient(ellipse at 25% 34%, #14505b 0%, #102d3d 46%, #081827 90%)",
    }}>
      <AbsoluteFill style={{
        backgroundImage: "radial-gradient(#a7d9ef55 1.5px, transparent 1.5px)",
        backgroundSize: "36px 36px",
        opacity: 0.5,
      }} />
      <div style={{ position: "absolute", top: height * 0.46 - contentHeight / 2, left: `calc(50% - ${width / 2}px)`, width, height: contentHeight }}>{children}</div>
    </AbsoluteFill>
  );
}

function DiagramNode({ x, y, width, label, color, active }: {
  x: number; y: number; width: number; label: string; color: string; active: boolean;
}) {
  return (
    <div style={{
      position: "absolute", left: x - width / 2, top: y, width, height: 124,
      boxSizing: "border-box", border: `3px solid ${color}`, borderRadius: 26,
      padding: "12px 23px", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", textAlign: "center", background: active ? "#174356" : "#102b3c",
      boxShadow: active ? `0 0 36px ${color}44` : "none",
    }}>
      <div style={{ color: active ? color : "#e4f2fa", fontSize: 36, fontWeight: 800, lineHeight: 1.06 }}>{label}</div>
    </div>
  );
}

function Arrow({ from, to, color, phase, lit }: {
  from: Point; to: Point; color: string; phase: number; lit: boolean;
}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const width = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const travel = interpolate(phase % 1.2, [0, 1.2], [0, width - 16]);
  return (
    <div style={{
      position: "absolute", top: from[1], left: from[0], width, height: 5, backgroundColor: color,
      transformOrigin: "left center", transform: `rotate(${angle}rad)`, opacity: lit ? 1 : 0.4,
    }}>
      <div style={{
        position: "absolute", right: 0, top: -8, width: 0, height: 0,
        borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: `17px solid ${color}`,
      }} />
      {lit ? <div style={{
        position: "absolute", left: travel, top: -5, width: 15, height: 15, borderRadius: "50%",
        backgroundColor: "#fff", boxShadow: `0 0 17px ${color}`,
      }} /> : null}
    </div>
  );
}

function OctopusCirculation({ focus, phase }: {
  focus: Extract<Diagram, { kind: "octopus-circulation" }>["focus"];
  phase: number;
}) {
  const gills = focus !== "body";
  const body = focus !== "gills";
  return (
    <DiagramField>
      <Arrow from={[280, 124]} to={[280, 192]} color={PALE} phase={phase} lit={gills} />
      <Arrow from={[620, 124]} to={[620, 192]} color={PALE} phase={phase} lit={gills} />
      <Arrow from={[280, 324]} to={[408, 392]} color={BLUE} phase={phase} lit={gills} />
      <Arrow from={[620, 324]} to={[492, 392]} color={BLUE} phase={phase} lit={gills} />
      <Arrow from={[450, 524]} to={[450, 592]} color={BLUE} phase={phase} lit={body} />
      <Arrow from={[232, 660]} to={[58, 660]} color={PALE} phase={phase} lit={body} />
      <Arrow from={[58, 660]} to={[58, 62]} color={PALE} phase={phase} lit={body} />
      <Arrow from={[58, 62]} to={[132, 62]} color={PALE} phase={phase} lit={body} />
      <Arrow from={[668, 660]} to={[842, 660]} color={PALE} phase={phase} lit={body} />
      <Arrow from={[842, 660]} to={[842, 62]} color={PALE} phase={phase} lit={body} />
      <Arrow from={[842, 62]} to={[768, 62]} color={PALE} phase={phase} lit={body} />
      <DiagramNode x={280} y={0} width={280} label="Gill heart 1" color={PALE} active={gills} />
      <DiagramNode x={620} y={0} width={280} label="Gill heart 2" color={PALE} active={gills} />
      <DiagramNode x={280} y={200} width={280} label="Gill 1" color={BLUE} active={gills} />
      <DiagramNode x={620} y={200} width={280} label="Gill 2" color={BLUE} active={gills} />
      <DiagramNode x={450} y={400} width={430} label="Third heart" color={BLUE} active={body} />
      <DiagramNode x={450} y={600} width={430} label="Body and arms" color={BLUE} active={body} />
      <div style={{ position: "absolute", top: -60, width: "100%", display: "flex", justifyContent: "center", gap: 36, fontSize: 25 }}>
        <span style={{ color: PALE }}>Lavender · oxygen-poor</span>
        <span style={{ color: BLUE }}>Blue · oxygen-rich</span>
      </div>
    </DiagramField>
  );
}
