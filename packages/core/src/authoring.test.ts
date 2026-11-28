import { describe, expect, it } from "vitest";
import { poseSet } from "./authoring";

const pose = { x: 540, y: 600, width: 200, height: 200, scale: 1, rotate: 0 };

describe("poseSet", () => {
  it("leaves out objects posed at zero size, which means absent at that edge", () => {
    const set = poseSet([{ id: "kernel", ...pose }, { id: "puff", ...pose, width: 0, height: 0, scale: 0 }], "start");
    expect(Object.keys(set)).toEqual(["kernel"]);
  });

  it("names the object and edge of an invalid pose", () => {
    expect(() => poseSet([{ id: "hull", ...pose, width: 0 }], "end")).toThrow(/end pose for hull: width/);
    expect(() => poseSet([{ id: "hull", ...pose }, { id: "hull", ...pose }], "start")).toThrow(/start pose for hull appears twice/);
  });
});

describe("model-facing limits", () => {
  it("survive into the strict schema as descriptions", async () => {
    const { strictJsonSchema } = await import("./llm");
    const { SequenceAuthorDraft, SequenceDirection } = await import("./authoring");
    const draft = JSON.stringify(strictJsonSchema(SequenceAuthorDraft));
    expect(draft).not.toContain("maxLength");
    expect(draft).toContain("At most 1200 characters");
    expect(draft).toContain("Integer from -30 to 30");
    expect(JSON.stringify(strictJsonSchema(SequenceDirection))).toContain("At most 600 characters");
  });
});
