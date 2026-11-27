import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { preflight } from "../src/preflight";
import { FrameDecoder, MAGIC, encodeHeader } from "../src/protocol";

const fixture = readFileSync(new URL("../../../fixtures/animation/popcorn-kernel.tsx", import.meta.url), "utf8");
const wrap = (body: string, imports = 'import { Canvas, type SequenceProps } from "@vcp/motion";') =>
  `${imports}\nexport default function S(props: SequenceProps) {\n${body}\n}\n`;
const messages = (source: string) => {
  const result = preflight(source);
  return result.ok ? [] : result.issues.map((issue) => issue.message);
};

describe("preflight", () => {
  it("accepts the trusted hand-authored fixture", () => {
    expect(preflight(fixture)).toEqual({ ok: true });
  });

  it.each([
    ["a Node import", 'import fs from "node:fs";\n' + wrap("return null;"), /Import from "node:fs"/],
    ["remotion itself", 'import { staticFile } from "remotion";\n' + wrap("return null;"), /Import from "remotion"/],
    ["a relative import", 'import x from "./other";\n' + wrap("return null;"), /Import from "\.\/other"/],
    ["re-exports", wrap("return null;") + 'export * from "@vcp/motion";', /Re-exports/],
    ["dynamic import", wrap('void import("@vcp/motion"); return null;'), /Dynamic import/],
    ["require", wrap('const fs = require("fs"); return null;'), /require is not available/],
    ["fetch", wrap('void fetch("/x"); return null;'), /fetch is not available/],
    ["unseeded randomness", wrap("const r = Math.random(); return <Canvas>{r}</Canvas>;"), /\.random/],
    ["destructured randomness", wrap("const { random } = Math; return <Canvas>{random()}</Canvas>;"), /Destructuring random/],
    ["wall-clock time", wrap("const t = Date.now(); return <Canvas>{t}</Canvas>;"), /Date is not available/],
    ["timers", wrap("setTimeout(() => {}, 1); return null;"), /setTimeout/],
    ["eval", wrap('eval("1"); return null;'), /eval/],
    ["constructor escapes", wrap('const f = (() => 0).constructor; return <Canvas>{String(f)}</Canvas>;'), /constructor/],
    ["string-keyed escapes", wrap('const f = (() => 0)["constructor"]; return null;'), /constructor/],
    ["computed string keys", wrap('const k = "con" + "structor"; const f = (() => 0)[k + ""]; return null;'), /Computed property access/],
    ["globalThis", wrap("const g = globalThis; return null;"), /globalThis/],
    ["frame state", 'import { useState } from "react";\n' + wrap("const [x] = useState(0); return null;"), /useState/],
    ["effects via namespace", 'import React from "react";\n' + wrap("React.useEffect(() => {}); return null;"), /useEffect/],
    ["raw HTML", wrap('return <div dangerouslySetInnerHTML={{ __html: "<b>x</b>" }} />;'), /dangerouslySetInnerHTML/],
    ["script tags", wrap("return <script>{'alert(1)'}</script>;"), /<script>/],
    ["foreignObject", wrap("return <svg><foreignObject /></svg>;"), /<foreignObject>/],
    ["external images", wrap('return <svg><image href="https://example.com/a.png" /></svg>;'), /<image>|External/],
    ["external use href", wrap('return <svg><use href="https://example.com/s.svg#a" /></svg>;'), /href must be a literal/],
    ["computed href", wrap("const id = '#a'; return <svg><use href={id} /></svg>;"), /href must be a literal/],
    ["CSS url()", wrap('return <div style={{ backgroundImage: "url(https://example.com/a.png)" }} />;'), /External resource/],
    ["data URLs", wrap('return <div style={{ backgroundImage: "url(data:image/png;base64,AAAA)" }} />;'), /External resource/],
    ["protocol-relative URLs", wrap("const u = `//example.com/x`; return <Canvas>{u}</Canvas>;"), /External resource/],
    ["event handlers", wrap("return <svg onClick={() => 0} />;"), /Event handler/],
    ["async code", wrap("const f = async () => 1; void f; return null;"), /Async/],
    ["classes", wrap("class A {} void A; return null;"), /Classes/],
    ["no default export", 'import type { SequenceProps } from "@vcp/motion";\nexport function S(props: SequenceProps) { return null; }', /Only the default|Export exactly one/],
    ["syntax errors", wrap("return <svg>;"), /expected|JSX/i],
  ])("rejects %s", (_label, source, pattern) => {
    const found = messages(source);
    expect(found.length, `no issue for ${_label}`).toBeGreaterThan(0);
    expect(found.join("\n")).toMatch(pattern);
  });

  it("allows fragment references, local helpers, loops and indexing", () => {
    const source = wrap(`
      const points = [1, 2, 3];
      let total = 0;
      for (let i = 0; i < points.length; i++) total += points[i]! + points[(i + 1) % points.length]!;
      const label = \`total \${total}\`;
      return <Canvas><defs><clipPath id="c"><rect width={1} height={1} /></clipPath></defs><g clipPath="url(#c)"><use href="#c" /><text>{label}</text></g></Canvas>;`);
    expect(preflight(source)).toEqual({ ok: true });
  });

  it("reports positions and enforces the size limit", () => {
    const result = preflight(wrap("\n\nvoid fetch('/x'); return null;"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]).toMatchObject({ line: 5 });
    expect(messages("//" + "x".repeat(70_000))).toEqual([expect.stringMatching(/limit is 65536/)]);
  });
});

describe("output framing", () => {
  const frame = (files: { name: string; bytes: Buffer }[]) => Buffer.concat([
    Buffer.from("stray log line\n"), MAGIC,
    ...files.flatMap((f) => [encodeHeader({ name: f.name, size: f.bytes.length }), f.bytes]),
    encodeHeader({ end: true }),
  ]);
  const limits = { maxBytes: 1000, maxFiles: 4, allowName: (n: string) => /^visual\.mp4$|^still-\d{3}-f\d+\.png$/.test(n) };

  it("decodes files split across arbitrary chunks after skipping stray output", () => {
    const bytes = frame([{ name: "visual.mp4", bytes: Buffer.from("video-bytes") }, { name: "still-000-f3.png", bytes: Buffer.from("png") }]);
    const decoder = new FrameDecoder(limits);
    for (let i = 0; i < bytes.length; i += 3) decoder.push(bytes.subarray(i, i + 3));
    expect(decoder.ended).toBe(true);
    expect(decoder.files.map((f) => [f.name, f.bytes.toString()])).toEqual([["visual.mp4", "video-bytes"], ["still-000-f3.png", "png"]]);
  });

  it("rejects unexpected names, oversize output and trailing data", () => {
    expect(() => new FrameDecoder(limits).push(frame([{ name: "../../etc/passwd", bytes: Buffer.from("x") }]))).toThrow(/Unexpected/);
    expect(() => new FrameDecoder(limits).push(frame([{ name: "visual.mp4", bytes: Buffer.alloc(2000) }]))).toThrow(/exceeds/);
    expect(() => new FrameDecoder(limits).push(Buffer.concat([frame([]), Buffer.from("x")]))).toThrow(/after the end/);
  });
});

describe("scope-aware globals", () => {
  it("allows locals that share a global's name but still catches the global elsewhere", () => {
    expect(preflight(wrap("const open = 1; return <Canvas>{open}</Canvas>;"))).toEqual({ ok: true });
    const shadowElsewhere = wrap("const f = (fetch: number) => fetch; void f; void fetch('/x'); return null;");
    expect(messages(shadowElsewhere).join("\n")).toMatch(/fetch is not available/);
  });
});
