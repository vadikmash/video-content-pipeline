import { z } from "zod";

const Color = z.string().regex(/^(#[0-9a-fA-F]{6}|none)$/);
const Coordinate = z.number().finite().min(-1920).max(1920);

export const VectorNode = z.object({
  id: z.string().min(1).max(60),
  parentId: z.string().nullable(),
  x: Coordinate,
  y: Coordinate,
  fill: Color,
  stroke: Color,
  strokeWidth: z.number().min(0).max(24),
  shape: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("group") }),
    z.object({
      kind: z.literal("ellipse"),
      rx: z.number().positive().max(700),
      ry: z.number().positive().max(700),
    }),
    z.object({
      kind: z.literal("rect"),
      width: z.number().positive().max(1080),
      height: z.number().positive().max(1200),
      radius: z.number().min(0).max(200),
    }),
    z.object({
      kind: z.literal("path"),
      d: z
        .string()
        .min(1)
        .max(2400)
        .regex(/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\s-]+$/),
    }),
    z.object({
      kind: z.literal("text"),
      text: z.string().min(1).max(32),
      fontSize: z.number().min(26).max(64),
    }),
  ]),
});

export const MotionProperty = z.enum([
  "x",
  "y",
  "scale",
  "rotate",
  "opacity",
  "draw",
]);
const Anchor = z.object({
  word: z.number().int().nonnegative(),
  edge: z.enum(["start", "end"]),
  value: z.number().finite().min(-1920).max(1920),
});

/** Model-authored geometry and word anchors. The pipeline resolves times before rendering. */
export const AnimationDraft = z.object({
  description: z.string().min(1).max(300),
  nodes: z.array(VectorNode).min(2).max(60),
  tracks: z
    .array(
      z.object({
        nodeId: z.string(),
        property: MotionProperty,
        keyframes: z.array(Anchor).min(2).max(8),
      }),
    )
    .min(1)
    .max(80),
});
export type AnimationDraft = z.infer<typeof AnimationDraft>;

export const VectorAnimation = z.object({
  version: z.literal(1),
  description: z.string(),
  nodes: z.array(VectorNode).min(2).max(60),
  tracks: z
    .array(
      z.object({
        nodeId: z.string(),
        property: MotionProperty,
        keyframes: z
          .array(
            z.object({
              time: z.number().nonnegative(),
              value: z.number().finite(),
            }),
          )
          .min(2)
          .max(8),
      }),
    )
    .min(1)
    .max(80),
});
export type VectorAnimation = z.infer<typeof VectorAnimation>;

export function validateAnimationStructure(
  plan: Pick<AnimationDraft, "nodes" | "tracks">,
): void {
  const nodes = new Map<string, z.infer<typeof VectorNode>>();
  for (const node of plan.nodes) {
    if (nodes.has(node.id)) throw new Error(`Duplicate vector node ${node.id}`);
    if (
      node.parentId !== null &&
      nodes.get(node.parentId)?.shape.kind !== "group"
    ) {
      throw new Error(`Parent of ${node.id} must be an earlier group`);
    }
    nodes.set(node.id, node);
  }
  if (
    !plan.nodes.some(
      (node) => node.shape.kind !== "group" && node.shape.kind !== "text",
    )
  ) {
    throw new Error("An animated scene needs illustrated objects");
  }
  const tracks = new Set<string>();
  for (const track of plan.tracks) {
    const node = nodes.get(track.nodeId);
    const key = `${track.nodeId}:${track.property}`;
    if (!node || tracks.has(key))
      throw new Error(`Invalid or duplicate motion track ${key}`);
    if (track.property === "draw" && node.shape.kind !== "path")
      throw new Error("Stroke draw requires a path");
    for (const frame of track.keyframes) {
      if (
        ["opacity", "draw"].includes(track.property) &&
        (frame.value < 0 || frame.value > 1)
      )
        throw new Error(`${key} must stay between zero and one`);
      if (track.property === "scale" && (frame.value < 0 || frame.value > 5))
        throw new Error(`${key} must stay between zero and five`);
    }
    tracks.add(key);
  }
}
