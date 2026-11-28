/**
 * Short, topic-independent example shown to the sequence author. A drop
 * gathers at a tap, falls on the "falls" cue and splashes on "hits". It shows
 * the module shape, cue timing, a camera move, settle, a seeded burst and a
 * matched-topology morph. It is not a template for any particular topic.
 */
import { Canvas, burst, cameraAt, cameraTransform, cueFrame, ease, morphPath, settle, tween, type SequenceProps } from "@vcp/motion";

// Same command list and point count in both shapes, so they can morph.
const DROP_ROUND = "M540 300 C580 300 600 330 600 360 C600 400 575 420 540 420 C505 420 480 400 480 360 C480 330 500 300 540 300 Z";
const DROP_FLAT = "M540 330 C620 330 680 352 680 370 C680 388 620 400 540 400 C460 400 400 388 400 370 C400 352 460 330 540 330 Z";

export default function FallingDrop({ frame, fps, seed, cues, style }: SequenceProps) {
  const color = (name: string, fallback: string) => style.palette[name] ?? fallback;
  const falls = cueFrame(cues, "falls");
  const hits = cueFrame(cues, "hits");

  // Gathering swells before the fall; one clock for the whole sequence.
  const swell = tween(frame, [{ frame: 0, value: 0.6 }, { frame: falls, value: 1, ease: ease.out(2) }]);
  const dropY = tween(frame, [{ frame: falls, value: 0 }, { frame: hits, value: 1000, ease: ease.in(2) }]);
  const squash = tween(frame, [{ frame: hits - 1, value: 0 }, { frame: hits + 4, value: 1, ease: ease.out(3) }]);
  const ripple = settle(frame, { start: hits, from: 0, to: 1, fps, damping: 14 });

  // Follow the drop down, then widen for the splash; the drop stays the point of interest.
  const camera = cameraAt(frame, [
    { frame: 0, focus: { x: 540, y: 420 }, zoom: 1.6 },
    { frame: falls, focus: { x: 540, y: 420 }, zoom: 1.6 },
    { frame: hits, focus: { x: 540, y: 1300 }, zoom: 1.2, ease: ease.inOut(2) },
    { frame: hits + 30, focus: { x: 540, y: 1250 }, zoom: 1, ease: ease.out(3) },
  ]);

  const spray = burst(frame, {
    seed, start: hits, count: 36, origin: { x: 540, y: 1380 },
    direction: -90, spread: 120, speed: [8, 20], lifetime: [20, 40], gravity: 0.9, drag: 0.03, size: [5, 12],
  });

  return (
    <Canvas background={color("background", "#10202c")}>
      <g id="world" transform={cameraTransform(camera)}>
        <rect id="tap" x={500} y={200} width={80} height={100} rx={12} fill={color("metal", "#8a99a6")} />
        <rect id="pool" x={-200} y={1380} width={1480} height={700} fill={color("water", "#2f7fb5")} />
        <ellipse id="ripple" cx={540} cy={1380} rx={60 + 340 * ripple} ry={12 + 50 * ripple}
          fill="none" stroke={color("foam", "#d8eef8")} strokeWidth={8} opacity={frame < hits ? 0 : 1 - ripple} />
        <g id="drop" transform={`translate(0 ${frame < hits ? dropY : 1000}) scale(1 ${swell}) translate(0 ${(1 - swell) * 300})`}>
          <path d={morphPath(DROP_ROUND, DROP_FLAT, squash)} fill={color("water", "#2f7fb5")} opacity={1 - squash * 0.8} />
        </g>
        {spray.map((p) => (
          <circle key={p.id} cx={p.x} cy={p.y} r={p.size} fill={color("foam", "#d8eef8")} opacity={p.opacity} />
        ))}
      </g>
    </Canvas>
  );
}
