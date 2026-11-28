/**
 * Trusted, hand-authored fixture for the sequence worker and motion toolkit.
 * It covers the popcorn pilot (b3-b5): moisture turns to vapor inside an intact
 * hull, pressure builds, the hull splits at a seam and starch expands through it.
 * It is test material, not the product pilot (which the configured model authors).
 */
import {
  Canvas,
  anticipate,
  burst,
  cameraAt,
  cameraTransform,
  cueFrame,
  ease,
  morphPath,
  random,
  settle,
  tween,
  type SequenceProps,
} from "@vcp/motion";

const CENTER = { x: 540, y: 760 };
const HALF_W = 250;
const HALF_H = 330;
const BAND = 30;
/** Hull outline parameter (radians, clockwise from the top) where the seam opens and the hinge sits. */
const SEAM = 0.42;
const HINGE = Math.PI + 0.55;

/** Egg-shaped kernel outline, wider at the crown, slightly tipped. */
function outline(t: number, inset: number) {
  const a = HALF_W - inset;
  const b = HALF_H - inset;
  const x = CENTER.x + a * Math.sin(t) * (1 + 0.1 * Math.cos(t)) - 26 * ((1 - Math.cos(t)) / 2) ** 2;
  const y = CENTER.y - b * Math.cos(t);
  return { x, y };
}

function bandPath(from: number, to: number, steps = 36) {
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    const o = outline(t, 0);
    const n = outline(t, BAND);
    outer.push(`${o.x.toFixed(1)} ${o.y.toFixed(1)}`);
    inner.unshift(`${n.x.toFixed(1)} ${n.y.toFixed(1)}`);
  }
  return `M${outer.join(" L")} L${inner.join(" L")} Z`;
}

function cavityPath(steps = 72) {
  const points: string[] = [];
  for (let i = 0; i < steps; i++) {
    const p = outline((Math.PI * 2 * i) / steps, BAND - 2);
    points.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }
  return `M${points.join(" L")} Z`;
}

/** Closed lobed blob with a fixed command structure, so compact and fluffy shapes morph. */
function lobes(cx: number, cy: number, radii: readonly number[]) {
  const n = radii.length;
  const point = (i: number, r: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };
  const first = point(0, radii[0]!);
  let d = `M${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const r0 = radii[i]!;
    const r1 = radii[(i + 1) % n]!;
    const mid = point(i + 0.5, Math.max(r0, r1) * 1.32);
    const end = point(i + 1, r1);
    d += ` Q${mid.x.toFixed(1)} ${mid.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  }
  return `${d} Z`;
}

const HULL_RIGHT = bandPath(SEAM, HINGE);
const HULL_LEFT = bandPath(HINGE, Math.PI * 2 + SEAM);
const CAVITY = cavityPath();
const SEAM_POINT = outline(SEAM, BAND / 2);
const HINGE_POINT = outline(HINGE, BAND / 2);
const PUFF_ORIGIN = { x: SEAM_POINT.x - 40, y: SEAM_POINT.y + 70 };
const PUFF_COMPACT = lobes(0, 0, [70, 64, 72, 66, 70, 62, 68, 64]);
const PUFF_FLUFFY = lobes(0, 0, [190, 150, 205, 160, 185, 140, 200, 155]);

export default function PopcornKernel(props: SequenceProps) {
  const { frame, fps, seed, style } = props;
  const palette = style.palette;
  const heats = cueFrame(props.cues, "heats");
  const vapor = cueFrame(props.cues, "vapor");
  const builds = cueFrame(props.cues, "builds");
  const pressure = cueFrame(props.cues, "pressure");
  const ruptures = cueFrame(props.cues, "ruptures");
  const expands = cueFrame(props.cues, "expands");

  const heat = tween(frame, [
    { frame: heats - 4, value: 0 },
    { frame: vapor + 20, value: 0.6, ease: ease.inOut(2) },
    { frame: ruptures, value: 1, ease: ease.in(2) },
  ]);
  const boil = tween(frame, [
    { frame: heats, value: 0 },
    { frame: vapor + 6, value: 1, ease: ease.inOut(2) },
  ]);
  const tension = tween(frame, [
    { frame: builds - 6, value: 0 },
    { frame: pressure + 40, value: 1, ease: ease.out(2) },
  ]);
  // The hull bulges with pressure, winds up just before the cue, then the shell splits.
  const bulge = frame < ruptures - 8
    ? 1 + 0.035 * tension
    : tween(frame, anticipate({ from: 1.035, to: 1, start: ruptures, end: ruptures + 4, anticipationFrames: 8, anticipation: 1.2, overshoot: 0, settleFrames: 2 }));
  const tremor = frame >= pressure + 40 && frame < ruptures ? Math.sin(frame * 2.9) * 2.2 * tension : 0;
  const open = settle(frame, { start: ruptures, from: 0, to: 1, fps, damping: 9, stiffness: 170 });
  const puffGrowth = frame < expands
    ? tween(frame, [{ frame: ruptures + 2, value: 0 }, { frame: expands, value: 0.32, ease: ease.out(3) }])
    : settle(frame, { start: expands, from: 0.32, to: 1, fps, damping: 13, stiffness: 150 });
  const puffShape = morphPath(PUFF_COMPACT, PUFF_FLUFFY, Math.min(1, Math.max(0, (puffGrowth - 0.2) / 0.8)));

  const camera = cameraAt(frame, [
    { frame: 0, focus: CENTER, zoom: 0.92, anchor: { x: 540, y: 760 } },
    { frame: heats, focus: CENTER, zoom: 0.94, anchor: { x: 540, y: 760 } },
    { frame: vapor + 15, focus: { x: 560, y: 830 }, zoom: 1.28, anchor: { x: 540, y: 760 }, ease: ease.inOut(3) },
    { frame: builds, focus: { x: 560, y: 820 }, zoom: 1.24, anchor: { x: 540, y: 760 }, ease: ease.inOut(2) },
    { frame: pressure + 30, focus: CENTER, zoom: 1.04, anchor: { x: 540, y: 770 }, ease: ease.inOut(3) },
    { frame: ruptures, focus: CENTER, zoom: 1.02, anchor: { x: 540, y: 770 } },
    { frame: expands + 24, focus: { x: 600, y: 600 }, zoom: 0.84, anchor: { x: 540, y: 700 }, ease: ease.out(3) },
  ]);

  const hull = mix(palette.hull ?? "#c47a2c", palette.hullHot ?? "#d9542b", heat * 0.55);
  const droplets = Array.from({ length: 9 }, (_, i) => ({
    x: CENTER.x - 120 + 220 * random(seed, i, "dx"),
    y: CENTER.y - 40 + 260 * random(seed, i, "dy"),
    r: 15 + 12 * random(seed, i, "dr"),
  }));
  const wisps = Array.from({ length: 46 }, (_, i) => {
    const agitation = 6 + 22 * tension;
    const phase = random(seed, i, "phase") * Math.PI * 2;
    return {
      x: CENTER.x - 170 + 340 * random(seed, i, "wx") + Math.sin(frame * 0.21 + phase) * agitation,
      y: CENTER.y - 230 + 520 * random(seed, i, "wy") + Math.cos(frame * 0.17 + phase) * agitation,
      r: 7 + 9 * random(seed, i, "wr"),
      on: random(seed, i, "on") < 0.25 + 0.75 * boil,
    };
  });
  const arrows = Array.from({ length: 12 }, (_, i) => {
    const t = (Math.PI * 2 * i) / 12 + 0.2;
    const from = outline(t, BAND + 70);
    const to = outline(t, BAND + 70 - 46 * tension);
    return { from, to };
  });
  const fragments = burst(frame, {
    seed, start: ruptures, count: 22, origin: SEAM_POINT, direction: -65, spread: 110,
    speed: [7, 16], lifetime: [26, 64], gravity: 0.12, drag: 0.07, size: [8, 18],
  });
  const leftAngle = -17 * open;
  const rightAngle = 11 * open;

  return (
    <Canvas background={palette.background ?? "#0d1b2a"}>
      <defs>
        <radialGradient id="backlight" cx="50%" cy="38%" r="60%">
          <stop offset="0%" stopColor={palette.backlight ?? "#1f3b57"} />
          <stop offset="100%" stopColor={palette.background ?? "#0d1b2a"} />
        </radialGradient>
        <clipPath id="cavity"><path d={CAVITY} /></clipPath>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={18} />
        </filter>
      </defs>
      <rect id="backlight-layer" x={0} y={0} width={1080} height={1920} fill="url(#backlight)" />
      <g id="world" transform={cameraTransform(camera)}>
        <g id="kernel" transform={`translate(${tremor} 0) translate(${CENTER.x} ${CENTER.y}) scale(${bulge}) translate(${-CENTER.x} ${-CENTER.y})`}>
          <path id="heat-glow" d={CAVITY} fill={palette.hullHot ?? "#d9542b"} opacity={0.45 * heat} filter="url(#glow)" transform={`translate(${CENTER.x} ${CENTER.y}) scale(1.12) translate(${-CENTER.x} ${-CENTER.y})`} />
          <g id="interior" clipPath="url(#cavity)">
            <path id="starch" d={CAVITY} fill={palette.starch ?? "#f2e4c2"} />
            {Array.from({ length: 70 }, (_, i) => (
              <circle key={`grain-${i}`} cx={CENTER.x - 230 + 460 * random(seed, i, "gx")} cy={CENTER.y - 320 + 640 * random(seed, i, "gy")} r={4 + 5 * random(seed, i, "gr")} fill={palette.starchShade ?? "#dcc89c"} opacity={0.7} />
            ))}
            {droplets.map((drop, i) => (
              <circle key={`drop-${i}`} cx={drop.x} cy={drop.y - 30 * boil * random(seed, i, "rise")} r={drop.r * (1 - 0.6 * boil)} fill={palette.water ?? "#4fb3e8"} opacity={0.95 - 0.4 * boil} />
            ))}
            {wisps.map((wisp, i) => wisp.on && boil > 0 ? (
              <circle key={`vapor-${i}`} cx={wisp.x} cy={wisp.y} r={wisp.r} fill={palette.vapor ?? "#6ec6f5"} opacity={(0.3 + 0.45 * boil) * (1 - open)} />
            ) : null)}
            {tension > 0 && open < 0.2 ? arrows.map((arrow, i) => (
              <line key={`push-${i}`} x1={arrow.from.x} y1={arrow.from.y} x2={arrow.to.x} y2={arrow.to.y} stroke={palette.pressure ?? "#ff8a5b"} strokeWidth={9} strokeLinecap="round" opacity={0.85 * tension} />
            )) : null}
          </g>
          <g id="puff" transform={`translate(${PUFF_ORIGIN.x} ${PUFF_ORIGIN.y}) translate(${70 * puffGrowth} ${-200 * puffGrowth}) scale(${0.15 + 0.85 * puffGrowth})`} opacity={puffGrowth > 0 ? 1 : 0}>
            <path d={puffShape} fill={palette.starch ?? "#f2e4c2"} stroke={palette.starchShade ?? "#dcc89c"} strokeWidth={6} />
            <path d={puffShape} fill="none" stroke="#ffffff" strokeWidth={10} opacity={0.35} transform="translate(-10 -12) scale(0.82)" />
          </g>
          <path id="hull-right" d={HULL_RIGHT} fill={hull} transform={`rotate(${rightAngle} ${HINGE_POINT.x} ${HINGE_POINT.y})`} />
          <path id="hull-left" d={HULL_LEFT} fill={hull} transform={`rotate(${leftAngle} ${HINGE_POINT.x} ${HINGE_POINT.y})`} />
          <path id="tip-cap" d={`M${HINGE_POINT.x - 40} ${HINGE_POINT.y + 10} Q${HINGE_POINT.x} ${HINGE_POINT.y + 70} ${HINGE_POINT.x + 50} ${HINGE_POINT.y + 18} Z`} fill={palette.tip ?? "#7a4a1e"} />
        </g>
        <g id="fragments">
          {fragments.map((piece) => (
            <rect key={piece.id} x={piece.x - piece.size / 2} y={piece.y - piece.size / 3} width={piece.size} height={piece.size * 0.66} rx={3} fill={hull} opacity={piece.opacity} transform={`rotate(${piece.rotate} ${piece.x} ${piece.y})`} />
          ))}
        </g>
      </g>
    </Canvas>
  );
}

function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
