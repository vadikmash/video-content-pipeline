/**
 * What the sequence author is told about the module contract and the trusted
 * toolkit. Kept next to the preflight rules it describes; bump REFERENCE_VERSION
 * when either changes so authoring caches miss.
 */
import { readFileSync } from "node:fs";

export const REFERENCE_VERSION = "1";

export const TOOLKIT_REFERENCE = `Module contract
- One TSX module. Import only from "react" and "@vcp/motion". Exactly one default export: a function component taking SequenceProps.
- Pure function of props.frame. Every frame must render directly, in any order: no state, effects, refs, timers, Date, Math.random, fetch, DOM or Node APIs, classes, async, dynamic import, eval, or computed property access with strings.
- Draw everything with SVG inside <Canvas>. No <img>, <image>, <foreignObject>, <script>, <style>, external URLs or url(...) other than local "#id" references (gradients, clipPaths, masks you define).
- Use stable element ids and a fixed layer order. Coordinates are the 1080x1920 design space at every render size.
- Source limit 64 KiB. Keep helper functions and constants local to the module.

SequenceProps (frames are local to the sequence; 0 is its first frame)
  frame, fps (30), durationInFrames, width (1080), height (1920), seed
  cues: Record<cueName, localFrame>          // the cue bindings you return, already resolved
  beats: { id, start, end, captionBox: {x,y,width,height} }[]   // local beat intervals and the caption box to keep clear
  style: { id, palette: Record<name, "#rrggbb">, notes }
  poses: { start: Record<objectId, Pose>, end: Record<objectId, Pose> }  // Pose {x,y,width,height,scale,rotate}

@vcp/motion
  Canvas({ background?, children })            root <svg viewBox="0 0 1080 1920">
  beatAt(props, frame) -> beat                  beat containing a frame
  cueFrame(cues, name, offset = 0) -> number    throws on unknown cue; |offset| <= 30
  ease.hold | ease.linear | ease.in(p=3) | ease.out(p=3) | ease.inOut(p=3) | ease.bezier(x1,y1,x2,y2)
  tween(frame, keys: { frame, value, ease? }[]) -> number   holds before the first and after the last key; keys in frame order
  settle(frame, { start, from, to, fps, damping?, stiffness?, mass? }) -> number   damped spring from start
  anticipate({ from, to, start, end, anticipationFrames?, anticipation?, overshoot?, settleFrames? }) -> keys for tween
  random(seed, ...keys) -> [0,1)   randomRange(seed, min, max, ...keys)   deterministic; key by element id/index
  burst(frame, { seed, start, count <= 240, origin, direction?, spread?, speed?: [min,max], lifetime?: [min,max] (<= 240), gravity?, drag?, size?: [min,max] })
     -> { id, x, y, size, rotate, opacity, age }[]   closed form, any frame
  morphPath(a, b, t) -> string     a and b must have the same command letters and point counts (use separate paths for a torn shape)
  morphIncompatibility(a, b) -> string | null
  cameraAt(frame, keys: { frame, focus: {x,y}, zoom, anchor?, ease? }[]) -> pose
  cameraTransform(pose) -> SVG transform string for a <g> wrapping the world
  projectPoint(pose, point) -> screen point (use to keep labels or caption clearance in screen space)
  TOOLKIT_VERSION, DESIGN = { width: 1080, height: 1920 }`;

export const EXAMPLE_SEQUENCE = readFileSync(new URL("../../../fixtures/animation/example-drop.tsx", import.meta.url), "utf8");
