import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

type Focus = "alignment" | "refraction" | "dispersion" | "scattering" | "illumination";
type Point = { x: number; y: number };
const RED = "#ff9678";
const BLUE = "#69caff";
const WHITE = "#fff0cf";
const RED_CURVE = [[55, 130], [350, 130], [465, 330], [845, 365]] as const;
const BLUE_CURVE = [[55, 130], [350, 130], [465, 368], [845, 420]] as const;

function curvePoint(points: typeof RED_CURVE | typeof BLUE_CURVE, t: number): Point {
  const [a, b, c, d] = points;
  const u = 1 - t;
  return {
    x: u ** 3 * a[0] + 3 * u ** 2 * t * b[0] + 3 * u * t ** 2 * c[0] + t ** 3 * d[0],
    y: u ** 3 * a[1] + 3 * u ** 2 * t * b[1] + 3 * u * t ** 2 * c[1] + t ** 3 * d[1],
  };
}

function curvePath(points: typeof RED_CURVE | typeof BLUE_CURVE): string {
  return `M${points[0]} C${points[1]} ${points[2]} ${points[3]}`;
}

export function LunarEclipse({ focus }: { focus: Focus }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phase = frame / fps;
  const overview = focus === "alignment" || focus === "illumination";
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%">
        <defs>
          <radialGradient id="eclipse-background" cx="50%" cy="47%" r="65%">
            <stop stopColor="#16324c" /><stop offset="1" stopColor="#07111f" />
          </radialGradient>
          <radialGradient id="eclipse-earth" cx="30%" cy="25%">
            <stop stopColor="#3b9ed0" /><stop offset="1" stopColor="#123753" />
          </radialGradient>
          <radialGradient id="eclipse-sun">
            <stop stopColor="#fff9bf" /><stop offset="1" stopColor="#ffae43" />
          </radialGradient>
          <linearGradient id="eclipse-blue-fade" gradientUnits="userSpaceOnUse" x1="55" x2="845" y1="0" y2="0">
            <stop stopColor={BLUE} /><stop offset="0.5" stopColor={BLUE} stopOpacity="0.5" />
            <stop offset="1" stopColor={BLUE} stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="eclipse-air" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#2d6898" stopOpacity="0.06" />
            <stop offset="1" stopColor="#5aaadc" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <rect width="1080" height="1920" fill="url(#eclipse-background)" />
        {Array.from({ length: 90 }, (_, index) => (
          <circle key={index} cx={(index * 173 + 49) % 1080} cy={(index * 307 + 31) % 1920}
            r={1 + index % 3 * 0.4} fill="#d5e8ff" opacity={0.1 + index % 5 * 0.06} />
        ))}
        <g transform="translate(90 590)">
          {overview ? <Overview illuminated={focus === "illumination"} phase={phase} /> : <Atmosphere focus={focus} phase={phase} />}
          <text x="450" y="615" textAnchor="middle" fill="#9bb5c9" fontSize="19" fontFamily="Inter, sans-serif">
            Diagram · not to scale
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
}

function Ray({ path, color, phase, opacity = 1 }: { path: string; color: string; phase: number; opacity?: number }) {
  return (
    <g opacity={opacity}>
      <path d={path} fill="none" stroke={color} strokeWidth="13" opacity="0.1" />
      <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d={path} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray="4 46" strokeDashoffset={-phase * 90} />
    </g>
  );
}

function Label({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return <text x={x} y={y} fill="#dbeaf5" fontSize="28" fontFamily="Inter, sans-serif" textAnchor="middle">{children}</text>;
}

function Overview({ illuminated, phase }: { illuminated: boolean; phase: number }) {
  const moonY = illuminated ? 330 : 330 + Math.max(0, 1 - phase / 2) * 115;
  const redOpacity = illuminated ? Math.min(1, phase * 1.5) : 0;
  return (
    <>
      <path d="M460 250 L895 288 L895 372 L460 410 Z" fill="#020815" opacity="0.8" />
      {[295, 330, 365].map((y) => <Ray key={y} path={`M150 ${y} H382`} color={WHITE} phase={phase} />)}
      {[1, -1].map((side) => illuminated ? (
        <Ray key={side} path={`M125 ${330 + side * 55} L440 ${330 + side * 110} Q495 ${330 + side * 110} 550 ${330 + side * 72} L780 330`}
          color={RED} phase={phase} opacity={redOpacity} />
      ) : (
        <Ray key={side} path={`M125 ${330 + side * 55} L450 ${330 + side * 110}`} color={WHITE} phase={phase} opacity={0.8} />
      ))}
      {illuminated ? [1, -1].flatMap((side) => [0, 1, 2].map((index) => (
        <Ray key={`${side}-${index}`} path={`M${425 + index * 35} ${330 + side * 110} Q${450 + index * 65} ${330 + side * 170} ${470 + index * 90} ${330 + side * (210 - index * 20)}`}
          color={BLUE} phase={phase + index / 4} opacity={0.6} />
      ))) : null}
      <circle cx="80" cy="330" r="72" fill="url(#eclipse-sun)" />
      <circle cx="460" cy="330" r="116" fill={BLUE} opacity="0.05" />
      {[116, 104, 92].map((radius, index) => <circle key={radius} cx="460" cy="330" r={radius} fill="none" stroke={BLUE} strokeWidth="6" opacity={0.1 + index * 0.12} />)}
      <circle cx="460" cy="330" r="78" fill="url(#eclipse-earth)" />
      <path d="M410 280 L438 267 L449 284 L473 278 L480 298 L462 309 L470 324 L444 332 L431 318 L417 320 Z
        M438 343 L465 341 L479 362 L461 396 L443 381 Z M493 281 L517 298 L522 325 L502 332 L490 318"
        fill="#5baa88" opacity="0.8" />
      <circle cx="820" cy={moonY} r="43" fill="#45516a" />
      <circle cx="820" cy={moonY} r="43" fill="#cd684b" opacity={redOpacity} />
      <g fill="#332a32" opacity="0.28">
        <circle cx="809" cy={moonY - 10} r="12" /><circle cx="833" cy={moonY + 9} r="15" />
      </g>
      <Label x={80} y={445}>Sun</Label><Label x={460} y={465}>Earth</Label><Label x={820} y={moonY + 100}>Moon</Label>
    </>
  );
}

function Atmosphere({ focus, phase }: { focus: "refraction" | "dispersion" | "scattering"; phase: number }) {
  const colors = focus !== "refraction";
  const scattering = focus === "scattering";
  return (
    <>
      <path d="M20 45 H880 V545 Q450 395 20 545 Z" fill="url(#eclipse-air)" />
      {Array.from({ length: 150 }, (_, index) => {
        const depth = Math.sqrt((index + 0.5) / 150);
        return <circle key={index} cx={30 + (index * 163 % 840)} cy={60 + depth * 430}
          r={2 + depth * 2} fill="#9cb4c8" opacity={0.08 + depth * 0.2} />;
      })}
      <path d="M20 545 Q450 395 880 545 V575 H20 Z" fill="#22516a" />
      <Label x={75} y={30}>Air</Label><Label x={450} y={565}>Earth</Label>
      <Ray path={curvePath(RED_CURVE)} color={colors ? RED : WHITE} phase={phase} />
      {colors ? <Ray path={curvePath(BLUE_CURVE)} color={scattering ? "url(#eclipse-blue-fade)" : BLUE} phase={phase * 0.96} /> : null}
      {!colors ? Array.from({ length: 7 }, (_, index) => {
        const t = (phase / 6 + index / 7) % 1;
        const point = curvePoint(RED_CURVE, t);
        const next = curvePoint(RED_CURVE, Math.min(1, t + 0.01));
        const angle = Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI;
        return <line key={index} x1={point.x} y1={point.y - 22} x2={point.x} y2={point.y + 22}
          transform={`rotate(${angle} ${point.x} ${point.y})`} stroke={WHITE} strokeWidth="2" opacity="0.65" />;
      }) : null}
      {scattering ? [0.3, 0.43, 0.56, 0.69, 0.8].flatMap((t, index) => {
        const point = curvePoint(BLUE_CURVE, t);
        return [-1, 1].map((side) => (
          <Ray key={`${index}-${side}`} path={`M${point.x} ${point.y} Q${point.x + 25} ${point.y + side * 65} ${point.x + 50 - index * 14} ${point.y + side * 125}`}
            color={BLUE} phase={phase + index / 5} opacity={0.6} />
        ));
      }) : null}
    </>
  );
}
