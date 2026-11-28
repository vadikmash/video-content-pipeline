/**
 * Renders the trusted popcorn sequence fixture through the isolated worker.
 *   pnpm --filter @vcp/provider-render-remotion exec tsx scripts/sequence-fixture.ts <outDir> [draft|full|stills] [frames...]
 * Writes the returned files plus job.json into <outDir>. Needs the worker image (pnpm animation-worker:build).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDockerSequenceWorker } from "../src/sequence-worker";
import { fixtureJob } from "../test/sequence-fixture";

const [outDir, mode = "draft", ...frames] = process.argv.slice(2);
if (!outDir) throw new Error("usage: sequence-fixture.ts <outDir> [draft|full|stills] [frames...]");
const root = path.resolve(fileURLToPath(import.meta.url), "../../../../..");
const source = await readFile(path.join(root, "fixtures/animation/popcorn-kernel.tsx"), "utf8");
const job = mode === "stills"
  ? { ...fixtureJob(source, "draft"), mode: "stills" as const, frames: frames.map(Number) }
  : fixtureJob(source, mode === "full" ? "full" : "draft");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "job.json"), JSON.stringify({ ...job, source: `<${source.length} chars>` }, null, 2));
const result = await createDockerSequenceWorker().run(job);
for (const file of result.files) await writeFile(path.join(outDir, file.name), file.bytes);
console.log(JSON.stringify({ files: result.files.map((f) => [f.name, f.bytes.length]), elapsedMs: result.elapsedMs, imageId: result.imageId, diagnostics: result.diagnostics }, null, 2));
