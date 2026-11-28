import { tween, type Ease } from "./timing";

export interface CameraPose {
  /** Design-space point the camera looks at. */
  focus: { x: number; y: number };
  zoom: number;
  /** Where the focus point appears on screen (design space); defaults to the frame center. */
  anchor?: { x: number; y: number };
}

export interface CameraKey extends CameraPose {
  frame: number;
  ease?: Ease;
}

/** Interpolated camera pose; the focus stays the point of interest throughout a move. */
export function cameraAt(frame: number, keys: readonly CameraKey[], size = { width: 1080, height: 1920 }): Required<CameraPose> {
  const pick = (get: (key: CameraKey) => number) => tween(frame, keys.map((key) => ({ frame: key.frame, value: get(key), ease: key.ease })));
  const center = { x: size.width / 2, y: size.height / 2 };
  return {
    focus: { x: pick((k) => k.focus.x), y: pick((k) => k.focus.y) },
    // Interpolate zoom in log space so pushes feel even.
    zoom: Math.exp(pick((k) => Math.log(k.zoom))),
    anchor: { x: pick((k) => (k.anchor ?? center).x), y: pick((k) => (k.anchor ?? center).y) },
  };
}

/** SVG transform that puts `focus` at `anchor` with `zoom`. */
export function cameraTransform(pose: Required<CameraPose>): string {
  const { focus, zoom, anchor } = pose;
  return `translate(${anchor.x} ${anchor.y}) scale(${zoom}) translate(${-focus.x} ${-focus.y})`;
}

/** Map a design-space point through the camera to screen space. */
export function projectPoint(pose: Required<CameraPose>, point: { x: number; y: number }) {
  return {
    x: pose.anchor.x + (point.x - pose.focus.x) * pose.zoom,
    y: pose.anchor.y + (point.y - pose.focus.y) * pose.zoom,
  };
}
